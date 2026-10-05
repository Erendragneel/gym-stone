"""Build and decode-audit the refreshed downloadable GIF library."""
from pathlib import Path
from PIL import Image
import hashlib, io, json, zipfile

root=Path(__file__).resolve().parent
catalog=json.loads((root/'dist/exercises.json').read_text(encoding='utf-8'))
original=root.parent/'Gym_Stone_Exercise_GIF_Library.zip'
output=root.parent/'Gym_Stone_Anime_Exercise_GIF_Library_v1.1.zip'
generated=root.parent/'anime-refresh/gifs'
report=[]
with zipfile.ZipFile(original) as source, zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED) as target:
    source_names={Path(n).name:n for n in source.namelist() if n.lower().endswith('.gif')}
    for e in catalog:
        filename=Path(e['gif']).name
        data=(generated/filename).read_bytes() if filename.startswith('anime-') else source.read(source_names[filename])
        digests=set();ms=0
        with Image.open(io.BytesIO(data)) as im:
            for i in range(im.n_frames):
                im.seek(i);frame=im.convert('RGB');frame.load()
                digests.add(hashlib.sha256(frame.tobytes()).hexdigest())
                ms+=im.info.get('duration',0)
            assert im.n_frames>1 and len(digests)>1 and im.info.get('loop')==0,e['name']
            frames=im.n_frames
        if filename.startswith('anime-'):assert ms==5200,(e['name'],ms)
        destination=e['group'].replace(' & ','_').replace(' ','_')+'/'+filename
        target.writestr(destination,data)
        report.append({'exercise':e['name'],'group':e['group'],'frames':frames,'unique_frames':len(digests),'duration_ms':ms,'file':e['image'],'gif':destination})
    assert len(report)==149 and sum(e['gif'].startswith('assets/anime-') for e in catalog)==27
    target.writestr('exercise-catalog.json',json.dumps(catalog,indent=2))
    target.writestr('animation-audit.json',json.dumps(report,indent=2))
    target.writestr('README.txt','Gym Stone Anime Exercise GIF Library v1.1\n149 exercises across 13 muscle groups.\n122 supplied anime animations plus 27 refreshed anime keyframe loops.\nThe refreshed loops use 5.2-second cycles, 0.8-second endpoint pauses, and form captions, matching the original reference collection.\nThis is a curated exercise library, not every possible movement or variation.\n')
(root/'gif-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
with zipfile.ZipFile(output) as check:
    assert check.testzip() is None
    assert sum(n.lower().endswith('.gif') for n in check.namelist())==149
print(f'PASS: 149 GIFs decoded and looped; 27 anime replacements; ZIP CRC verified; {output.stat().st_size/1024/1024:.1f} MB.\n{output}',flush=True)
