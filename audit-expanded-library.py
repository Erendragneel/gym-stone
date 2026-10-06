"""Independently decode released animations and create visual review pages."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from collections import Counter
import argparse,hashlib,json,zipfile

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'animation-source/expansion-v16'
REVIEW=ROOT.parent/'exercise-expansion/review'
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def inspect(path,expected):
    seen=set();duration=0;frames=[]
    with Image.open(path)as image:
        assert image.size==(600,484),(path,image.size)
        assert image.info.get('loop')==0,path
        assert image.n_frames>=2,path
        for i in range(image.n_frames):
            image.seek(i);image.load();rgba=image.convert('RGBA')
            assert rgba.getchannel('A').getextrema()==(255,255),(path,'Transparent frame')
            seen.add(hashlib.sha256(rgba.tobytes()).hexdigest())
            duration+=image.info.get('duration',0)
            frames.append(rgba.convert('RGB'))
    assert len(seen)>=2,(path,'Motion missing')
    assert duration==expected,(path,duration,expected)
    return {'frames':len(frames),'distinct_frames':len(seen),'duration_ms':duration,'sha256':digest(path),'bytes':path.stat().st_size},frames
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--partial',action='store_true');args=parser.parse_args()
    jobs=read(SOURCE/'jobs.json');encoding=read(SOURCE/'encoding-audit.json')
    indexed={row['id']:row for row in encoding};assert len(indexed)==len(encoding)
    assert len(jobs)==250 and len({j['id']for j in jobs})==250
    assert len({j['name'].casefold()for j in jobs})==250
    if not args.partial:
        catalog=read(ROOT/'dist/exercises.json');original=read(ROOT.parent/'exercise-expansion/baseline-catalog.json')
        assert len(catalog)==425 and len({e['id']for e in catalog})==425
        assert [e for e in catalog if not e.get('expansion')]==original
        assert len(indexed)==250
        new=[e for e in catalog if e.get('expansion')]
        assert len(new)==250 and {e['id']for e in new}==set(indexed)
        assert all(e['tracking']in('time','reps') and e['difficulty']in('Beginner','Intermediate','Advanced') and e['equipment']for e in new)
        assert all(not e.get('defaultMinutes') and not e.get('prenatal') and not e.get('phase')for e in new)
    REVIEW.mkdir(parents=True,exist_ok=True)
    report=[];contacts=[]
    for job in jobs:
        if job['id']not in indexed:continue
        encoded=indexed[job['id']];sheet=SOURCE/'sheets'/(job['id']+'.png');qa=read(sheet.with_suffix('.json'))
        assert qa.get('reviewed')is True and qa.get('review')
        assert sheet.with_suffix('.txt').read_text(encoding='utf-8').strip()
        with Image.open(sheet)as image:
            image.load();assert abs(image.width/image.height-1.5)<.02,(job['id'],image.size)
        row={'id':job['id'],'name':job['name'],'variants':{}};pictures=[]
        for gender in('male','female'):
            variant=encoded['variants'][gender];animation=variant['animation'];assert animation['framing']=='Complete source cell with 40px safety margin'
            cells=qa['cell_indices'][gender];assert len(set(cells))>=2
            assert all(0<=i<=2 for i in cells)if gender=='male'else all(3<=i<=5 for i in cells)
            durations=qa.get('durations',[650,450,900,450]);durations=durations.get(gender)if isinstance(durations,dict)else durations
            assert sum(durations)==animation['duration_ms']
            for kind,key in(('gif','gif'),('webp','image')):
                path=ROOT/'dist'/variant[key];info,frames=inspect(path,animation['duration_ms'])
                assert info['sha256']==encoded['formats'][gender][kind]['sha256'],path
                row['variants'][gender+'_'+kind]=info
                if kind=='gif':pictures.extend([frames[0],frames[1]])
        contacts.append((job['name'],pictures));report.append(row)
    font=ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf',18)
    small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',14)
    for page in range((len(contacts)+7)//8):
        selected=contacts[page*8:page*8+8]
        contact=Image.new('RGB',(1280,len(selected)*284+40),'#ffffff');draw=ImageDraw.Draw(contact)
        for col,label in enumerate(['Male start','Male endpoint','Female start','Female endpoint']):draw.text((col*320+10,5),label,font=font,fill='black')
        for row,(name,pictures)in enumerate(selected):
            y=40+row*284;draw.text((10,y),name,font=font,fill='black')
            for col,picture in enumerate(pictures):
                picture.thumbnail((310,250));contact.paste(picture,(col*320+5,y+28))
        contact.save(REVIEW/('animations-%02d.png'%(page+1)))
    if not args.partial:
        archive=ROOT.parent/'Gym_Stone_250_New_Exercise_GIFs_v1.6.zip'
        with zipfile.ZipFile(archive)as zipped:
            assert zipped.testzip()is None
            gifs=[n for n in zipped.namelist()if n.endswith('.gif')];assert len(gifs)==500 and len(set(gifs))==500
            bundled=json.loads(zipped.read('catalog.json'));assert bundled==new
            for exercise in new:
                for gender in('male','female'):
                    file=ROOT/'dist'/exercise['variants'][gender]['gif'];name=gender+'/'+file.name
                    assert hashlib.sha256(zipped.read(name)).hexdigest()==digest(file),name
        (SOURCE/'decoded-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'exercises':len(report),'decoded_files':len(report)*4,'contact_pages':(len(report)+7)//8,'groups':dict(Counter(j['group']for j in jobs)),'full_release_verified':not args.partial}))
if __name__=='__main__':main()
