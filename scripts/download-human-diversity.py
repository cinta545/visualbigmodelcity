"""Download six additional MIT Rocketbox avatars at the existing pinned commit."""
import concurrent.futures,hashlib,json,time,urllib.request
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
COMMIT='0943055db6ec570bcef9f2c8b41c9e5467c808f9'
SELECTION=[('Adults','Female_Adult_01'),('Adults','Female_Adult_05'),('Adults','Male_Adult_03'),('Adults','Female_Adult_13'),('Children','Male_Child_01'),('Children','Female_Child_01')]
DEST=ROOT/'assets/characters/rocketbox'
CACHE=ROOT/'artifacts/human-sources'

def main():
    DEST.mkdir(exist_ok=True);CACHE.mkdir(exist_ok=True)
    tree=json.load(urllib.request.urlopen(f'https://api.github.com/repos/microsoft/Microsoft-Rocketbox/git/trees/{COMMIT}?recursive=1'))['tree']
    selected=[]
    for family,name in SELECTION:
        folder=f'Assets/Avatars/{family}/{name}/'
        selected.extend(item for item in tree if item['path']==folder+f'Export/{name}.fbx' or item['path'].startswith(folder+'Textures/') and item['path'].endswith(('_body_color.tga','_head_color.tga','_body_normal.tga','_head_normal.tga','_opacity_color.tga')))
    def acquire(item):
        source=item['path'];name=source.split('/')[-1];raw=CACHE/name
        for attempt in range(3):
            try:
                if not raw.exists():urllib.request.urlretrieve(f'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/{COMMIT}/{source}',raw)
                data=raw.read_bytes()
                digest=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
                if digest!=item['sha']:raise ValueError('Source hash mismatch: '+source)
                break
            except Exception:
                if attempt==2:raise
                time.sleep(1)
        if name.endswith('.tga'):
            image=Image.open(raw);image.thumbnail((1024,1024),Image.Resampling.LANCZOS)
            out=DEST/(name[:-4]+('.png' if 'opacity' in name else '.jpg'))
            if 'opacity' in name:image.save(out,optimize=True)
            else:image.convert('RGB').save(out,quality=90,optimize=True)
        else:
            out=DEST/name;out.write_bytes(data)
        result=dict(file=out.name,bytes=out.stat().st_size,sha256=hashlib.sha256(out.read_bytes()).hexdigest(),distributed=True,sourcePath=source,sourceGitBlobSHA1=item['sha'])
        print(out.name,flush=True);return result
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:files=list(pool.map(acquire,selected))
    provenance=DEST/'provenance.json';record=json.loads(provenance.read_text(encoding='utf8'));names={r['file'] for r in files}
    record['files']=[r for r in record['files'] if r['file'] not in names]+files
    record['diversityAvatars']=[name for _,name in SELECTION]
    provenance.write_text(json.dumps(record,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
    print('Verified assets:',len(files),'Runtime bytes:',sum(r['bytes'] for r in files),flush=True)

if __name__=='__main__':main()
