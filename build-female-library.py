"""Package the fully audited female GIF library without changing artwork."""
from pathlib import Path
import hashlib,json,zipfile

root=Path(__file__).resolve().parent
items=json.loads((root/'dist/exercises.json').read_text(encoding='utf-8'))
audit=json.loads((root/'female-animation-audit.json').read_text(encoding='utf-8'))
assert len(items)==len(audit)==149
output=root.parent/'Gym_Stone_Female_Anime_Exercise_GIF_Library_v1.2.zip'
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED) as archive:
    for item,result in zip(items,audit):
        assert item['id']==result['id']
        path=root.parent/'female-refresh/gifs'/('female-'+item['id']+'.gif')
        data=path.read_bytes()
        assert hashlib.sha256(data).hexdigest()==result['gif']['sha256']
        folder=item['group'].replace(' & ','_').replace(' ','_')
        archive.writestr(folder+'/'+path.name,data)
    archive.writestr('exercise-catalog.json',json.dumps(items,indent=2))
    archive.writestr('animation-audit.json',json.dumps(audit,indent=2))
    archive.writestr('README.txt','Gym Stone Female Anime Exercise GIF Library v1.2\n149 exercises across all 13 catalog muscle groups.\nDetailed adult female athlete artwork matches the original male examples.\n5.2-second illustrated keyframe loops with endpoint pauses and form captions.\nSome movements demonstrate one side; motion corrections are documented in the source repository.\nThese are instructional anime illustrations, not recorded or motion-captured demonstrations.\nThis is a curated library, not every exercise or possible variation.\nMale library remains available in the v1.1 release.\n')
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert sum(n.endswith('.gif') for n in archive.namelist())==149
print('PASS: 149 audited female GIFs packaged, ZIP CRC verified; '+str(round(output.stat().st_size/1048576,1))+' MiB')
print(output)
print('SHA256 '+hashlib.sha256(output.read_bytes()).hexdigest())
