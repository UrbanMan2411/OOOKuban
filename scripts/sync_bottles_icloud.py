#!/usr/bin/env python3
# Синхронизация рендеров бутылок (Я.Диск → сервер-зеркало) → iCloud «Matrёshka бутылки».
# Дедуп размерных вариантов (900х1200 и т.п.), конвертация в jpg ≤1600px.
# Инкрементально: скачивает только файлы, которых ещё нет в iCloud.
# Ручной запуск: python3 scripts/sync_bottles_icloud.py
import json, os, re, subprocess, tempfile, shutil

SSH = ["ssh", "-i", os.path.expanduser("~/.ssh/greenpanda_deploy"),
       "-o", "ConnectTimeout=15", "root@193.124.59.187"]
DST = os.path.expanduser("~/Library/Mobile Documents/com~apple~CloudDocs/Matrёshka бутылки")

SELECT = r'''
import os,re,json
ROOT="/var/lib/greenpanda/cockpit/catalogs/visuals/files"
SKIP={"Комплекты 5 фото","Карточки МП (генерации)"}
groups={}
for dp,dn,fn in os.walk(ROOT):
    rel=os.path.relpath(dp,ROOT)
    if rel.split(os.sep)[0] in SKIP: continue
    for f in fn:
        m=re.match(r"(.+?)\.(jpg|jpeg|png)$",f,re.I)
        if not m: continue
        base=m.group(1)
        base=re.sub(r"[_ ]*\d{3,4}\s*[хx]\s*\d{3,4}","",base,flags=re.I)
        base=re.sub(r"[_ ]+\d$","",base).strip().rstrip("_").lower()
        key=os.path.join(rel,base)
        ext=m.group(2).lower()
        pref=(0 if re.search(r"900\s*[хx]\s*1200",f,re.I) else 1, 0 if ext in("jpg","jpeg") else 1, len(f))
        cur=groups.get(key)
        if cur is None or pref<cur[0]: groups[key]=(pref,os.path.join(rel,f))
print(json.dumps([v[1] for v in groups.values()],ensure_ascii=False))
'''

def out_path(rel):
    return os.path.join(DST, re.sub(r"\.(jpe?g|png)$", ".jpg", rel, flags=re.I))

def main():
    from PIL import Image
    r = subprocess.run(SSH + ["python3 - << 'PY'\n" + SELECT + "\nPY"],
                       capture_output=True, text=True, timeout=300)
    files = json.loads(r.stdout)
    missing = [f for f in files if not os.path.exists(out_path(f))]
    if not missing:
        print(f"ok: рендеров {len(files)}, новых нет"); return
    tmp = tempfile.mkdtemp(prefix="bottles_")
    try:
        lst = os.path.join(tmp, "list.txt")
        open(lst, "w").write("\n".join(missing))
        subprocess.run(["scp", "-q", "-i", os.path.expanduser("~/.ssh/greenpanda_deploy"),
                        lst, "root@193.124.59.187:/tmp/bottle_list.txt"], check=True, timeout=120)
        tar = subprocess.run(SSH + ['cd "/var/lib/greenpanda/cockpit/catalogs/visuals/files" && tar czf - -T /tmp/bottle_list.txt'],
                             capture_output=True, timeout=900)
        subprocess.run(["tar", "xzf", "-"], input=tar.stdout, cwd=tmp, check=True)
        n = 0
        for rel in missing:
            src = os.path.join(tmp, rel)
            if not os.path.exists(src): continue
            out = out_path(rel)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            im = Image.open(src)
            if im.mode in ("RGBA", "LA", "P"):
                bg = Image.new("RGB", im.size, (255, 255, 255))
                im = im.convert("RGBA"); bg.paste(im, mask=im.split()[-1]); im = bg
            else:
                im = im.convert("RGB")
            im.thumbnail((1600, 1600))
            im.save(out, "JPEG", quality=86)
            n += 1
        print(f"ok: рендеров {len(files)}, добавлено {n}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

if __name__ == "__main__":
    main()
