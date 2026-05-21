"""
Genera el PNG fuente del icono de Auto-Exit (1024x1024) a partir del cual
`tauri icon` produce el set completo (ICO, ICNS, PNGs de varios tamaños).

Diseño placeholder: cuadrado redondeado color crema con la letra "A"
terracota centrada, en el estilo editorial del UI. No es definitivo —
cuando tengas un logo real, sustituye este source.png y vuelve a correr
`pnpm --filter @solana-auto-exit/tauri tauri icon scripts/source.png`.

Uso:
    python packages/tauri/scripts/generate-icon-source.py
"""
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# Paleta del brand "Light cuaderno" (ADR-017 / sesiones previas).
BG_CREAM = (245, 233, 211, 255)     # #f5e9d3
FG_TERRACOTA = (193, 98, 63, 255)   # #c1623f

SIZE = 1024
CORNER_RADIUS = 220                  # ~21.5% del lado, look macOS-ish

OUT_PATH = Path(__file__).resolve().parent / "source.png"


def find_serif_font(size: int) -> ImageFont.FreeTypeFont:
    """Busca un serif decente en el sistema; si no, cae a default bitmap."""
    candidates = [
        "C:/Windows/Fonts/georgia.ttf",
        "C:/Windows/Fonts/cambria.ttc",
        "C:/Windows/Fonts/times.ttf",
        "/System/Library/Fonts/Georgia.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)


def build_icon() -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle(
        (0, 0, SIZE - 1, SIZE - 1),
        radius=CORNER_RADIUS,
        fill=BG_CREAM,
    )

    font = find_serif_font(int(SIZE * 0.72))
    text = "A"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    # textbbox no centra desde el baseline; ajustamos con el offset top.
    x = (SIZE - text_w) // 2 - bbox[0]
    y = (SIZE - text_h) // 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=FG_TERRACOTA)
    return img


def main() -> None:
    icon = build_icon()
    icon.save(OUT_PATH, "PNG")
    print(f"wrote {OUT_PATH} ({icon.size[0]}x{icon.size[1]})")


if __name__ == "__main__":
    main()
