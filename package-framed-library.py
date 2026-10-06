"""Package the repaired GIFs alongside unaffected originals; verify every frame."""
from pathlib import Path
from PIL import Image
import hashlib,io,json,zipfile
ROOT=Path(__file__).resolve().parent
WORK=ROOT.parent/'gif-review'
items=json.loads((ROOT/'dist/exercises.json').read_text())
archive=ROOT.parent/'Gym_Stone_Anime_Exercise_GIF_Library_v1.3.zip'
report=[]
with zipfile.ZipFile(ROOT.parent/'Gym_Stone_Anime_Exercise_GIF_Library_v1.1.zip') as old, zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as out:
    originals={Path(n).stem:n for n in old.namelist() if n.endswith('.gif')}
    for gender in ['male','female']:
        for item in items:
            stem=Path(item['variants'][gender]['image']).stem
            path=WORK/'gifs'/gender/(stem+'.gif')
            data=path.read_bytes() if path.exists() else old.read(originals[stem])
            with Image.open(io.BytesIO(data)) as image:
                assert image.n_frames>1,(gender,item['id'])
                duration=0
                for n in range(image.n_frames):
                    image.seek(n);image.load();duration+=image.info.get('duration',0)
                report.append({'id':item['id'],'gender':gender,'frames':image.n_frames,'duration_ms':duration,'sha256':hashlib.sha256(data).hexdigest()})
            out.writestr(gender+'/'+stem+'.gif',data)
    out.writestr('catalog.json',json.dumps(items,indent=2))
    out.writestr('audit.json',json.dumps(report,indent=2))
    out.writestr('README.txt','Gym Stone v1.3: 149 exercises, 298 male/female GIFs. Cutoff artwork replaced; complete sprite cells retained with safety margins. Illustrated keyframe loops with form captions. App supports sets/reps and timed activities. Previous ZIPs remain preserved.\n')
with zipfile.ZipFile(archive) as check:
    assert check.testzip() is None
    assert len([n for n in check.namelist() if n.endswith('.gif')])==298
(WORK/'gif-package-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'archive':str(archive),'gifs':len(report),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}))
