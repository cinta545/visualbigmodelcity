"""Download pinned public CSVs in bounded parallel ranges and verify LFS hashes."""
import concurrent.futures
import hashlib
from pathlib import Path
import urllib.request
import time

ROOT=Path(__file__).resolve().parents[1]/'data'
BASE='https://media.githubusercontent.com/media/SOTIF-AVLab/SinD/930e4dea78d924c6e9a58ff8e378331f93bba8ec/Data/Tianjin/8_2_1/'
def download(remote, local, size, digest):
    path=ROOT/local
    if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest()==digest:
        return
    parts=ROOT/'sind-download'/local
    parts.mkdir(parents=True,exist_ok=True)
    def part(start):
        end=min(start+1024*1024,size)-1
        target=parts/str(start)
        if target.exists() and target.stat().st_size==end-start+1:return target
        for attempt in range(3):
            try:
                request=urllib.request.Request(BASE+remote,headers={'Range':f'bytes={start}-{end}'})
                with urllib.request.urlopen(request,timeout=90) as response:
                    if response.headers.get('Content-Range')!=f'bytes {start}-{end}/{size}':
                        raise ValueError('Unexpected range response')
                    content=response.read()
                if len(content)!=end-start+1:raise ValueError('Incomplete chunk')
                target.write_bytes(content)
                print(f'{local}: {end+1}/{size}',flush=True)
                return target
            except Exception:
                if attempt==2:raise
                time.sleep(2)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        paths=list(pool.map(part,range(0,size,1024*1024)))
    content=b''.join(p.read_bytes() for p in paths)
    if hashlib.sha256(content).hexdigest()!=digest:raise ValueError('SHA256 mismatch')
    path.write_bytes(content)
    print(f'{local}: SHA256 verified',flush=True)

if __name__=='__main__':
    download('Veh_smoothed_tracks.csv','sind-vehicles.csv',36940154,'c377452a22ad0d57e2ebc9a8bccf050ef50c32c10ce35d7984a12edc24e532b5')
    download('Ped_smoothed_tracks.csv','sind-pedestrians.csv',4520069,'97e9b8a03e6edb0e6f7141b9edc3d42c75d0a9e0fd2981c71e60c9e288edbd02')
