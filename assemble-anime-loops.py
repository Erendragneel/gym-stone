"""Package generated anime keyframe sheets into the app's GIF/WebP library.

All character artwork is generated with the built-in image tool. This script
only separates sprite cells, registers their framing, adds catalog captions,
and encodes the slow instructional loops used by the supplied collection.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import argparse, hashlib, json, importlib.util
import numpy as np

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'animation-source' / 'sheets'
EXPORT = ROOT.parent / 'anime-refresh' / 'gifs'
ASSETS = ROOT / 'dist' / 'assets'
CATALOG = ROOT / 'dist' / 'exercises.json'
FONT = 'C:/Windows/Fonts/seguisb.ttf'
REGULAR = 'C:/Windows/Fonts/segoeui.ttf'
CUES = {
 'push-up':'Keep your body aligned; lower and press with control',
 'close-grip-push-up':'Keep hands close and elbows near your sides',
 'dumbbell-bench-press':'Keep feet planted; press smoothly above your chest',
 'dumbbell-chest-fly':'Keep elbows softly bent; use a comfortable range',
 'overhead-dumbbell-triceps-extension':'Keep upper arms steady; bend and straighten the elbows',
 'cable-triceps-pushdown':'Keep elbows beside your torso; move at the elbows',
 'dumbbell-triceps-kickback':'Keep the upper arm still; extend your elbow',
 'bench-dip':'Keep shoulders comfortable; use a controlled range',
 'bodyweight-squat':'Keep heels planted; let knees follow your toes',
 'barbell-back-squat':'Keep feet planted and the bar steady; use a comfortable depth',
 'barbell-front-squat':'Keep elbows lifted and heels planted; move with control',
 'forward-lunge':'Keep the front foot planted; lower with control',
 'leg-extension':'Keep your hips supported; extend without swinging',
 'prone-leg-curl':'Keep hips on the bench; bend the knees with control',
 'bodyweight-hip-hinge':'Send hips back; keep your spine aligned',
 'standing-calf-raise':'Keep the forefoot grounded; raise and lower your heels',
 'standing-dumbbell-calf-raise':'Keep weights steady; rise through the forefoot',
 'crunch':'Lift your shoulders gently; avoid pulling on your neck',
 'lying-leg-raise':'Move your legs with control; keep your torso steady',
 'dead-bug':'Extend the opposite arm and leg; keep your torso steady',
 'bird-dog':'Reach with opposite arm and leg; keep hips level',
 'seated-wrist-curl':'Support your forearms; move only through your wrists',
 'seated-reverse-wrist-curl':'Keep palms down and forearms supported; extend the wrists',
 'jumping-jack':'Open and close with control; land softly',
 'mountain-climber':'Keep hands planted; bring one knee forward with control',
 'lateral-band-walk':'Keep knees softly bent; take small steps with band tension',
 'incline-dumbbell-curl':'Keep your back supported and upper arms steady',
}

def cells(path):
    spec=importlib.util.spec_from_file_location('sprite_framing',ROOT/'sprite-framing.py')
    framing=importlib.util.module_from_spec(spec);spec.loader.exec_module(framing)
    return framing.cells(path)

def caption(frame,name,cue):
    art=frame.resize((512,512),Image.Resampling.LANCZOS)
    # Edge padding preserves the supplied collection's landscape framing
    # without stretching the athlete or changing body proportions.
    art=Image.fromarray(np.pad(np.asarray(art),((0,0),(128,128),(0,0)),mode='edge'))
    result=Image.new('RGB',(768,620),'#f3f5f8')
    result.paste(art,(0,72))
    draw=ImageDraw.Draw(result)
    size=30
    while size>19:
        font=ImageFont.truetype(FONT,size)
        if draw.textbbox((0,0),name.upper(),font=font)[2]<734:break
        size-=1
    draw.text((384,36),name.upper(),font=font,fill='#1b2028',anchor='mm')
    small=ImageFont.truetype(REGULAR,17)
    draw.text((384,602),cue,font=small,fill='#545963',anchor='mm')
    return result

def loop(frames):
    # Match the reference chat's 5.2s cycle, including 0.8s endpoint pauses.
    # Three short transitions per keyframe interval keep the reference's
    # gentle dissolve cadence. Character poses come from generated artwork.
    output=[frames[0]]; durations=[800]
    for a,b in zip(frames,frames[1:]):
        for t in [.25,.5,.75]:
            output.append(Image.blend(a,b,t));durations.append(120)
    output.append(frames[-1]);durations.append(800)
    reverse=list(reversed(frames))
    for a,b in zip(reverse,reverse[1:]):
        for t in [.25,.5,.75]:
            output.append(Image.blend(a,b,t));durations.append(120)
    assert sum(durations)==5200
    return output,durations

def encode(item):
    slug=item['id'].removeprefix('guide-')
    frames=cells(SOURCE/(slug+'.png'))
    output,durations=loop(frames)
    output=[caption(f,item['name'],CUES[slug]) for f in output]
    EXPORT.mkdir(parents=True,exist_ok=True)
    gif=EXPORT/('anime-'+slug+'.gif')
    # One palette for the whole cycle avoids color flicker between poses.
    palette_sheet=Image.new('RGB',(768*3,620*2))
    for i,frame in enumerate([caption(f,item['name'],CUES[slug]) for f in frames]):
        palette_sheet.paste(frame,(i%3*768,i//3*620))
    palette=palette_sheet.quantize(colors=256,method=Image.Quantize.MEDIANCUT)
    indexed=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in output]
    indexed[0].save(gif,save_all=True,append_images=indexed[1:],duration=durations,loop=0,optimize=False,disposal=2)
    webp=ASSETS/('anime-'+slug+'.webp')
    compact=[]
    for f in output:
        f=f.copy();f.thumbnail((600,600),Image.Resampling.LANCZOS);compact.append(f)
    compact[0].save(webp,save_all=True,append_images=compact[1:],duration=durations,loop=0,quality=88,method=4,minimize_size=True)
    for path in [gif,webp]:
        with Image.open(path) as im:
            digests=set();ms=0
            for i in range(im.n_frames):
                im.seek(i);rgb=im.convert('RGB');rgb.load()
                digests.add(hashlib.sha256(rgb.tobytes()).hexdigest())
                ms+=im.info.get('duration',0)
            assert im.n_frames>1 and len(digests)>1 and im.info.get('loop')==0,path
            if path.suffix=='.gif':assert ms==5200,(path,ms)
    old=ASSETS/Path(item['image']).name
    item.update(image='assets/'+webp.name,gif='assets/'+gif.name,style='Anime keyframe loop',animation={'keyframes':6,'duration_ms':5200,'endpoint_pause_ms':800})
    if old!=webp and old.name.startswith('guide-') and old.is_file():
        assert old.resolve().parent==ASSETS.resolve()
        old.unlink()
    print(item['name']+f' · GIF {gif.stat().st_size//1024} KiB · WebP {webp.stat().st_size//1024} KiB',flush=True)

if __name__=='__main__':
    args=argparse.ArgumentParser();args.add_argument('slugs',nargs='*');options=args.parse_args()
    items=json.loads(CATALOG.read_text(encoding='utf-8-sig'))
    chosen=[e for e in items if e['id'].startswith('guide-') and (not options.slugs or e['id'].removeprefix('guide-') in options.slugs)]
    for e in chosen:encode(e)
    CATALOG.write_text(json.dumps(items,indent=2)+'\n',encoding='utf-8')
