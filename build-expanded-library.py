"""Encode reviewed paired source sheets into full-cell male/female animations."""
from pathlib import Path
from PIL import Image
import argparse,hashlib,importlib.util,json,shutil,zipfile,time
ROOT=Path(__file__).resolve().parent
WORK=ROOT.parent/'exercise-expansion'
SOURCE=ROOT/'animation-source/expansion-v16'
CATALOG=ROOT/'dist/exercises.json'
ARCHIVE=ROOT.parent/'Gym_Stone_250_New_Exercise_GIFs_v1.6.zip'
EXPECTED=250

def read(path):
    for attempt in range(4):
        try:return json.loads(path.read_text(encoding='utf-8-sig'))
        except json.JSONDecodeError:
            if attempt==3:raise
            time.sleep(.1)
def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_suffix(path.suffix+'.tmp')
    temporary.write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    temporary.replace(path)
def module(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/file)
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def inputs(saved=False):
    jobs=read(SOURCE/'jobs.json') if saved else sum([read(WORK/name) for name in ['upper-jobs.json','lower-jobs.json','core-jobs.json']],[])
    assert len(jobs)==EXPECTED and len({j['id'] for j in jobs})==EXPECTED
    assert len({j['name'].casefold() for j in jobs})==EXPECTED
    manifest=[]
    if saved:
        for job in jobs:
            path=SOURCE/'sheets'/(job['id']+'.png')
            if path.exists():manifest.append({'id':job['id'],'path':str(path),'prompt':path.with_suffix('.txt').read_text(encoding='utf-8'),'qa':read(path.with_suffix('.json'))})
    else:
        for name in ['pilot-index.json','upper-generated.json','lower-generated.json','core-generated.json','root-generated.json','core-lower-generated.json']:
            path=WORK/name
            if path.exists():manifest.extend(read(path))
    assert len({j['id'] for j in manifest})==len(manifest),'Duplicate reviewed sheet IDs'
    valid={j['id'] for j in jobs};assert all(m['id'] in valid for m in manifest)
    return jobs,{m['id']:m for m in manifest}
def plan(qa,gender):
    default=[0,1,2,1] if gender=='male' else [3,4,5,4]
    mapping=qa.get('cell_indices',{});indices=list(mapping.get(gender,default) if isinstance(mapping,dict) else mapping)
    durations=qa.get('durations',[650,450,900,450])
    if isinstance(durations,dict):durations=durations[gender]
    durations=list(durations)
    assert len(indices)>=2 and len(indices)==len(durations)
    assert all(type(i) is int and 0<=i<6 for i in indices)
    assert all(type(d)is int and d>=20 and d%10==0 for d in durations)
    assert all(i<3 for i in indices) if gender=='male' else all(i>=3 for i in indices)
    return indices,durations
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--assets-only',action='store_true');parser.add_argument('--from-sources',action='store_true');args=parser.parse_args()
    jobs,manifest=inputs(args.from_sources);SOURCE.mkdir(parents=True,exist_ok=True)
    baseline=WORK/'baseline-catalog.json'
    if not baseline.exists():write(baseline,[e for e in read(CATALOG) if not e.get('expansion')])
    original=read(baseline);assert len(original)==175
    assert not {e['id'] for e in original}&{e['id'] for e in jobs}
    assert not {e['name'].casefold() for e in original}&{e['name'].casefold() for e in jobs}
    if not args.assets_only:assert len(manifest)==EXPECTED,('Wait for all reviewed sheets',len(manifest))
    framing=module('expansion_framing','sprite-framing.py')
    layout=module('expansion_layout','build-pregnancy-library.py')
    state_path=SOURCE/'encoding-audit.json';previous={row['id']:row for row in read(state_path)} if state_path.exists() else{}
    items=[];report=[];encoded=0
    for job in jobs:
        entry=manifest.get(job['id'])
        if not entry:continue
        qa=entry.get('qa',{});assert qa.get('reviewed')is True,(job['id'],'Source review required')
        path=Path(entry['path']);assert path.is_file() and entry.get('prompt'),job['id']
        folder=SOURCE/'sheets';folder.mkdir(exist_ok=True)
        source=folder/(job['id']+'.png')
        if path.resolve()!=source.resolve():shutil.copy2(path,source)
        (folder/(job['id']+'.txt')).write_text(entry['prompt'],encoding='utf-8')
        write(folder/(job['id']+'.json'),qa)
        fingerprint=hashlib.sha256(source.read_bytes()+json.dumps(qa,sort_keys=True).encode()+json.dumps(job,sort_keys=True).encode()).hexdigest()
        item={key:value for key,value in job.items() if key not in('setup','motion')}
        item.update(expansion=True,variants={})
        old=previous.get(job['id'])
        cached=old and old.get('source_fingerprint')==fingerprint and all((ROOT/'dist'/v[k]).exists() for v in old['variants'].values() for k in ['image','gif'])
        row={'id':job['id'],'source_fingerprint':fingerprint,'variants':{},'formats':{}}
        cells=None if cached else framing.cells(source)
        for gender in ['male','female']:
            indices,durations=plan(qa,gender)
            if cached:
                variant=old['variants'][gender];row['formats'][gender]=old['formats'][gender]
            else:
                canvases=[layout.canvas(cells[i],job) for i in indices]
                sample=Image.new('RGB',(600*3,484*2),'#f3f5f8')
                for n,frame in enumerate(canvases[:6]):sample.paste(frame,(n%3*600,n//3*484))
                palette=sample.quantize(colors=256,method=Image.Quantize.MEDIANCUT)
                indexed=[frame.quantize(palette=palette,dither=Image.Dither.NONE) for frame in canvases]
                gif=ROOT/'dist/assets'/(gender+'-'+job['id']+'.gif');webp=gif.with_suffix('.webp')
                indexed[0].save(gif,save_all=True,append_images=indexed[1:],duration=durations,loop=0,disposal=2,optimize=False)
                canvases[0].save(webp,save_all=True,append_images=canvases[1:],duration=durations,loop=0,quality=88,method=4,minimize_size=True)
                row['formats'][gender]={'gif':layout.inspect_animation(gif,sum(durations)),'webp':layout.inspect_animation(webp,sum(durations))}
                variant={'image':'assets/'+webp.name,'gif':'assets/'+gif.name,'style':'Anime paired pose loop','animation':{'keyframes':len(indices),'duration_ms':sum(durations),'framing':'Complete source cell with 40px safety margin'}}
                encoded+=1
            item['variants'][gender]=variant;row['variants'][gender]=variant
        item.update(image=item['variants']['male']['image'],gif=item['variants']['male']['gif'])
        items.append(item);report.append(row)
    write(state_path,report);write(SOURCE/'jobs.json',jobs)
    if not args.assets_only:
        assert len(items)==EXPECTED
        current=read(CATALOG);assert [e for e in current if not e.get('expansion')]==original,'Keep all existing catalog entries unchanged'
        write(CATALOG,original+items)
        with zipfile.ZipFile(ARCHIVE,'w',zipfile.ZIP_DEFLATED)as archive:
            for item in items:
                for gender in ['male','female']:
                    file=ROOT/'dist'/item['variants'][gender]['gif'];archive.write(file,gender+'/'+file.name)
            archive.writestr('catalog.json',json.dumps(items,indent=2,ensure_ascii=False))
            archive.writestr('README.md','Gym Stone v1.6: 250 new exercises, 500 male/female GIFs.\n\nGIF playback illustrates motion; it does not prescribe exercise quantity. Log sets and reps for strength, minutes for cardio/holds/mobility. Full-body source cells have 40px safety margins and are encoded as opaque discrete poses. Existing warm-up, cooldown and pregnancy entries retain their own guidance. Sources and generated prompts are retained in animation-source/expansion-v16.\n')
            archive.writestr('encoding-audit.json',json.dumps(report,indent=2))
        with zipfile.ZipFile(ARCHIVE)as archive:assert archive.testzip()is None
    print(json.dumps({'reviewed_exercises':len(items),'newly_encoded_variants':encoded,'catalog_written':not args.assets_only,'catalog_total':175+len(items) if not args.assets_only else 175}))
if __name__=='__main__':main()
