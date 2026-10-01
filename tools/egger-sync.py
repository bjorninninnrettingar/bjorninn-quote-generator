#!/usr/bin/env python3
"""Egger decor textures for the kitchen planner, from the materials Björninn actually has in Efnislisti.

  set -a; source .env.local; set +a; python3 tools/egger-sync.py [--only H3710,U705] [--limit N]

For every Efnislisti row in Frontaefni / Borðplata whose name has an EGGER decor code (H/U/W/F + digits):
  1. find the decor's page on egger.com (decors/<CODE>_<STRUCTURE>; the structure is read from the name
     when it's there, otherwise the usual ones are tried — the decor image is the same across structures),
  2. take that page's "Raport" download ("Use for CAD programmes" — a seamless repeat tile) at 1024 px wide
     plus a 256 px thumbnail from Egger's own CDN resizer,
  3. write kitchen-planner-egger.js (window.KPEGGER) — official Egger name, image files, pixel size, and the
     Efnislisti record ids per category, so a pick in the planner links straight to the real board.
Already-downloaded images are kept (delete materials/egger/<CODE>* to refetch). Re-run when Efnislisti gets
new Egger boards. Generated file: don't hand-edit kitchen-planner-egger.js — labels can be overridden in
LABEL_OVERRIDES below.
"""
import json, os, re, sys, time, html, urllib.request, urllib.parse

BASE = "app91U15z9K704Okd"
EFNISLISTI = "tbl8CrVWKF8CuI7HD"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "materials", "egger")
OUT_JS = os.path.join(ROOT, "kitchen-planner-egger.js")
CACHE = os.path.join(ROOT, "tools", ".egger-cache.json")
CATS = {"Frontaefni": "front", "Borðplata": "top"}
TRY = ["9", "40", "32", "PM", "PA", "10", "12", "19", "22", "28", "38", "76", "87", "36", "15", "2", "75", "20", "7", "37", "TM9", "TM12", "TM28", "TM37", "PG", "SM", "11", "16", "24", "25", "29", "30", "33", "35", "39"]
LABEL_OVERRIDES = {}
UA = {"User-Agent": "Mozilla/5.0 (Bjorninn kitchen planner decor sync)"}

def http(url, binary=False):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.status, (r.read() if binary else r.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as e:
            if e.code == 404: return 404, None
            if attempt == 3: raise
        except Exception:
            if attempt == 3: raise
        time.sleep(2 * (attempt + 1))

def airtable_rows():
    tok = os.environ["AIRTABLE_TOKEN"]; out = []; off = None
    while True:
        q = {"pageSize": "100", "fields[]": ["Heiti efnis", "Undirflokkur 🗂️", "Þykkt (mm)", "Efnisnúmer / kóði #️⃣"]}
        if off: q["offset"] = off
        u = f"https://api.airtable.com/v0/{BASE}/{EFNISLISTI}?" + urllib.parse.urlencode(q, doseq=True).replace("+", "%20")
        d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"Authorization": "Bearer " + tok})))
        out += d["records"]; off = d.get("offset")
        if not off: return out

def structures_from_name(name):
    s = []
    for m in re.finditer(r"\b(ST(\d+)|TM(\d+)|PM|PA|PG|PT|SM)\b", name):
        if m.group(2): s.append(m.group(2))
        elif m.group(3): s += ["TM" + m.group(3), m.group(3)]
        else: s.append(m.group(1))
    return s

def decor_page(code, hints, cache):
    if code in cache: return cache[code]
    for st in hints + [x for x in TRY if x not in hints]:
        status, page = http(f"https://www.egger.com/en/furniture-interior-design/decors/{code}_{st}?country=IS")
        time.sleep(0.3)
        if status != 200 or not page: continue
        page = html.unescape(page)
        i = page.find('"imageDownloadItems"')
        if i < 0: continue
        j = page.find("</script>", i)
        items = re.findall(r'"code":\s*"([^"]+)".*?"fileType":\s*"([^"]+)".*?"url":\s*"(https://cdn\.egger\.com/img/pim/[^"]+/original\.(?:png|jpg|tif))"', page[i:j], re.S)
        raport = next((u for c, t, u in items if t.lower().startswith("rap") and c.replace(" ", "").startswith(code)), None)
        if not raport: continue
        title = re.search(r"<title>\s*([^<|]+)", page)
        name = title.group(1).strip() if title else code
        cache[code] = {"url": f"decors/{code}_{st}", "structure": st, "name": name, "raport": raport}
        return cache[code]
    cache[code] = None
    return None

def main():
    only = None; limit = None
    if "--only" in sys.argv: only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
    if "--limit" in sys.argv: limit = int(sys.argv[sys.argv.index("--limit") + 1])
    os.makedirs(IMG_DIR, exist_ok=True)
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    decors = {}
    for r in airtable_rows():
        f = r["fields"]; name = f.get("Heiti efnis", ""); cat = CATS.get(f.get("Undirflokkur 🗂️"))
        m = re.search(r"\b([HUWF]\d{3,4})\b", name)
        if not cat or not m: continue
        code = m.group(1)
        if only and code not in only: continue
        d = decors.setdefault(code, {"code": code, "hints": [], "rows": []})
        d["hints"] += [h for h in structures_from_name(name) if h not in d["hints"]]
        d["rows"].append({"id": r["id"], "cat": cat, "name": name, "mm": f.get("Þykkt (mm)")})
    codes = sorted(decors)[:limit] if limit else sorted(decors)
    result, missing = {}, []
    # look the pages up 6 at a time (most of the time goes into probing structures that 404)
    from concurrent.futures import ThreadPoolExecutor
    todo = [c for c in codes if c not in cache]
    with ThreadPoolExecutor(6) as ex:
        for code, info in zip(todo, ex.map(lambda c: (decor_page(c, decors[c]["hints"], {})), todo)):
            cache[code] = info
            json.dump(cache, open(CACHE, "w"), ensure_ascii=False, indent=1)
            print("  síða:", code, "✔" if info else "✖", flush=True)
    for n, code in enumerate(codes, 1):
        d = decors[code]
        info = cache.get(code)
        if not info:
            missing.append((code, d["rows"][0]["name"])); print(f"[{n}/{len(codes)}] {code}: ekki á egger.com"); continue
        tex = os.path.join(IMG_DIR, code + ".webp"); thumb = os.path.join(IMG_DIR, code + "_t.webp")
        base = info["raport"].rsplit("/", 1)[0]
        for path, w in ((tex, 1024), (thumb, 256)):
            if not os.path.exists(path):
                st, data = http(f"{base}/original.webp?width={w}&srcext=png", binary=True)
                if st == 200: open(path, "wb").write(data)
        wpx, hpx = webp_size(tex)
        color = avg_color(thumb)
        kind = "wood" if code[0] == "H" else "uni" if code[0] in "UW" else "stone"
        result[code] = {
            "code": code, "structure": info["structure"], "label": LABEL_OVERRIDES.get(code, info["name"]), "kind": kind,
            "tex": f"materials/egger/{code}.webp", "thumb": f"materials/egger/{code}_t.webp", "px": [wpx, hpx], "color": color,
            "rows": sorted(d["rows"], key=lambda x: (x["cat"], -(x["mm"] or 0))),
        }
        print(f"[{n}/{len(codes)}] {code}: {info['name']} ({wpx}x{hpx})")
    with open(OUT_JS, "w", encoding="utf-8") as fh:
        fh.write("// GENERATED by tools/egger-sync.py from Efnislisti (Frontaefni / Borðplata rows with an EGGER code)\n")
        fh.write("// + egger.com decor 'Raport' images (materials/egger/). Re-run the tool, don't hand-edit.\n")
        fh.write("// rows = the Efnislisti boards of that decor (id, cat front|top, name, thickness) — thickest first.\n")
        fh.write("window.KPEGGER = " + json.dumps({"decors": result, "missing": [{"code": c, "name": n} for c, n in missing]}, ensure_ascii=False, indent=1) + ";\n")
    print(f"\n{len(result)} decor, {len(missing)} fundust ekki: {missing}")

def avg_color(path):
    try:
        from PIL import Image
        im = Image.open(path).convert("RGB").resize((1, 1), Image.Resampling.BOX)
        return "#%02x%02x%02x" % im.getpixel((0, 0))
    except Exception:
        return None

def webp_size(path):
    b = open(path, "rb").read(64)
    if b[12:16] == b"VP8X": return 1 + int.from_bytes(b[24:27], "little"), 1 + int.from_bytes(b[27:30], "little")
    if b[12:16] == b"VP8 ": return int.from_bytes(b[26:28], "little") & 0x3FFF, int.from_bytes(b[28:30], "little") & 0x3FFF
    if b[12:16] == b"VP8L":
        v = int.from_bytes(b[21:25], "little"); return (v & 0x3FFF) + 1, ((v >> 14) & 0x3FFF) + 1
    return 0, 0

if __name__ == "__main__":
    main()
