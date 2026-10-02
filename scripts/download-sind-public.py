"""Download official public multi-city samples; these are NOT the full dataset."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import time
import urllib.parse
import urllib.request

COMMIT = '930e4dea78d924c6e9a58ff8e378331f93bba8ec'
ROOT = Path(__file__).resolve().parents[1] / 'data' / 'sind-public'
BASE = 'https://raw.githubusercontent.com/SOTIF-AVLab/SinD/' + COMMIT + '/'
MEDIA = 'https://media.githubusercontent.com/media/SOTIF-AVLab/SinD/' + COMMIT + '/'

def get(url, headers=None):
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=45) as r:
        return r.read(), r.headers

def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    tree = json.loads(get('https://api.github.com/repos/SOTIF-AVLab/SinD/git/trees/' + COMMIT + '?recursive=1')[0])
    files = [v for v in tree['tree'] if v['path'].startswith(('Data/Changchun/', 'Data/Chongqing/', "Data/Xi'an/")) and v['path'].endswith(('.csv', '.osm'))]
    files += [v for v in tree['tree'] if v['path'] in ('LICENSE', 'README.md', 'DATASETS.md', 'Format.md')]
    manifest = {'source': 'https://github.com/SOTIF-AVLab/SinD', 'commit': COMMIT, 'scope': 'Official public samples only; full dataset requires application', 'files': []}
    for item in files:
        name = item['path']
        quoted = urllib.parse.quote(name, safe='/')
        raw, _ = get(BASE + quoted)
        target = ROOT / name
        target.parent.mkdir(parents=True, exist_ok=True)
        lfs = raw.startswith(b'version https://git-lfs.github.com/spec/v1')
        if lfs:
            pointer = dict(line.split(' ', 1) for line in raw.decode().splitlines())
            size, digest = int(pointer['size']), pointer['oid'].split(':')[1]
            if not (target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == digest):
                chunks = ROOT / '.parts' / name
                chunks.mkdir(parents=True, exist_ok=True)
                def part(start):
                    end = min(start + 1024*1024, size) - 1
                    cache = chunks / str(start)
                    if cache.exists() and cache.stat().st_size == end-start+1:
                        return cache
                    for attempt in range(3):
                        try:
                            body, headers = get(MEDIA + quoted + '?chunk=' + str(start), {'Range': f'bytes={start}-{end}'})
                            if headers.get('Content-Range') != f'bytes {start}-{end}/{size}' or len(body) != end-start+1:
                                # Small LFS objects may be returned as a complete 200 response.
                                if start != 0 or end != size-1 or len(body) != size:
                                    raise ValueError('Unexpected range response')
                            cache.write_bytes(body)
                            return cache
                        except Exception:
                            if attempt == 2:
                                raise
                            time.sleep(1)
                print(f'Downloading {name}: {size} bytes', flush=True)
                with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                    paths = list(pool.map(part, range(0, size, 1024*1024)))
                temporary = target.with_suffix(target.suffix + '.download')
                with temporary.open('wb') as out:
                    for p in paths:
                        out.write(p.read_bytes())
                if hashlib.sha256(temporary.read_bytes()).hexdigest() != digest:
                    raise ValueError('LFS SHA256 mismatch: ' + name)
                temporary.replace(target)
        else:
            if hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() != item['sha']:
                raise ValueError('Git blob hash mismatch')
            target.write_bytes(raw)
            digest, size = hashlib.sha256(raw).hexdigest(), len(raw)
        manifest['files'].append({'path': name, 'bytes': size, 'sha256': digest, 'lfs': lfs, 'verified': True})
        (ROOT / 'download-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
        print('Verified ' + name, flush=True)

if __name__ == '__main__':
    main()
