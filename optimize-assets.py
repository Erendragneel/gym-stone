from pathlib import Path
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
import json,zipfile
root=Path(__file__).parent;catalog=root/'dist/exercises.json';items=json.loads(catalog.read_text(encoding='utf-8'));zip_path=root.parent/'Gym_Stone_Exercise_GIF_Library.zip'
assert zip_path.is_file(),'Preserve the GIF library before optimization'
def convert(e):
    if e['image'].endswith('.webp'):return (root/'dist'/e['image']).stat().st_size
    path=root/'dist'/e['image'];im=Image.open(path);frames=[];durations=[]
    for n in range(im.n_frames):
        im.seek(n);f=im.convert('RGB');f.thumbnail((600,600),Image.Resampling.LANCZOS);frames.append(f);durations.append(im.info.get('duration',85))
    out=path.with_suffix('.webp');frames[0].save(out,save_all=True,append_images=frames[1:],duration=durations,loop=0,quality=80,method=4)
    check=Image.open(out);assert check.n_frames>1
    e['gif']=e['image'];e['image']=str(out.relative_to(root/'dist')).replace('\\','/')
    return out.stat().st_size
with ThreadPoolExecutor(max_workers=4)as pool:total=sum(pool.map(convert,items))
catalog.write_text(json.dumps(items,indent=2),encoding='utf-8')
# The full GIF archive is a separate deliverable. Serve compact animated copies in the app.
assets=(root/'dist/assets').resolve()
for p in assets.glob('*.gif'):
    assert p.resolve().parent==assets
    p.unlink()
print(f'{len(items)} animated WebP copies verified; web assets {total/1024/1024:.1f} MB. Full GIF ZIP preserved.')
