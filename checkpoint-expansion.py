"""Persist selected native art and an atomic reviewed-source manifest."""
from pathlib import Path
import argparse,json,shutil
ROOT=Path(__file__).resolve().parent
WORK=ROOT.parent/'exercise-expansion'
SOURCE=ROOT/'animation-source/expansion-v16/sheets'
parser=argparse.ArgumentParser();parser.add_argument('batch');parser.add_argument('--index',default='root-generated.json');args=parser.parse_args()
batch=json.loads(Path(args.batch).read_text(encoding='utf-8-sig'))
path=WORK/args.index
old=json.loads(path.read_text(encoding='utf-8-sig'))if path.exists()else[]
records={e['id']:e for e in old};SOURCE.mkdir(parents=True,exist_ok=True)
for entry in batch:
    assert entry['id'].startswith('exp-') and entry['qa']['reviewed']is True
    assert '/'not in entry['id']and '\\'not in entry['id']
    source=SOURCE/(entry['id']+'.png');native=Path(entry['path'])
    assert native.is_file()
    if source.resolve()!=native.resolve():shutil.copy2(native,source)
    source.with_suffix('.txt').write_text(entry['prompt'],encoding='utf-8')
    source.with_suffix('.json').write_text(json.dumps(entry['qa'],indent=2)+'\n',encoding='utf-8')
    entry['path']=str(source);records[entry['id']]=entry
temporary=path.with_suffix('.json.tmp');temporary.write_text(json.dumps(list(records.values()),indent=2)+'\n',encoding='utf-8');temporary.replace(path)
print(json.dumps({'checkpoint':path.name,'reviewed_exercises':len(records),'saved_to_workspace':len(batch)}))
