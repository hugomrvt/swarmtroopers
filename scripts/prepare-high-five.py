"""Split the generated high-five vector into the finale's layers: python3 scripts/prepare-high-five.py path/to/raw.svg.

The source is a flat trace: outlines are a dark backdrop showing between colour shapes. Here each colour shape
gets its own dark stroke instead, so each hand can move on its own. The finale uses the bare hands, emoji-sized; pages get the full composite.
"""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
INK = "#0C0836"
GROUPS = {
    "left-arm": ["rgb(63,109,255)", "rgb(249,192,134)"],
    "right-arm": ["rgb(157,49,225)", "rgb(156,83,56)"],
}


def main():
    raw = Path(sys.argv[1]).read_text()
    paths = re.findall(r'<path[^>]*fill="(rgb\([^)]*\))"[^>]*d="([^"]*)"', raw)
    # Impact lines: the small dark shapes, not the full-canvas backdrop.
    lines = [d for fill, d in paths if fill == "rgb(12,8,54)" and not d.startswith("M 0 0")]

    def svg(body, box="0 0 2048 2048"):
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{box}">{body}</svg>\n'

    def shapes(fills):
        return "".join(
            f'<path fill="{fill}" stroke="{INK}" stroke-width="18" stroke-linejoin="round" paint-order="stroke" d="{d}"/>'
            for fill, d in paths if fill in fills
        )

    out = ROOT / "assets/high-five"
    layers = {name: shapes(fills) for name, fills in GROUPS.items()}
    layers["impact"] = "".join(f'<path fill="{INK}" d="{d}"/>' for d in lines)
    # Bare hands share one square around the contact point, so drawing both in it restores the authored slap.
    for name, skin in (("left-hand", "rgb(249,192,134)"), ("right-hand", "rgb(156,83,56)")):
        (out / f"{name}.svg").write_text(svg(shapes([skin]), "330 300 1400 1400"))
    # The composite for pages: right arm first, the left thumb overlaps its palm.
    (ROOT / "assets/high-five-clap.svg").write_text(svg(layers["right-arm"] + layers["left-arm"] + layers["impact"]))


if __name__ == "__main__":
    main()
