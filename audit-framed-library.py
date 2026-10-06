"""Decode every app animation and produce endpoint sheets for visual review."""
from pathlib import Path
from PIL import Image,ImageDraw
import hashlib,json
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parent/'gif-review'
items=json.loads((ROOT/'dist/exercises.json').read_text())
report=[]
for gender in ['male','female']:
    for start in range(0,len(items),20):
        sheet=Image.new('RGB',(1000,10*180),'white');draw=ImageDraw.Draw(sheet)
        for index,item in enumerate(items[start:start+20]):
            path=ROOT/'dist'/item['variants'][gender]['image']
            with Image.open(path) as animation:
                frames=[];duration=0
                for frame in range(animation.n_frames):
                    animation.seek(frame);frames.append(animation.convert('RGB'));duration+=animation.info.get('duration',0)
                assert len(frames)>1,(gender,item['id'],'static animation')
                assert len({hashlib.sha256(f.tobytes()).hexdigest() for f in frames})>1,(gender,item['id'],'no movement')
                report.append({'id':item['id'],'gender':gender,'frames':len(frames),'duration_ms':duration,'size':frames[0].size})
                x=index%2*500;y=index//2*180
                draw.text((x+5,y+2),item['name'],fill='black')
                for n,f in enumerate([frames[0],frames[len(frames)//2],frames[-1]]):
                    f.thumbnail((160,150));sheet.paste(f,(x+n*166,y+22))
        sheet.save(OUT/(gender+'-final-'+str(start//20)+'.jpg'),quality=94)
(OUT/'final-audit.json').write_text(json.dumps(report,indent=2))
print('Decoded '+str(len(report))+' animated variants with distinct movement frames.')
