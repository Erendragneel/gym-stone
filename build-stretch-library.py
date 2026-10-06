"""Encode reviewed AI pose sheets as complete GIFs and compact app animations."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import importlib.util,json,hashlib,shutil,zipfile
ROOT=Path(__file__).resolve().parent
WORK=ROOT.parent/'stretch-refresh'
def module(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
framing=module('framing','sprite-framing.py')
jobs=json.loads((WORK/'jobs.json').read_text())
manifest=json.loads((WORK/'generated-index.json').read_text())
catalog_path=ROOT/'dist/exercises.json'
catalog=json.loads(catalog_path.read_text())
report=[]
for job in jobs:
    item={k:v for k,v in job.items() if k!='poses'}
    item['guidanceUrl']='https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/stretching/art-20047931'
    item['variants']={}
    for gender in ['male','female']:
        sourcejob=next((s for s in manifest if s['id']==job['id'] and s['gender']==gender),None)
        if not sourcejob:break
        directory=ROOT/'animation-source/stretches'/gender;directory.mkdir(parents=True,exist_ok=True)
        source=directory/(job['id']+'.png')
        shutil.copy2(sourcejob['path'],source)
        (directory/(job['id']+'.txt')).write_text(sourcejob['prompt'],encoding='utf-8')
        qa=sourcejob.get('qa',{})
        (directory/(job['id']+'.json')).write_text(json.dumps(qa,indent=2),encoding='utf-8')
        frames=framing.cells(source)
        indices=qa.get('cell_indices',list(range(6)))
        frames=[frames[n] for n in indices]
        if qa.get('reverse'):frames+=frames[-2:0:-1]
        durations=qa.get('durations',[550]*len(frames) if job['phase']=='warmup' else [500,400,2400,2400,400,500])
        assert len(durations)==len(frames)
        canvases=[]
        for frame in frames:
            canvas=Image.new('RGB',(768,620),'#f3f5f8')
            canvas.paste(frame,(128,72))
            draw=ImageDraw.Draw(canvas);font=ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf',27)
            draw.text((384,36),job['name'].upper(),fill='#1b2028',font=font,anchor='mm')
            cue=job['cues'][0]+(' · Switch sides' if job['sides']=='both' else '')
            draw.text((384,603),cue,fill='#555',font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',17),anchor='mm')
            canvases.append(canvas.resize((600,484),Image.Resampling.LANCZOS))
        stem=gender+'-'+job['id']
        gif=ROOT/'dist/assets'/(stem+'.gif');webp=gif.with_suffix('.webp')
        sample=Image.new('RGB',(600*3,484*2))
        for n,frame in enumerate(canvases[:6]):sample.paste(frame,(n%3*600,n//3*484))
        palette=sample.quantize(colors=256,method=Image.Quantize.MEDIANCUT)
        indexed=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in canvases]
        indexed[0].save(gif,save_all=True,append_images=indexed[1:],duration=durations,loop=0,disposal=2,optimize=False)
        canvases[0].save(webp,save_all=True,append_images=canvases[1:],duration=durations,loop=0,quality=88,method=4,minimize_size=True)
        for path in [gif,webp]:
            with Image.open(path) as animation:
                hashes=set()
                for n in range(animation.n_frames):animation.seek(n);animation.load();hashes.add(hashlib.sha256(animation.convert('RGB').tobytes()).hexdigest())
                assert animation.n_frames>1 and len(hashes)>1
                assert animation.info.get('loop')==0
        item['variants'][gender]={'image':'assets/'+webp.name,'gif':'assets/'+gif.name,'style':'Anime pose loop','animation':{'keyframes':len(frames),'duration_ms':sum(durations),'framing':'Complete source cell with 40px safety margin'}}
        report.append({'id':job['id'],'gender':gender,'gif_bytes':gif.stat().st_size,'sha256':hashlib.sha256(gif.read_bytes()).hexdigest()})
    if len(item['variants'])==2:
        item.update(image=item['variants']['male']['image'],gif=item['variants']['male']['gif'])
        catalog=[e for e in catalog if e['id']!=item['id']]+[item]
catalog_path.write_text(json.dumps(catalog,indent=2)+'\n',encoding='utf-8')
(ROOT/'animation-source/stretches/audit.json').write_text(json.dumps(report,indent=2))
if len(report)==24:
    archive=ROOT.parent/'Gym_Stone_Warmup_Cooldown_GIFs_v1.4.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as out:
        for job in jobs:
            for gender in ['male','female']:
                filename=gender+'-'+job['id']+'.gif';out.write(ROOT/'dist/assets'/filename,gender+'/'+filename)
        out.writestr('catalog.json',json.dumps([e for e in catalog if e.get('phase')],indent=2));out.writestr('audit.json',json.dumps(report,indent=2))
    with zipfile.ZipFile(archive) as check:assert check.testzip() is None
print(json.dumps({'catalog_exercises':len(catalog),'stretch_variants':len(report)}))
