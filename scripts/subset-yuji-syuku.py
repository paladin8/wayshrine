"""Cut the Yuji Syuku brush font down to the characters the game can show.

The full font (content/fonts/yuji-syuku.woff2, about 3.9 MB) covers thousands of kanji the game never uses.
This keeps basic Latin, the kana and CJK punctuation blocks, and every non-ASCII character in the game's text
sources, and writes:

  public/fonts/yuji-syuku-subset.woff2    the font the game loads
  scripts/yuji-syuku-subset.txt           the characters it covers (src/content/font-coverage.test.ts reads it)

Rerun after adding Japanese text; the coverage test fails until you do.
The inscription font stack also ships U+3033 and U+3035 from Noto Serif CJK JP 2.003.
To recreate that separate fallback from the upstream regular OTF:
  pyftsubset NotoSerifCJKjp-Regular.otf --unicodes=U+3033,U+3035 --layout-features='*' --name-IDs='*' --flavor=woff2 --output-file=public/fonts/noto-serif-cjk-jp-repeat-marks.woff2
Needs fontTools and brotli: pip install fonttools brotli
Usage: python3 scripts/subset-yuji-syuku.py
"""
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "content/fonts/yuji-syuku.woff2"
OUT = ROOT / "public/fonts/yuji-syuku-subset.woff2"
COVERAGE = ROOT / "scripts/yuji-syuku-subset.txt"

# Whole blocks, so short new strings in kana rarely need a rerun.
RANGES = [
    (0x20, 0x7E),      # basic Latin
    (0x3000, 0x303F),  # CJK punctuation
    (0x3040, 0x309F),  # hiragana
    (0x30A0, 0x30FF),  # katakana
    (0xFF01, 0xFF5E),  # full-width forms
]


def text_sources():
    yield from sorted((ROOT / "src").rglob("*.ts"))
    yield from sorted((ROOT / "src/content").glob("*.json"))


def main() -> None:
    wanted = {cp for lo, hi in RANGES for cp in range(lo, hi + 1)}
    for path in text_sources():
        wanted |= {ord(c) for c in path.read_text(encoding="utf-8") if ord(c) > 0x7F}
    available = set(TTFont(SOURCE).getBestCmap())
    kept = sorted(wanted & available)

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    font = TTFont(SOURCE)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=kept)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(OUT)

    COVERAGE.write_text("".join(chr(cp) for cp in kept) + "\n", encoding="utf-8")
    print(f"{len(kept)} characters, {OUT.stat().st_size // 1024} KB -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
