/* Food photos are processed locally. Network requests download model files only. */
let classifier;
self.onmessage=async({data})=>{
  try {
    if(!classifier){
      self.postMessage({type:'progress',message:'Downloading the food model (about 90 MB). First use takes longer…'});
      const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js');
      env.allowLocalModels=false;env.useBrowserCache=true;env.backends.onnx.wasm.numThreads=1;
      classifier=await pipeline('image-classification','onnx-community/swin-finetuned-food101-ONNX',{
        device:'wasm',dtype:'q8',progress_callback:p=>{if(p.status==='progress')self.postMessage({type:'progress',message:'Downloading food model… '+Math.round(p.progress)+'%'});}
      });
    }
    self.postMessage({type:'progress',message:'Recognizing food on this device…'});
    const started=performance.now();const results=await classifier(data.image,{top_k:5});
    self.postMessage({type:'result',results,milliseconds:performance.now()-started});
  }catch(error){self.postMessage({type:'error',message:'Recognition could not finish. Check your connection and available memory, then try again. '+String(error.message||error).slice(0,140)});}
};
