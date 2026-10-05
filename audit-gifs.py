from pathlib import Path
from PIL import Image
import json,hashlib,zipfile,io
root=Path(__file__).parent
items=json.loads((root/'dist/exercises.json').read_text(encoding='utf-8-sig'))
unique={}
for e in items:
    if e['name'] in unique:
        other=unique[e['name']];other['groups']=list(dict.fromkeys(other.get('groups',[other['group']])+[e['group']]))
    else:unique[e['name']]=e
items=list(unique.values());(root/'dist/exercises.json').write_text(json.dumps(items,indent=2),encoding='utf-8')
report=[]
optimized=any(e['image'].endswith('.webp') for e in items)
archive_path=root.parent/'Gym_Stone_Anime_Exercise_GIF_Library_v1.1.zip'
if not archive_path.is_file():archive_path=root.parent/'Gym_Stone_Exercise_GIF_Library.zip'
archive=zipfile.ZipFile(archive_path) if optimized else None
for e in items:
    p=root/'dist'/e['image']
    if e['image'].endswith('.webp'):
        filename=Path(e['gif']).name
        archived=next(n for n in archive.namelist() if Path(n).name==filename)
        im=Image.open(io.BytesIO(archive.read(archived)))
    else:im=Image.open(p)
    digests=set();duration=0
    frames=[];durations=[];broken=False
    for frame in range(im.n_frames):
        try:
            im.seek(frame);rgb=im.convert('RGB');rgb.load();frames.append(rgb.copy());durations.append(im.info.get('duration',85));duration+=durations[-1];digests.add(hashlib.sha256(rgb.tobytes()).digest())
        except OSError:
            print('Damaged frame: '+e['name']+' at '+str(frame),flush=True);broken=True;break
    if broken:
        assert len(frames)>1,'Cannot recover animation for '+e['name']
        im.close();frames[0].save(p,save_all=True,append_images=frames[1:],duration=durations,loop=0,disposal=2,optimize=True);im=Image.open(p)
        print('Recovered '+e['name']+' using '+str(len(frames))+' valid frames.',flush=True)
    assert im.n_frames>1 and len(digests)>1,e['name']+' is not animated'
    assert im.info.get('loop')==0,e['name']+' does not loop'
    report.append({'exercise':e['name'],'group':e['group'],'frames':im.n_frames,'unique_frames':len(digests),'duration_ms':duration,'file':e['image']})
(root/'gif-audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
if archive:archive.close()
if not optimized:
 with zipfile.ZipFile(root.parent/'Gym_Stone_Exercise_GIF_Library.zip','w',compression=zipfile.ZIP_DEFLATED) as z:
    for e in items:z.write(root/'dist'/e['image'],e['group'].replace(' & ','_')+'/'+Path(e['image']).name)
    z.write(root/'dist/exercises.json','exercise-catalog.json');z.write(root/'gif-audit.json','animation-audit.json')
    z.writestr('README.txt',f'Gym Stone Exercise Library\n{len(items)} exercise GIFs across all major muscle groups.\nOriginal supplied anime GIFs plus newly created simplified illustrated loops.\nThis is a curated library, not an exhaustive catalog of every possible exercise or variation.\nIllustrated loops are movement diagrams, not personalized form coaching.\n')
print(f'PASS: {len(items)} exercise files decode, animate and loop. Download ZIP preserved.')
