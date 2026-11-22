"""Render each landmark's display names as white brush calligraphy on transparent PNGs.

    python3 scripts/landmark-names.py            # all landmarks
    python3 scripts/landmark-names.py kinkaku-ji # just one

Reads Id / Name / Japanese from the table in docs/landmarks.md and writes
public/images/landmark-names/<id>.ja.png (vertical, Yuji Syuku) and <id>.en.png
(horizontal, Kaushan Script). Every image uses the same glyph size, so images
differ only in width/height and the UI scales them uniformly. The ink texture
is seeded by id, so re-running produces identical files.

Needs: pip install numpy scipy opencv-python pillow (Pillow with libraqm, for
vertical glyph forms). Fonts (SIL OFL) are downloaded into scripts/.fonts/.
"""
import os, re, sys, urllib.request, zlib
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont, features
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public/images/landmark-names")
FONT_DIR = os.path.join(ROOT, "scripts/.fonts")
FONTS = {
    "ja": ("YujiSyuku-Regular.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/yujisyuku/YujiSyuku-Regular.ttf"),
    "en": ("KaushanScript-Regular.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/kaushanscript/KaushanScript-Regular.ttf"),
}

JA_SIZE = 320      # px per em
EN_SIZE = 240      # px per em; chosen so the two read at a similar weight
JA_TRACK = 0.05    # extra space between characters in a column, in ems
JA_COL_GAP = 0.35  # space between columns, in ems
MAX_COLUMN = 7     # characters per column before wrapping
SS = 2             # supersampling factor
PAD = 12           # transparent margin around the trimmed image, px

# Where to break names longer than MAX_COLUMN. Anything not listed is split
# after の if there is one near the middle, else evenly.
BREAKS = {
    "江の島シーキャンドル": ["江の島", "シーキャンドル"],
    "与那国島海底遺跡": ["与那国島", "海底遺跡"],
    "さっぽろテレビ塔": ["さっぽろ", "テレビ塔"],
    "厳島神社の大鳥居": ["厳島神社の", "大鳥居"],
}


def font_path(lang):
    name, url = FONTS[lang]
    path = os.path.join(FONT_DIR, name)
    if not os.path.exists(path):
        os.makedirs(FONT_DIR, exist_ok=True)
        print("downloading", name)
        urllib.request.urlretrieve(url, path)
    return path


def read_landmarks():
    rows, header = [], None
    for line in open(os.path.join(ROOT, "docs/landmarks.md"), encoding="utf-8"):
        if not line.startswith("|"):
            if rows:
                break  # end of the list table
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if "Id" in cells and "Japanese" in cells:
            header = cells
        elif header and not set("".join(cells)) <= set("- "):
            r = dict(zip(header, cells))
            rows.append((r["Id"], r["Name"], r["Japanese"]))
    if not rows:
        sys.exit("no landmark table found in docs/landmarks.md")
    return rows


def columns(text):
    if len(text) <= MAX_COLUMN:
        return [text]
    if text in BREAKS:
        return BREAKS[text]
    mid = len(text) / 2
    cuts = [i + 1 for i, c in enumerate(text[:-1]) if c == "の" and abs(i + 1 - mid) <= 2]
    cut = min(cuts, key=lambda i: abs(i - mid)) if cuts else round(mid)
    return [text[:cut]] + columns(text[cut:])


def mask_vertical(text, size):
    """Columns run top to bottom, right to left, using the font's vertical glyph forms."""
    f = ImageFont.truetype(font_path("ja"), size * SS)
    em = size * SS
    cols = columns(text)
    step = em * (1 + JA_TRACK)
    gap = em * JA_COL_GAP
    W = int(len(cols) * em + (len(cols) - 1) * gap + em)
    H = int(max(len(c) for c in cols) * step + em)
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    for k, col in enumerate(cols):
        x = W - em / 2 - (k + 1) * em - k * gap  # right-most column first
        for i, ch in enumerate(col):
            d.text((x, em / 2 + i * step), ch, font=f, fill=255, features=["vert"])
    return downsample(img)


def mask_horizontal(text, size):
    f = ImageFont.truetype(font_path("en"), size * SS)
    bbox = ImageDraw.Draw(Image.new("L", (1, 1))).textbbox((0, 0), text, font=f)
    W, H = int(bbox[2] + size * SS), int(size * SS * 1.8)
    img = Image.new("L", (W, H), 0)
    ImageDraw.Draw(img).text((size * SS * 0.5, size * SS * 0.25), text, font=f, fill=255)
    return downsample(img)


def downsample(img):
    img = img.resize((img.width // SS, img.height // SS), Image.LANCZOS)
    return np.asarray(img, dtype=np.float32) / 255.0


def noise(shape, sigma, rng):
    n = ndi.gaussian_filter(rng.standard_normal(shape).astype(np.float32), sigma)
    return n / (n.std() + 1e-6)


def brush(a, size, seed, dry=0.6, rough=1.0, density=1.0):
    """Ink texture: ragged edges, dry-brush streaks along each stroke, uneven density."""
    rng = np.random.default_rng(seed)
    s = size / 100.0  # texture scale follows glyph size
    # Ragged edges: perturb a softened mask with fine noise and re-threshold.
    soft = ndi.gaussian_filter(a, 0.9 * s)
    edge = noise(a.shape, 0.8 * s, rng) * 0.07 + noise(a.shape, 2.5 * s, rng) * 0.05
    shaped = np.clip((soft + rough * edge - 0.5) * 6 + 0.5, 0, 1)
    # Dry brush: streak noise blurred along the local stroke direction (from the
    # structure tensor), shown in patches and mostly near stroke edges.
    g = ndi.gaussian_filter(a, 2.0 * s)
    gx, gy = ndi.sobel(g, 1), ndi.sobel(g, 0)
    jxx, jyy, jxy = (ndi.gaussian_filter(v, 5 * s) for v in (gx * gx, gy * gy, gx * gy))
    phi = 0.5 * np.arctan2(2 * jxy, jxx - jyy) + np.pi / 2
    L = max(5, int(28 * s)) | 1
    acc, wsum = np.zeros_like(a), np.zeros_like(a)
    for k in range(8):
        ang = k * np.pi / 8
        ker = np.zeros((L, L), np.float32)
        c, dx, dy = L // 2, np.cos(ang) * (L // 2), np.sin(ang) * (L // 2)
        cv2.line(ker, (round(c - dx), round(c - dy)), (round(c + dx), round(c + dy)), 1.0, 1)
        n = cv2.filter2D(rng.standard_normal(a.shape).astype(np.float32), -1, ker / ker.sum())
        n = ndi.gaussian_filter(n, 0.5 * s)
        w = np.clip(np.cos(2 * (phi - ang)), 0, 1) ** 4
        acc += w * n / (n.std() + 1e-6)
        wsum += w
    streak = acc / (wsum + 1e-6)
    depth = np.clip(ndi.distance_transform_edt(a > 0.5) / (5 * s), 0, 1)
    dry_amt = np.clip(noise(a.shape, 10 * s, rng) * 0.7 - 0.1, 0, 1) * (1 - 0.6 * depth)
    gaps = np.clip((streak - 0.9) * 1.4, 0, 1) * dry_amt * dry
    near = ndi.binary_dilation(a > 0.05, iterations=max(2, int(3 * s)))
    out = shaped * near * (1 - gaps)
    # Uneven ink density, subtle.
    dens = 1 - density * 0.12 * np.clip(noise(a.shape, 14 * s, rng) * 0.5 + 0.5, 0, 1)
    return np.clip(out * dens, 0, 1)


def save(alpha, path):
    ys, xs = np.nonzero(alpha > 0.01)
    a = alpha[max(ys.min() - PAD, 0):ys.max() + PAD + 1, max(xs.min() - PAD, 0):xs.max() + PAD + 1]
    rgba = np.zeros(a.shape + (4,), np.uint8)
    rgba[..., :3] = 255
    rgba[..., 3] = (a * 255).round().astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(path, optimize=True)


def main(only):
    if not features.check("raqm"):
        sys.exit("Pillow needs libraqm for vertical glyph forms (ー, small kana)")
    os.makedirs(OUT, exist_ok=True)
    rows = [r for r in read_landmarks() if not only or r[0] in only]
    for id_, en, ja in rows:
        seed = zlib.crc32(id_.encode())
        save(brush(mask_vertical(ja, JA_SIZE), JA_SIZE, seed), os.path.join(OUT, f"{id_}.ja.png"))
        save(brush(mask_horizontal(en, EN_SIZE), EN_SIZE, seed + 1), os.path.join(OUT, f"{id_}.en.png"))
        print(id_, "|".join(columns(ja)), en)


if __name__ == "__main__":
    main(set(sys.argv[1:]))
