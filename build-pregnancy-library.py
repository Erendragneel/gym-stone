"""Encode reviewed prenatal pose sheets; preserve all generated cell pixels."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import importlib.util
import json
import shutil
import zipfile

ROOT = Path(__file__).resolve().parent
WORK = ROOT.parent / 'pregnancy-refresh'
SOURCE = ROOT / 'animation-source/pregnancy'
ASSETS = ROOT / 'dist/assets'
CATALOG = ROOT / 'dist/exercises.json'
ARCHIVE = ROOT.parent / 'Gym_Stone_Pregnancy_GIFs_v1.5.zip'
EXPECTED = 14
SIZE = (600, 484)
FRAMING = 'Complete source cell with 40px safety margin'


def load_framing():
    spec = importlib.util.spec_from_file_location('pregnancy_framing', ROOT / 'sprite-framing.py')
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def animation_plan(qa):
    indices = list(qa.get('cell_indices', range(6)))
    assert len(indices) >= 2 and all(type(i) is int and 0 <= i < 6 for i in indices), indices
    if qa.get('reverse'):
        indices += indices[-2:0:-1]
    durations = list(qa.get('durations', [550] * len(indices)))
    assert len(indices) == len(durations), (indices, durations)
    # GIF stores hundredths of a second. Reject timing that would silently round.
    assert all(type(d) is int and d >= 20 and d % 10 == 0 for d in durations), durations
    return indices, durations


def font(size, bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf' if bold else 'C:/Windows/Fonts/segoeui.ttf', size)


def wrap_text(text, chosen_font, max_width):
    lines, current = [], ''
    for word in text.split():
        candidate = (current + ' ' + word).strip()
        if chosen_font.getlength(candidate) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def fit_text(text, max_width, max_height, preferred_size, max_lines, bold=False):
    for size in range(preferred_size, 11, -1):
        chosen_font = font(size, bold)
        lines = wrap_text(text, chosen_font, max_width)
        step = size + 2
        if len(lines) <= max_lines and len(lines) * step <= max_height and all(chosen_font.getlength(line) <= max_width for line in lines):
            return chosen_font, lines, step
    raise ValueError('Caption will not fit: ' + text)


def draw_caption(draw, text, center_y, max_height, preferred_size, max_lines, bold=False):
    chosen_font, lines, step = fit_text(text, 736, max_height, preferred_size, max_lines, bold)
    for index, line in enumerate(lines):
        y = center_y + (index - (len(lines) - 1) / 2) * step
        draw.text((384, y), line, fill='#1b2028' if bold else '#555555', font=chosen_font, anchor='mm')


def canvas(frame, job):
    result = Image.new('RGB', (768, 620), '#f3f5f8')
    result.paste(frame, (128, 72))
    draw = ImageDraw.Draw(result)
    draw_caption(draw, job['name'].upper(), 36, 64, 27, 2, bold=True)
    cues = job.get('cues', [])
    cue = cues[0] if isinstance(cues, list) and cues else str(cues or 'Move comfortably and breathe normally')
    if job.get('sides') == 'both':
        cue += ' · Switch sides'
    draw_caption(draw, cue, 602, 34, 17, 2)
    return result.resize(SIZE, Image.Resampling.LANCZOS)


def inspect_animation(path, expected_duration):
    hashes, duration = set(), 0
    with Image.open(path) as animation:
        assert animation.size == SIZE, (path, animation.size)
        assert animation.info.get('loop') == 0, path
        for index in range(animation.n_frames):
            animation.seek(index)
            animation.load()
            hashes.add(hashlib.sha256(animation.convert('RGB').tobytes()).hexdigest())
            duration += animation.info.get('duration', 0)
        assert animation.n_frames > 1 and len(hashes) > 1, path
        assert duration == expected_duration, (path, duration, expected_duration)
        return {'format': path.suffix[1:], 'frames': animation.n_frames, 'distinct_frames': len(hashes), 'duration_ms': duration, 'size': list(animation.size), 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def prepared_jobs():
    jobs, manifest = read_json(WORK / 'jobs.json'), read_json(WORK / 'generated-index.json')
    assert len(jobs) == EXPECTED, ('Expected 14 prenatal moves', len(jobs))
    assert len({job['id'] for job in jobs}) == EXPECTED
    assert len(manifest) == EXPECTED and len({item['id'] for item in manifest}) == EXPECTED, 'Require one reviewed sheet for each prenatal move'
    entries = {item['id']: item for item in manifest}
    assert set(entries) == {job['id'] for job in jobs}
    prepared = []
    for job in jobs:
        entry = entries[job['id']]
        path = Path(entry['path'])
        assert path.is_file(), path
        assert entry.get('prompt'), ('Missing image prompt', job['id'])
        qa = entry.get('qa', {})
        indices, durations = animation_plan(qa)
        with Image.open(path) as image:
            image.load()
            assert image.width >= 768 and image.height >= 512 and abs(image.width / image.height - 1.5) < 0.02, (path, image.size)
        # Preflight every caption before writing any assets or catalog records.
        canvas(Image.new('RGB', (512, 512), 'white'), job)
        prepared.append((job, entry, path, qa, indices, durations))
    return prepared


def package(items, report):
    sources = [{'id': item['id'], 'name': item['name'], 'guidanceUrl': item.get('guidanceUrl', '')} for item in items]
    readme = '''Gym Stone Pregnancy GIF Library — v1.5

14 prenatal exercise demonstrations, with one fixed prenatal character.
These are general library options, not a personalized exercise prescription.
Not every exercise is appropriate for every pregnancy. Ask your prenatal
clinician or physiotherapist to tailor activity to your pregnancy, symptoms,
experience and any medical restrictions. Stop an exercise if it causes pain,
discomfort or warning symptoms; seek advice from your maternity care team.

Use stable supports, a comfortable movement range, light resistance where
shown, and normal breathing. Stay hydrated and avoid overheating. The GIF
playback duration demonstrates movement and does not prescribe session time.
App tracking defaults to sets/reps for strength and minutes for timed activity;
exercise quantities must be entered by the person logging their activity.

catalog.json contains exercise cues, adjustments and tracking modes.
sources.json links to primary prenatal guidance used to review the movements.
encoding-audit.json records complete-frame decoding, timing and asset hashes.
Generated source art, prompts and reviewed cell/timing choices are preserved
in the GitHub source repository under animation-source/pregnancy.

General guidance:
https://www.acog.org/womens-health/faqs/exercise-during-pregnancy
https://www.nhs.uk/pregnancy/keeping-well/exercise/
'''
    with zipfile.ZipFile(ARCHIVE, 'w', zipfile.ZIP_DEFLATED) as out:
        for item in items:
            gif = ROOT / 'dist' / item['gif']
            out.write(gif, 'gifs/' + gif.name)
        out.writestr('catalog.json', json.dumps(items, indent=2, ensure_ascii=False))
        out.writestr('sources.json', json.dumps(sources, indent=2, ensure_ascii=False))
        out.writestr('encoding-audit.json', json.dumps(report, indent=2))
        out.writestr('README.md', readme)
    with zipfile.ZipFile(ARCHIVE) as check:
        assert check.testzip() is None
        assert len([name for name in check.namelist() if name.endswith('.gif')]) == EXPECTED


def main():
    prepared = prepared_jobs()
    framing = load_framing()
    SOURCE.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    items, report = [], []
    for job, entry, path, qa, indices, durations in prepared:
        source = SOURCE / (job['id'] + '.png')
        if path.resolve() != source.resolve():
            shutil.copy2(path, source)
        (SOURCE / (job['id'] + '.txt')).write_text(entry['prompt'], encoding='utf-8')
        write_json(SOURCE / (job['id'] + '.json'), qa)
        cells = framing.cells(source)
        canvases = [canvas(cells[index], job) for index in indices]
        sample = Image.new('RGB', (SIZE[0] * 3, SIZE[1] * 2), '#f3f5f8')
        for index, frame in enumerate(canvases[:6]):
            sample.paste(frame, (index % 3 * SIZE[0], index // 3 * SIZE[1]))
        palette = sample.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
        indexed = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in canvases]
        gif = ASSETS / (job['id'] + '.gif')
        webp = gif.with_suffix('.webp')
        indexed[0].save(gif, save_all=True, append_images=indexed[1:], duration=durations, loop=0, disposal=2, optimize=False)
        canvases[0].save(webp, save_all=True, append_images=canvases[1:], duration=durations, loop=0, quality=88, method=4, minimize_size=True)
        info = {'keyframes': len(indices), 'duration_ms': sum(durations), 'framing': FRAMING}
        variant = {'image': 'assets/' + webp.name, 'gif': 'assets/' + gif.name, 'style': 'Anime prenatal pose loop', 'animation': info}
        item = {key: value for key, value in job.items() if key not in ('poses', 'defaultMinutes', 'variants', 'image', 'gif', 'animation')}
        item.update(prenatal=True, group='Pregnancy', image=variant['image'], gif=variant['gif'], variants={'male': dict(variant), 'female': dict(variant)})
        assert item['tracking'] in ('reps', 'time')
        with Image.open(source) as sheet:
            grid_size = list(sheet.size)
        report.append({'id': job['id'], 'source_grid_size': grid_size, 'cell_sequence': indices, 'frame_durations_ms': durations, 'gif': inspect_animation(gif, sum(durations)), 'webp': inspect_animation(webp, sum(durations))})
        items.append(item)
        print('Encoded ' + job['name'], flush=True)
    catalog = read_json(CATALOG)
    ids = {item['id'] for item in items}
    catalog = [item for item in catalog if item['id'] not in ids] + items
    write_json(CATALOG, catalog)
    write_json(SOURCE / 'encoding-audit.json', report)
    package(items, report)
    print(json.dumps({'catalog_exercises': len(catalog), 'prenatal_exercises': len(items), 'archive': str(ARCHIVE)}))


if __name__ == '__main__':
    main()
