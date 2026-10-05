"""Validate real media, catalog compatibility, and provenance of both characters."""
from pathlib import Path
from PIL import Image
import hashlib,json,subprocess

root=Path(__file__).resolve().parent
work=root.parent/'female-refresh'
items=json.loads((root/'dist/exercises.json').read_text(encoding='utf-8'))
baseline=json.loads(subprocess.check_output(['git','show','HEAD:dist/exercises.json'],cwd=root))
assert len(items)==149 and len({e['id'] for e in items})==149
for before,after in zip(baseline,items):
    for key in ('id','name','group','groups','image','gif'):
        assert before.get(key)==after.get(key),(after['id'],key)

def webp_timing(path):
    data=path.read_bytes();assert data[:4]==b'RIFF' and data[8:12]==b'WEBP'
    pos=12;times=[];loop=None
    while pos+8<=len(data):
        kind=data[pos:pos+4];size=int.from_bytes(data[pos+4:pos+8],'little');body=data[pos+8:pos+8+size]
        if kind==b'ANIM':loop=int.from_bytes(body[4:6],'little')
        if kind==b'ANMF':times.append(int.from_bytes(body[12:15],'little'))
        pos+=8+size+(size%2)
    assert loop==0 and len(times)>1 and sum(times)==5200,(path,loop,times)
    return times

audit=[]
rendered=json.loads((work/'render-index.json').read_text(encoding='utf-8'))
renderer_hash=hashlib.sha256((root/'assemble-female-loops.py').read_bytes()).hexdigest()
for item in items:
    variant=item.get('variants',{}).get('female');assert variant,item['id']
    assert item['variants']['male']=={'image':item['image'],'gif':item['gif']}
    assert variant['image']=='assets/female-'+item['id']+'.webp'
    source=root/'animation-source/female/sheets'/(item['id']+'.png')
    prompt=root/'animation-source/female/prompts'/(item['id']+'.txt')
    assert source.is_file() and prompt.is_file() and prompt.stat().st_size>50
    qa=root/'animation-source/female/qa'/(item['id']+'.json')
    assert qa.is_file(),(item['id'],'Missing motion review')
    assert not json.loads(qa.read_text(encoding='utf-8')).get('needs_repair'),(item['id'],'Unrepaired artwork')
    assert source.read_bytes()==(work/'generated'/(item['id']+'.png')).read_bytes(),(item['id'],'Artwork changed after export')
    assert rendered[item['id']]=={'source':hashlib.sha256(source.read_bytes()).hexdigest(),'qa':hashlib.sha256(qa.read_bytes()).hexdigest(),'renderer':renderer_hash},(item['id'],'Stale export')
    with Image.open(source) as sheet:assert sheet.width%3==0 and sheet.height%2==0
    gif=work/'gifs'/('female-'+item['id']+'.gif');webp=root/'dist'/variant['image']
    entry={'id':item['id'],'name':item['name'],'keyframes':variant['animation']['keyframes']}
    for path in (gif,webp):
        with Image.open(path) as im:
            distinct=set();duration=0
            for n in range(im.n_frames):
                im.seek(n);frame=im.convert('RGB');frame.load();distinct.add(hashlib.sha256(frame.tobytes()).hexdigest());duration+=im.info.get('duration',0)
            assert im.n_frames>1 and len(distinct)>1 and im.info.get('loop')==0,path
            if path.suffix=='.gif':assert duration==5200,(path,duration)
            else:webp_timing(path)
            entry[path.suffix[1:]]={'frames':im.n_frames,'distinct_frames':len(distinct),'duration_ms':5200,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size}
    audit.append(entry)
(root/'female-animation-audit.json').write_text(json.dumps(audit,indent=2)+'\n',encoding='utf-8')
print('PASS: 149 female GIF/WebP pairs, decoded unique frames, 5.2-second infinite loops, all male references and exercise history IDs preserved, selected artwork and prompts present.')
