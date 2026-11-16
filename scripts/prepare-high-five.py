"""Export the positioned artwork without its background: python3 scripts/prepare-high-five.py path/to/positioned-layers.zip."""

from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
import math
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SIZE = (2048, 1360)
LAYERS = [
    (2, "blue-forearm", -1),
    (3, "orange-forearm", 1),
    (4, "purple-wrist-cuff", -1),
    (5, "beige-wrist-cuff", 1),
    (6, "blue-high-five-hand", -1),
    (7, "orange-high-five-hand", 1),
    (8, "top-yellow-sparkle", 0),
    (9, "right-yellow-sparkle", 0),
    (10, "purple-sparkle-group", 0),
]


def main():
    output = ROOT / "assets/high-five"
    output.mkdir(parents=True, exist_ok=True)
    composite = Image.new("RGBA", SIZE)
    imports = []
    entries = []
    with ZipFile(sys.argv[1]) as archive:
        for z, name, group in LAYERS:
            source = f"layer-z{z}-base-{name}.png"
            with Image.open(BytesIO(archive.read(source))) as image:
                assert image.size == SIZE and image.mode == "RGBA", source
                assert image.getchannel("A").getextrema() == (0, 255), source
                composite.alpha_composite(image)
                left, top, right, bottom = image.getchannel("A").getbbox()
                left, top = max(0, left - 2), max(0, top - 2)
                right, bottom = min(SIZE[0], right + 2), min(SIZE[1], bottom + 2)
                width, height = right - left, bottom - top
                crop = image.crop((left, top, right, bottom))
                crop = crop.resize((math.ceil(width / 2), math.ceil(height / 2)), Image.Resampling.LANCZOS)
                target = output / f"{name}.webp"
                crop.save(target, "WEBP", quality=86, method=6, exact=True)
                assert Image.open(target).mode == "RGBA", target
            imports.append(f"import layer{z} from '../assets/high-five/{name}.webp';")
            entries.append(f"  {{ src: layer{z}, x: {left}, y: {top}, w: {width}, h: {height}, group: {group} }},")

    assert composite.getpixel((0, 0))[3] == 0, "Background must stay transparent"
    composite.resize((1024, 680), Image.Resampling.LANCZOS).save(ROOT / "assets/high-five.webp", "WEBP", quality=90, method=6, exact=True)
    module = "// Generated from the user-supplied positioned-layers.zip by scripts/prepare-high-five.py.\n"
    module += "\n".join(imports)
    module += "\n\nexport const HIGH_FIVE_SIZE = { width: 2048, height: 1360 };\n"
    module += "\n/** Original coordinates and stacking; -1/1 move each complete arm, 0 marks the impact sparkles. */\n"
    module += "export const HIGH_FIVE_LAYERS = [\n" + "\n".join(entries) + "\n];\n"
    (ROOT / "src/high-five.ts").write_text(module)
    total = sum((output / f"{name}.webp").stat().st_size for _, name, _ in LAYERS)
    assert total < 200_000, f"Embedded artwork is too large: {total} bytes"
    print(f"Prepared {len(LAYERS)} transparent layers: {total:,} bytes. Static composite: {(ROOT / 'assets/high-five.webp').stat().st_size:,} bytes.")


if __name__ == "__main__":
    main()
