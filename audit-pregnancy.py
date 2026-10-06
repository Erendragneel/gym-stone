"""Independently decode every prenatal animation and render its endpoints."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import importlib.util
import io
import json
import zipfile

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / 'pregnancy-refresh'
SOURCE = ROOT / 'animation-source/pregnancy'
ARCHIVE = ROOT.parent / 'Gym_Stone_Pregnancy_GIFs_v1.5.zip'
SIZE = (600, 484)
EXPECTED = 14


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def decode(source, expected_duration):
    with Image.open(source) as animation:
        assert animation.size == SIZE, animation.size
        assert animation.info.get('loop') == 0
        frames, durations = [], []
        for index in range(animation.n_frames):
            animation.seek(index)
            animation.load()
            frames.append(animation.convert('RGB'))
            durations.append(animation.info.get('duration', 0))
    assert len(frames) > 1
    unique = len({hashlib.sha256(frame.tobytes()).hexdigest() for frame in frames})
    assert unique > 1, 'Prenatal animation must contain visible movement'
    assert all(duration > 0 for duration in durations), durations
    assert sum(durations) == expected_duration, (sum(durations), expected_duration)
    return frames, {'frames': len(frames), 'distinct_frames': unique, 'duration_ms': sum(durations), 'frame_durations_ms': durations, 'size': list(frames[0].size)}


def main():
    spec = importlib.util.spec_from_file_location('pregnancy_builder', ROOT / 'build-pregnancy-library.py')
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    jobs = read_json(OUT / 'jobs.json')
    items = [item for item in read_json(ROOT / 'dist/exercises.json') if item.get('prenatal')]
    assert len(items) == EXPECTED and len(jobs) == EXPECTED, (len(items), len(jobs))
    assert {item['id'] for item in items} == {job['id'] for job in jobs}
    indexed = {item['id']: item for item in items}
    items = [indexed[job['id']] for job in jobs]
    sheet = Image.new('RGB', (1000, len(items) * 280), 'white')
    draw = ImageDraw.Draw(sheet)
    title_font = ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf', 17)
    label_font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 12)
    report = []
    for row, item in enumerate(items):
        assert item.get('prenatal') is True and item['group'] == 'Pregnancy'
        assert 'poses' not in item and 'defaultMinutes' not in item
        assert item['tracking'] in ('time', 'reps')
        assert item['variants']['male'] == item['variants']['female'], 'Use the same fixed prenatal character for both profile choices'
        variant = item['variants']['female']
        assert item['image'] == variant['image'] and item['gif'] == variant['gif']
        assert variant['animation']['framing'] == builder.FRAMING
        source = SOURCE / (item['id'] + '.png')
        with Image.open(source) as art:
            art.load()
            assert art.width >= 768 and art.height >= 512 and abs(art.width / art.height - 1.5) < 0.02, (source, art.size)
            grid = list(art.size)
        assert (SOURCE / (item['id'] + '.txt')).read_text(encoding='utf-8').strip()
        qa = read_json(SOURCE / (item['id'] + '.json'))
        indices, durations = builder.animation_plan(qa)
        expected_duration = variant['animation']['duration_ms']
        assert expected_duration == sum(durations)
        assert variant['animation']['keyframes'] == len(indices)
        # Re-extract complete source cells to confirm the framing geometry itself.
        framed = builder.load_framing().cells(source)
        assert len(framed) == 6 and all(frame.size == (512, 512) for frame in framed)
        entry = {'id': item['id'], 'name': item['name'], 'tracking': item['tracking'], 'source_grid_size': grid, 'source_cell_count': len(framed), 'framing_margin_px': 40, 'cell_sequence': indices}
        for kind, key in [('gif', 'gif'), ('webp', 'image')]:
            path = ROOT / 'dist' / variant[key]
            frames, decoded = decode(path, expected_duration)
            decoded.update(bytes=path.stat().st_size, sha256=hashlib.sha256(path.read_bytes()).hexdigest())
            entry[kind] = decoded
            if kind == 'gif':
                y = row * 280
                draw.text((12, y + 5), item['name'] + ' · ' + ('Sets & reps' if item['tracking'] == 'reps' else 'Time'), fill='#16202a', font=title_font)
                for column, (label, index) in enumerate([('Start', 0), ('Middle', len(frames) // 2), ('End', len(frames) - 1)]):
                    draw.text((12 + column * 330, y + 28), label, fill='#526170', font=label_font)
                    frame = frames[index].copy()
                    frame.thumbnail((315, 230), Image.Resampling.LANCZOS)
                    sheet.paste(frame, (12 + column * 330 + (315 - frame.width) // 2, y + 47))
        report.append(entry)
    with zipfile.ZipFile(ARCHIVE) as archive:
        assert archive.testzip() is None
        names = [name for name in archive.namelist() if name.endswith('.gif')]
        assert len(names) == EXPECTED
        assert {Path(name).stem for name in names} == {item['id'] for item in items}
        for item in items:
            decode(io.BytesIO(archive.read('gifs/' + Path(item['gif']).name)), item['variants']['female']['animation']['duration_ms'])
        assert json.loads(archive.read('catalog.json')) == items
        assert len(json.loads(archive.read('sources.json'))) == EXPECTED
        assert 'Not every exercise is appropriate for every pregnancy.' in archive.read('README.md').decode('utf-8')
    sheet.save(OUT / 'final.jpg', quality=95)
    result = {'exercises': EXPECTED, 'decoded_gifs': EXPECTED, 'decoded_webps': EXPECTED, 'archive_sha256': hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(), 'entries': report}
    write_json(OUT / 'audit.json', result)
    write_json(SOURCE / 'decoded-audit.json', result)
    print('PASS: all 14 prenatal GIFs and WebPs decode completely, move, loop, preserve source grid framing and match reviewed timings; ZIP verified.')


if __name__ == '__main__':
    main()
