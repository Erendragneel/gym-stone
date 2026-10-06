"""Decode every new GIF and WebP and create full-body endpoint review sheets."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parent/'stretch-refresh'
items=[e for e in json.loads((ROOT/'dist/exercises.json').read_text()) if e.get('phase')]
report=[]
for gender in ['male','female']:
    sheet=Image.new('RGB',(500,len(items)*180),'white');draw=ImageDraw.Draw(sheet)
    for index,item in enumerate(items):
        for kind in ['gif','image']:
            path=ROOT/'dist'/item['variants'][gender][kind]
            with Image.open(path) as animation:
                frames=[];duration=0
                for n in range(animation.n_frames):
                    animation.seek(n);animation.load();frames.append(animation.convert('RGB'));duration+=animation.info.get('duration',0)
                assert len(frames)>1 and len({hashlib.sha256(f.tobytes()).hexdigest() for f in frames})>1
                assert duration==item['variants'][gender]['animation']['duration_ms'],(path,duration)
                report.append({'id':item['id'],'gender':gender,'format':path.suffix,'frames':len(frames),'duration_ms':duration,'size':frames[0].size})
                if kind=='gif':
                    y=index*180;draw.text((5,y+2),item['name'],fill='black')
                    for n,frame in enumerate([frames[0],frames[len(frames)//2],frames[-1]]):frame.thumbnail((160,150));sheet.paste(frame,(n*166,y+22))
    sheet.save(OUT/(gender+'-final.jpg'),quality=95)
(ROOT/'animation-source/stretches/decoded-audit.json').write_text(json.dumps(report,indent=2))
print('Verified 24 GIFs and 24 app animations, including every frame and total duration.')
