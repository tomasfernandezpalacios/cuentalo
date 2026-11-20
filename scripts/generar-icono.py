"""Genera el icono y la imagen de carga de Kuentio.

El logotipo entero, «Kuentio.», en la letra de títulos de la tipografía Editorial (Fraunces
ExtraBold): el nombre en el negro de Cine y el punto en su dorado oscuro, sobre el dorado de Cine,
para que destaque entre los iconos del móvil (colores exactos de `cinemaPalette` en
`src/lib/theme.ts`: `dark.background`, `light.primary` y `dark.primary`). Uso (desde la raíz del proyecto, con
Pillow instalado):

    python scripts/generar-icono.py

Rehacer si cambian los colores o la letra.
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / 'node_modules/@expo-google-fonts/fraunces/800ExtraBold/Fraunces_800ExtraBold.ttf'
ASSETS = ROOT / 'assets'

BLACK = (11, 10, 9)  # #0B0A09, fondo de Cine (oscuro)
BONE = (245, 241, 232)  # #F5F1E8, texto de Cine (oscuro)
GOLD = (233, 196, 106)  # #E9C46A, dorado de Cine (oscuro)
PAPER = (243, 238, 228)  # #F3EEE4, fondo de Cine (claro)
INK = (26, 23, 20)  # #1A1714, texto de Cine (claro)
DARK_GOLD = (126, 97, 27)  # #7E611B, dorado de Cine (claro)
WHITE = (255, 255, 255)
NAME = 'Kuentio'
SUPERSAMPLE = 4  # se dibuja más grande y se reduce, para bordes suaves


def draw_mark(size: int, box: float, text_color, dot_color, background=None, name=NAME):
    """«Kuentio.» centrado ocupando `box` (fracción) del ancho, sobre `background` o transparente.

    Se centra en la altura de las letras (sin contar el punto, que va en la línea de base).
    """
    big = size * SUPERSAMPLE
    fill = background + (255,) if background else (0, 0, 0, 0)
    image = Image.new('RGBA', (big, big), fill)
    draw = ImageDraw.Draw(image)
    font_size = big
    while font_size > 10:
        font = ImageFont.truetype(str(FONT), font_size)
        left, top, right, bottom = draw.textbbox((0, 0), name + '.', font=font)
        if right - left <= big * box and bottom - top <= big * box:
            break
        font_size -= 8
    _, name_top, _, name_bottom = draw.textbbox((0, 0), name, font=font)
    x = (big - (right - left)) / 2 - left
    y = (big - (name_bottom - name_top)) / 2 - name_top
    draw.text((x, y), name, font=font, fill=text_color)
    draw.text((x + draw.textlength(name, font=font), y), '.', font=font, fill=dot_color)
    return image.resize((size, size), Image.LANCZOS)

MASCOT_BG = (122, 92, 18)  # #7A5C12, el marrón de la boca, fondo del icono
FACE_SOURCE = ROOT / 'scripts/cara-mascota.png'  # la cara aprobada por el usuario (1024x1024)
FACE_CENTER = (512.0, 511.5)  # centro y radio de la bola dentro de FACE_SOURCE
FACE_RADIUS = 428.5


def draw_face(size: int, diameter: float, background=None, mono=False):
    """La cara de la mascota, tal cual la imagen aprobada, con la bola a `diameter` (fracción) del lado.

    Se recorta la bola (círculo con borde suave) y se coloca centrada sobre `background` o
    transparente. Con `mono`, silueta blanca con los ojos y la boca recortados (icono monocromo).
    """
    src = Image.open(FACE_SOURCE).convert('RGB')
    pad = src.width  # margen extra para poder alejar la cara (fuera de la bola no se ve)
    padded = Image.new('RGB', (src.width + 2 * pad, src.height + 2 * pad), (228, 187, 87))
    padded.paste(src, (pad, pad))
    src = padded
    cx, cy = FACE_CENTER[0] + pad, FACE_CENTER[1] + pad
    side = FACE_RADIUS * 2 / diameter  # lado del recorte que deja la bola a ese tamaño
    box = (cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2)
    face = src.resize((size, size), Image.LANCZOS, box=box).convert('RGBA')
    # Máscara de la bola: círculo dibujado más grande y reducido, para el borde suave.
    big = size * SUPERSAMPLE
    ball = Image.new('L', (big, big), 0)
    r = big * diameter / 2
    ImageDraw.Draw(ball).ellipse([big / 2 - r, big / 2 - r, big / 2 + r, big / 2 + r], fill=255)
    ball = ball.resize((size, size), Image.LANCZOS)
    if mono:
        # Opaco solo donde hay dorado; ojos y boca (otros colores) quedan transparentes.
        gold = Image.new('RGB', (size, size), (228, 187, 87))
        diff = ImageChops.difference(face.convert('RGB'), gold).convert('L')
        keep = diff.point(lambda v: 255 if v < 40 else max(0, 255 - (v - 40) * 8))
        out = Image.new('RGBA', (size, size), (255, 255, 255, 0))
        out.putalpha(ImageChops.multiply(ball, keep))
        return out
    out = Image.new('RGBA', (size, size), (background + (255,)) if background else (0, 0, 0, 0))
    out.paste(face, (0, 0), ball)
    return out


def main() -> None:
    # Icono (iOS y general): a sangre, el sistema redondea las esquinas.
    draw_face(1024, 0.836, MASCOT_BG).save(ASSETS / 'icon.png')
    # Android adaptativo: el logotipo dentro de la zona segura (círculo del 66 %) y el fondo aparte.
    draw_face(1024, 0.62).save(ASSETS / 'android-icon-foreground.png')
    Image.new('RGBA', (1024, 1024), MASCOT_BG + (255,)).save(ASSETS / 'android-icon-background.png')
    draw_face(1024, 0.62, mono=True).save(ASSETS / 'android-icon-monochrome.png')
    # Icono de las notificaciones (Android lo enseña muy pequeño): solo «K.».
    draw_mark(96, 0.8, WHITE, WHITE, name='K').save(ASSETS / 'notification-icon.png')
    # Pantalla de carga (transparente: el fondo lo pone app.json), una para cada modo.
    draw_mark(1024, 0.92, INK, DARK_GOLD).save(ASSETS / 'splash-icon.png')
    draw_mark(1024, 0.92, BONE, GOLD).save(ASSETS / 'splash-icon-dark.png')
    # Web.
    draw_face(48, 0.836, MASCOT_BG).save(ASSETS / 'favicon.png')
    print('Iconos generados en', ASSETS)


if __name__ == '__main__':
    main()
