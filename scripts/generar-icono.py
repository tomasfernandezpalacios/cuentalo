"""Genera el icono y la imagen de carga de Cuéntalo con el estilo Cine.

«+1» en la serif de los títulos (Instrument Serif, un poco engordada) en dorado sobre negro
cálido. Uso (desde la raíz del proyecto, con Pillow instalado):

    python scripts/generar-icono.py

Rehacer si cambian los colores o la letra.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / 'node_modules/@expo-google-fonts/instrument-serif/400Regular/InstrumentSerif_400Regular.ttf'
ASSETS = ROOT / 'assets'

BACKGROUND = (11, 10, 9)  # #0B0A09, fondo de Cine (oscuro)
GOLD = (233, 196, 106)  # #E9C46A, dorado de Cine
SPLASH_GOLD = (201, 164, 74)  # #C9A44A, se ve bien sobre fondo claro y oscuro
TEXT = '+1'


def draw_mark(size: int, box: float, color, background=None) -> Image.Image:
    """«+1» centrado ocupando `box` (fracción) del lado, sobre `background` o transparente."""
    image = Image.new('RGBA', (size, size), background + (255,) if background else (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    target = size * box
    font_size = int(size)
    # Busca el tamaño de letra con el que el texto ocupa `box` del ancho.
    while font_size > 10:
        font = ImageFont.truetype(str(FONT), font_size)
        stroke = max(1, font_size // 60)
        left, top, right, bottom = draw.textbbox((0, 0), TEXT, font=font, stroke_width=stroke)
        if right - left <= target and bottom - top <= target:
            break
        font_size -= 4
    x = (size - (right - left)) / 2 - left
    y = (size - (bottom - top)) / 2 - top
    draw.text((x, y), TEXT, font=font, fill=color, stroke_width=stroke, stroke_fill=color)
    return image


def main() -> None:
    # Icono (iOS y general): a sangre, el sistema redondea las esquinas.
    draw_mark(1024, 0.62, GOLD, BACKGROUND).save(ASSETS / 'icon.png')
    # Android adaptativo: el dibujo dentro de la zona segura (66 % centrado) y el fondo aparte.
    draw_mark(1024, 0.46, GOLD).save(ASSETS / 'android-icon-foreground.png')
    Image.new('RGBA', (1024, 1024), BACKGROUND + (255,)).save(ASSETS / 'android-icon-background.png')
    draw_mark(1024, 0.46, (255, 255, 255)).save(ASSETS / 'android-icon-monochrome.png')
    # Imagen de la pantalla de carga (transparente: el fondo lo pone app.json).
    draw_mark(1024, 0.8, SPLASH_GOLD).save(ASSETS / 'splash-icon.png')
    # Web.
    draw_mark(48, 0.8, GOLD, BACKGROUND).save(ASSETS / 'favicon.png')
    print('Iconos generados en', ASSETS)


if __name__ == '__main__':
    main()
