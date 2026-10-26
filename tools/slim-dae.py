#!/usr/bin/env python3
"""Shrink a Collada (.dae) model for the web without changing how it looks (studio-load, 2026-10-26).

  python3 tools/slim-dae.py models/x/model.dae [--drop-node group_0 ...]

- Positions are rounded to 0.001 mm (whatever the file's <unit> is); normals and texture coordinates
  to 5 decimals. SketchUp/Blum exports write 7 significant digits + noise like 1.776357e-15 — that
  precision is far below anything a screen can show, and it is most of the file.
- --drop-node removes whole <node>s by name (and geometry nothing references any more) — only for
  parts the planner never uses (e.g. the dishwasher's body: only its two baskets are shown).
Writes the file in place; run it on the original from git if you need to redo it.
"""
import re, sys

path = sys.argv[1]
drop = sys.argv[sys.argv.index("--drop-node") + 1:] if "--drop-node" in sys.argv else []
src = open(path, encoding="utf-8").read()
before = len(src.encode())

m = re.search(r'<unit[^>]*meter="([0-9.eE+-]+)"', src)
meter = float(m.group(1)) if m else 1.0
# decimals so one step is <= 0.001 mm
pos_dec = 0
while (10 ** -pos_dec) * meter * 1000 > 0.001:
    pos_dec += 1

# which float_arrays hold positions (everything else: normals / uvs)
pos_sources = set(re.findall(r'<input[^>]*semantic="POSITION"[^>]*source="#([^"]+)"', src))
pos_arrays = set()
for sid in pos_sources:
    sm = re.search(r'<source[^>]*id="' + re.escape(sid) + r'"[^>]*>\s*<float_array[^>]*id="([^"]+)"', src)
    if sm:
        pos_arrays.add(sm.group(1))

def fmt(tok, dec):
    v = round(float(tok), dec)
    if v == 0:
        return "0"
    s = ("%." + str(dec) + "f") % v
    s = s.rstrip("0").rstrip(".")
    if s.startswith("0."):
        s = s[1:]
    elif s.startswith("-0."):
        s = "-" + s[2:]
    return s

def slim_array(mo):
    head, aid, body = mo.group(1), mo.group(2), mo.group(3)
    dec = pos_dec if aid in pos_arrays else 5
    return head + " ".join(fmt(t, dec) for t in body.split()) + "</float_array>"

src = re.sub(r'(<float_array[^>]*id="([^"]+)"[^>]*>)([^<]*)</float_array>', slim_array, src)

if drop:
    # remove <node ... name="X"> ... </node> (balanced), then geometries no node instances any more
    def remove_node(text, name):
        i = text.find('name="' + name + '"')
        while i >= 0:
            start = text.rfind("<node", 0, i)
            depth, j = 0, start
            for t in re.finditer(r"<node\b|</node>", text[start:]):
                depth += 1 if t.group(0) == "<node" else -1
                if depth == 0:
                    j = start + t.end()
                    break
            text = text[:start] + text[j:]
            i = text.find('name="' + name + '"')
        return text
    for n in drop:
        src = remove_node(src, n)
    used = set(re.findall(r'<instance_geometry[^>]*url="#([^"]+)"', src))
    src = re.sub(r'\s*<geometry\b[^>]*id="([^"]+)"[^>]*>.*?</geometry>',
                 lambda g: g.group(0) if g.group(1) in used else "", src, flags=re.S)

# indentation whitespace is a few % too
src = re.sub(r"\n\s+", "\n", src)
open(path, "w", encoding="utf-8").write(src)
print("%s: %d KB -> %d KB (positions %d decimals)" % (path, before // 1024, len(src.encode()) // 1024, pos_dec))
