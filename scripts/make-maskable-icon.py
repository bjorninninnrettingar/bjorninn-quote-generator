#!/usr/bin/env python3
"""Generates the maskable PWA icons from icons/icon-512.png (run: python3 scripts/make-maskable-icon.py).
Maskable icons are cropped to a shape by Android, so the artwork must sit inside the safe zone: here it is scaled to
70% of the canvas (15% padding on each side) on the logo's own black background."""
from PIL import Image
import os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
src = Image.open(os.path.join(ROOT, "icons", "icon-512.png")).convert("RGB")
bg = src.getpixel((2, 2))
for size in (512, 192):
    canvas = Image.new("RGB", (size, size), bg)
    inner = round(size * 0.70)
    art = src.resize((inner, inner), Image.LANCZOS)
    off = (size - inner) // 2
    canvas.paste(art, (off, off))
    out = os.path.join(ROOT, "icons", "icon-maskable-%d.png" % size)
    canvas.save(out, optimize=True)
    print("wrote", out)
