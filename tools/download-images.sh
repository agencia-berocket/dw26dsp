#!/usr/bin/env bash
# Downloads the 18 photographs into assets/img/ so the page works offline.
# Run once from this folder:  bash download-images.sh
set -u
cd "$(dirname "$0")/assets/img" || exit 1
python3 - <<'PY'
import json, os, urllib.request
m = json.load(open('manifest.json'))
ok = fail = 0
for name, url in m.items():
    if os.path.exists(name) and os.path.getsize(name) > 1000:
        print('skip', name); ok += 1; continue
    try:
        urllib.request.urlretrieve(url, name)
        print('  ok', name); ok += 1
    except Exception as e:
        print(' FAIL', name, e); fail += 1
print(f'\n{ok} downloaded, {fail} failed')
if fail:
    print('Check your connection. If it persists, the source links have expired — ask Subash for the originals.')
PY
