"""Render the generated female anime pose sheets as instructional GIF/WebP loops.

Artwork comes from the built-in image generator. This only extracts the sprite
cells, aligns studio framing, adds the existing caption, and encodes animation.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import argparse, hashlib, importlib.util, json, shutil
import numpy as np

ROOT = Path(__file__).resolve().parent
WORK = ROOT.parent / 'female-refresh'
CATALOG = ROOT / 'dist' / 'exercises.json'
spec = importlib.util.spec_from_file_location('male_assembly', ROOT / 'assemble-anime-loops.py')
male = importlib.util.module_from_spec(spec)
spec.loader.exec_module(male)

def sprite_cells(path):
    sheet = Image.open(path).convert('RGB')
    w,h = sheet.size
    assert w%3==0 and h%2==0, (path,sheet.size)
    frames=[sheet.crop((i%3*w//3+4,i//3*h//2+4,(i%3+1)*w//3-4,(i//3+1)*h//2-4)).resize((512,512),Image.Resampling.LANCZOS) for i in range(6)]
    anchors=[]
    for f in frames:
        ys=np.where(np.max(np.asarray(f),axis=2)<105)[0]
        anchors.append(int(np.quantile(ys,.999)) if len(ys) else 480)
    target=max(anchors)
    return [Image.fromarray(np.asarray(f)[np.clip(np.arange(512)-max(-35,min(35,target-y)),0,511)]) for f,y in zip(frames,anchors)]

def make_loop(frames, cycle=False, pause_indices=None):
    if cycle:
        # A deliberate left/right alternating sequence returns directly to its
        # first pose instead of reversing the alternation.
        output=[];durations=[]
        pauses=set(pause_indices or (0,min(3,len(frames)-1)))
        assert all(0<=n<len(frames) for n in pauses)
        holds=[800 if n in pauses else 360 for n in range(len(frames))]
        transition_count=3*len(frames)
        budget=5200-sum(holds)
        assert budget>=10*transition_count
        base=(budget//transition_count)//10*10
        allocations=[base]*transition_count
        for n in range((budget-base*transition_count)//10):allocations[n%transition_count]+=10
        offset=0
        for n,(a,b) in enumerate(zip(frames,frames[1:]+frames[:1])):
            output.append(a);durations.append(holds[n])
            for t in (.25,.5,.75):output.append(Image.blend(a,b,t));durations.append(allocations[offset]);offset+=1
    else:
        output=[frames[0]];durations=[800]
        transition_count=3*(len(frames)-1)
        base=(1800//transition_count)//10*10
        allocations=[base]*transition_count
        for n in range((1800-base*transition_count)//10):allocations[n%transition_count]+=10
        for sequence in (frames,list(reversed(frames))):
            if sequence is not frames:output.append(frames[-1]);durations.append(800)
            offset=0
            for a,b in zip(sequence,sequence[1:]):
                for t in (.25,.5,.75):output.append(Image.blend(a,b,t));durations.append(allocations[offset]);offset+=1
    assert sum(durations)==5200 and min(durations)>0
    return output,durations

def caption(frame,item,footer):
    art=Image.fromarray(np.pad(np.asarray(frame),((0,0),(128,128),(0,0)),mode='edge'))
    canvas=Image.new('RGB',(768,620),'#f3f5f8');canvas.paste(art,(0,72));canvas.paste(footer,(0,584))
    d=ImageDraw.Draw(canvas);size=30
    while size>19:
        font=ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf',size)
        if d.textbbox((0,0),item['name'].upper(),font=font)[2]<734:break
        size-=1
    d.text((384,36),item['name'].upper(),font=font,fill='#1b2028',anchor='mm')
    return canvas

def encode(item):
    source=WORK/'generated'/(item['id']+'.png')
    frames=sprite_cells(source)
    qa_path=WORK/'qa'/(item['id']+'.json')
    qa=json.loads(qa_path.read_text()) if qa_path.exists() else {}
    assert not qa.get('needs_repair'),(item['name'],'Artwork still needs repair')
    if 'cell_indices' in qa:
        indices=qa['cell_indices'];assert len(indices)>=2 and all(isinstance(n,int) and 0<=n<=5 for n in indices),(item['name'],qa)
        frames=[frames[n] for n in indices]
    elif 'peak_index' in qa:
        peak=int(qa['peak_index']);assert 1<=peak<=5,(item['name'],qa);frames=frames[:peak+1]
    output,durations=make_loop(frames,cycle=qa.get('cycle',False),pause_indices=qa.get('pause_indices'))
    with Image.open(ROOT/'dist'/item['image']) as reference:
        reference.seek(0);reference=reference.convert('RGB');w,h=reference.size
        footer=reference.crop((0,round(h*584/620),w,h)).resize((768,36),Image.Resampling.LANCZOS)
    output=[caption(f,item,footer) for f in output]
    stem='female-'+item['id'];gif=WORK/'gifs'/(stem+'.gif');gif.parent.mkdir(exist_ok=True)
    sample=Image.new('RGB',(768*3,620*2))
    for n,f in enumerate([caption(f,item,footer) for f in frames]):sample.paste(f,(n%3*768,n//3*620))
    palette=sample.quantize(colors=256,method=Image.Quantize.MEDIANCUT)
    indexed=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in output]
    indexed[0].save(gif,save_all=True,append_images=indexed[1:],duration=durations,loop=0,optimize=False,disposal=2)
    webp=ROOT/'dist/assets'/(stem+'.webp')
    compact=[f.resize((600,484),Image.Resampling.LANCZOS) for f in output]
    compact[0].save(webp,save_all=True,append_images=compact[1:],duration=durations,loop=0,quality=88,method=4,minimize_size=True)
    for path in (gif,webp):
        with Image.open(path) as im:
            hashes=set();ms=0
            for n in range(im.n_frames):
                im.seek(n);f=im.convert('RGB');f.load();hashes.add(hashlib.sha256(f.tobytes()).hexdigest());ms+=im.info.get('duration',0)
            assert im.n_frames>1 and len(hashes)>1 and im.info.get('loop')==0,path
            if path.suffix=='.gif':assert ms==5200,(path,ms)
    destination=ROOT/'animation-source/female/sheets';destination.mkdir(exist_ok=True)
    shutil.copy2(source,destination/source.name)
    prompt=WORK/'prompts'/(item['id']+'.txt')
    if prompt.exists():
        directory=ROOT/'animation-source/female/prompts';directory.mkdir(exist_ok=True);shutil.copy2(prompt,directory/prompt.name)
        for repair in (WORK/'prompts').glob(item['id']+'-repair*.txt'):
            shutil.copy2(repair,directory/repair.name)
    if qa_path.exists():
        directory=ROOT/'animation-source/female/qa';directory.mkdir(exist_ok=True);shutil.copy2(qa_path,directory/qa_path.name)
    item['variants']={'male':{'image':item['image'],'gif':item['gif']},'female':{'image':'assets/'+webp.name,'gif':'assets/'+gif.name,'style':'Anime keyframe loop','animation':{'keyframes':len(frames),'duration_ms':5200,'endpoint_pause_ms':800}}}
    print(item['name']+f' · female GIF {gif.stat().st_size//1024} KiB · WebP {webp.stat().st_size//1024} KiB',flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('ids',nargs='*');parser.add_argument('--force',action='store_true');options=parser.parse_args()
    items=json.loads(CATALOG.read_text(encoding='utf-8'))
    index_path=WORK/'render-index.json'
    rendered=json.loads(index_path.read_text()) if index_path.exists() else {}
    renderer_hash=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    count=0
    for item in items:
        if options.ids and item['id'] not in options.ids:continue
        source=WORK/'generated'/(item['id']+'.png')
        qa=WORK/'qa'/(item['id']+'.json')
        if qa.exists() and json.loads(qa.read_text()).get('needs_repair'):
            print('Waiting for artwork repair: '+item['name'],flush=True)
            continue
        signature={'source':hashlib.sha256(source.read_bytes()).hexdigest() if source.exists() else None,'qa':hashlib.sha256(qa.read_bytes()).hexdigest() if qa.exists() else None,'renderer':renderer_hash}
        if source.exists() and (options.force or 'female' not in item.get('variants',{}) or rendered.get(item['id'])!=signature):
            encode(item);count+=1
            temporary=CATALOG.with_suffix('.json.tmp')
            temporary.write_text(json.dumps(items,indent=2)+'\n',encoding='utf-8')
            temporary.replace(CATALOG)
            rendered[item['id']]=signature
            index_path.write_text(json.dumps(rendered,indent=2)+'\n',encoding='utf-8')
    print(f'Rendered {count}; female coverage {sum("female" in e.get("variants",{}) for e in items)}/{len(items)}',flush=True)
