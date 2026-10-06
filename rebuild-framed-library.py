"""Encode selected ImageGen pose repairs and native sources as GIF/WebP loops.

Character edits are made with ImageGen. This packages their native 3x2 pose
grids, preserving every cell, timing, captions and stable exercise IDs.
"""
from pathlib import Path
from PIL import Image
import argparse, hashlib, importlib.util, json, shutil

ROOT = Path(__file__).resolve().parent
WORK = ROOT.parent / 'gif-review'

def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result

framing = module('framing', ROOT / 'sprite-framing.py')
female = module('female', ROOT / 'assemble-female-loops.py')

def encode(item, gender, source, qa):
    variant = item['variants'][gender]
    with Image.open(ROOT/'dist'/variant['image']) as old:
        old.seek(0)
        image=old.convert('RGB');w,h=image.size
        footer=image.crop((0,round(h*584/620),w,h)).resize((768,36),Image.Resampling.LANCZOS)
    frames=framing.cells(source)
    if 'cell_indices' in qa:frames=[frames[n] for n in qa['cell_indices']]
    elif 'peak_index' in qa:frames=frames[:qa['peak_index']+1]
    output,durations=female.make_loop(frames,cycle=qa.get('cycle',False),pause_indices=qa.get('pause_indices'))
    output=[female.caption(frame,item,footer) for frame in output]
    stem=Path(variant['image']).stem
    folder=WORK/'gifs'/gender;folder.mkdir(parents=True,exist_ok=True)
    gif=folder/(stem+'.gif')
    palette_sample=Image.new('RGB',(768*3,620*2))
    for n,frame in enumerate([female.caption(frame,item,footer) for frame in frames]):palette_sample.paste(frame,(n%3*768,n//3*620))
    palette=palette_sample.quantize(colors=256,method=Image.Quantize.MEDIANCUT)
    indexed=[frame.quantize(palette=palette,dither=Image.Dither.NONE) for frame in output]
    indexed[0].save(gif,save_all=True,append_images=indexed[1:],duration=durations,loop=0,disposal=2,optimize=False)
    webp=ROOT/'dist'/variant['image']
    compact=[frame.resize((600,484),Image.Resampling.LANCZOS) for frame in output]
    compact[0].save(webp,save_all=True,append_images=compact[1:],duration=durations,loop=0,quality=88,method=4,minimize_size=True)
    variant.update(style='Anime keyframe loop',animation={'keyframes':len(frames),'duration_ms':5200,'endpoint_pause_ms':800,'framing':'Complete source cell with 40px safety margin'})
    return {'id':item['id'],'gender':gender,'gif':str(gif),'image':variant['image'],'source':str(source),'sha256':hashlib.sha256(webp.read_bytes()).hexdigest()}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--native',action='store_true');options=parser.parse_args()
    catalog=ROOT/'dist/exercises.json';items=json.loads(catalog.read_text(encoding='utf-8'))
    manifest=WORK/'generated-index.json'
    generated=json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else []
    destination=ROOT/'animation-source/framing-repairs';destination.mkdir(exist_ok=True)
    report_path=WORK/'rebuild-index.json';report=json.loads(report_path.read_text()) if report_path.exists() else {}
    for job in generated:
        target=destination/(job['id']+'.png')
        shutil.copy2(job['path'],target)
        (destination/(job['id']+'.txt')).write_text(job['prompt'],encoding='utf-8')
        (destination/(job['id']+'.json')).write_text(json.dumps(job.get('qa',{}),indent=2),encoding='utf-8')
    count=0
    for item in items:
        for gender in ['male','female']:
            source=None;qa={}
            job=next((j for j in generated if j['id']==item['id'] and j['gender']==gender),None)
            if job:
                source=destination/(item['id']+'.png');qa=job.get('qa',{})
            elif options.native and gender=='female':
                source=ROOT/'animation-source/female/sheets'/(item['id']+'.png')
                qa_file=ROOT/'animation-source/female/qa'/(item['id']+'.json')
                qa=json.loads(qa_file.read_text()) if qa_file.exists() else {}
            elif options.native and gender=='male' and item['id'].startswith('guide-'):
                source=ROOT/'animation-source/sheets'/(item['id'].removeprefix('guide-')+'.png')
            if not source or not source.exists():continue
            signature=hashlib.sha256(source.read_bytes()+(json.dumps(qa,sort_keys=True)+Path(__file__).read_text()+ (ROOT/'sprite-framing.py').read_text()).encode()).hexdigest()
            key=gender+':'+item['id']
            if report.get(key,{}).get('signature')==signature:continue
            result=encode(item,gender,source,qa);result['signature']=signature;report[key]=result
            catalog.write_text(json.dumps(items,indent=2)+'\n',encoding='utf-8')
            report_path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
            count+=1;print(gender+' · '+item['name'],flush=True)
    print('Rebuilt '+str(count)+' animations',flush=True)
