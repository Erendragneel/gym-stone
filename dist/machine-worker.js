/* Photos are processed on this device. Network requests download the library,
   runtime and public model files only; images are never sent to a service.
   The public CLIP ONNX weights run locally with separate text and vision
   encoders: https://huggingface.co/Xenova/clip-vit-base-patch32
   Model license: https://github.com/openai/CLIP/blob/main/LICENSE */
'use strict';

const MODEL = 'Xenova/clip-vit-base-patch32';
const LIBRARY = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
let modelPromise;
let cachedTextSignature = '';
let cachedTextEmbeddings;
let queue = Promise.resolve();

function post(type, requestId, details) {
  self.postMessage({ type, requestId, ...details });
}

function normalize(values) {
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm === 0) throw new Error('The photo could not be compared.');
  return values.map(value => value / norm);
}

async function models(requestId) {
  if (!modelPromise) {
    post('progress', requestId, {
      message: 'Preparing photo recognition. First use downloads about 155 MB plus the runtime; saved files are reused when available…'
    });
    modelPromise = (async () => {
      const library = await import(LIBRARY);
      const { env, AutoTokenizer, AutoProcessor, CLIPTextModelWithProjection, CLIPVisionModelWithProjection } = library;
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      env.backends.onnx.wasm.numThreads = 1;
      const options = {
        device: 'wasm', dtype: 'q8',
        progress_callback: progress => {
          if (progress.status === 'progress' && Number.isFinite(progress.progress)) {
            post('progress', requestId, {
              message: 'Downloading recognition files… ' + Math.round(progress.progress) + '%'
            });
          }
        }
      };
      // Await each encoder separately so a failed download can release anything
      // already loaded before the next request retries.
      let textModel, visionModel;
      try {
        const tokenizer = await AutoTokenizer.from_pretrained(MODEL, options);
        const processor = await AutoProcessor.from_pretrained(MODEL, options);
        textModel = await CLIPTextModelWithProjection.from_pretrained(MODEL, options);
        visionModel = await CLIPVisionModelWithProjection.from_pretrained(MODEL, options);
        return { tokenizer, processor, textModel, visionModel, RawImage: library.RawImage };
      } catch (error) {
        await Promise.allSettled([textModel?.dispose(), visionModel?.dispose()]);
        throw error;
      }
    })();
  }
  try {
    return await modelPromise;
  } catch (error) {
    modelPromise = undefined;
    cachedTextSignature = '';
    cachedTextEmbeddings = undefined;
    throw error;
  }
}

async function recognize(data) {
  const requestId = data?.requestId;
  try {
    // Accept a local image only, so a caller cannot accidentally upload or fetch
    // a photo through the image loader.
    if (typeof data?.image !== 'string' || !/^data:image\/(?:jpeg|png|webp);base64,/i.test(data.image) || data.image.length > 24 * 1024 * 1024) {
      throw new Error('Choose a JPEG, PNG or WebP photo.');
    }
    if (!Array.isArray(data.candidates) || !data.candidates.length || data.candidates.length > 256 || data.candidates.some(candidate =>
      !candidate || typeof candidate.id !== 'string' || !candidate.id || typeof candidate.text !== 'string' || !candidate.text.trim() || candidate.text.length > 500
    )) throw new Error('The equipment choices could not be loaded.');
    const candidates = data.candidates;
    const { tokenizer, processor, textModel, visionModel, RawImage } = await models(requestId);
    const started = performance.now();
    const signature = JSON.stringify(candidates.map(({ id, text }) => [id, text]));
    if (signature !== cachedTextSignature) {
      post('progress', requestId, { message: 'Preparing equipment comparisons on your device…' });
      const inputs = tokenizer(candidates.map(candidate => candidate.text), {
        padding: true, truncation: true
      });
      const { text_embeds } = await textModel(inputs);
      const embeddings = text_embeds.tolist().map(normalize);
      if (embeddings.length !== candidates.length) throw new Error('The equipment choices could not be compared.');
      cachedTextEmbeddings = embeddings;
      cachedTextSignature = signature;
    }
    post('progress', requestId, { message: 'Comparing the photo on your device…' });
    const image = await RawImage.read(data.image);
    const imageInputs = await processor(image);
    const { image_embeds } = await visionModel(imageInputs);
    const embedding = normalize(image_embeds.tolist()[0]);
    // CLIP scales normalized image/text similarity by 100 before softmax.
    // These scores rank the supplied choices; they are not calibrated
    // probabilities of correct identification.
    const logits = cachedTextEmbeddings.map(text => {
      if (text.length !== embedding.length) throw new Error('The photo could not be compared.');
      return 100 * text.reduce((sum, value, index) => sum + value * embedding[index], 0);
    });
    const maximum = Math.max(...logits);
    const exponentials = logits.map(value => Math.exp(value - maximum));
    const total = exponentials.reduce((sum, value) => sum + value, 0);
    const results = candidates.map((candidate, index) => ({ id: candidate.id, score: exponentials[index] / total }))
      .sort((a, b) => b.score - a.score).slice(0, 4);
    post('result', requestId, { results, milliseconds: performance.now() - started });
  } catch (error) {
    const message = String(error?.message || error).replace(/[\r\n]+/g, ' ').slice(0, 180);
    post('error', requestId, {
      message: 'Photo recognition could not finish. Check your connection and available memory, then try again. ' + message
    });
  }
}

// Serial requests share the same model and candidate cache safely. The UI may
// terminate this worker to cancel an old photo without starting a second run.
self.onmessage = ({ data }) => {
  queue = queue.then(() => recognize(data)).catch(() => {});
};
