"""coroom 앱 아이콘("CR") 생성 스크립트. 차분한 블루 톤 그라데이션 + 화이트 볼드 텍스트."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
SUPERSAMPLE = 4  # 안티앨리어싱을 위한 고해상도 렌더링 후 축소

# 차분한(desaturated) 블루 톤 그라데이션
TOP_COLOR = (91, 127, 181)     # #5B7FB5 - 부드러운 슬레이트 블루
BOTTOM_COLOR = (35, 58, 92)    # #233A5C - 차분한 딥 네이비
TEXT_COLOR = (255, 255, 255)

FONT_CANDIDATES = [
    "C:/Windows/Fonts/segoeuib.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]


def load_font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def vertical_gradient(size, top, bottom):
    img = Image.new("RGB", (1, size), color=0)
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        draw.point((0, y), fill=(r, g, b))
    return img.resize((size, size))


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def draw_cr_text(canvas, size, font_scale):
    draw = ImageDraw.Draw(canvas)
    font = load_font(int(size * font_scale))
    text = "CR"
    bbox = draw.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - w) / 2 - bbox[0]
    y = (size - h) / 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=TEXT_COLOR)


def make_icon(size, rounded=True, corner_ratio=0.22, font_scale=0.44, filename=None):
    hi = size * SUPERSAMPLE
    bg = vertical_gradient(hi, TOP_COLOR, BOTTOM_COLOR)
    canvas = Image.new("RGBA", (hi, hi), (0, 0, 0, 0))
    canvas.paste(bg, (0, 0))

    draw_cr_text(canvas, hi, font_scale)

    if rounded:
        mask = rounded_mask(hi, int(hi * corner_ratio))
        canvas.putalpha(mask)

    final = canvas.resize((size, size), Image.LANCZOS)
    final.save(os.path.join(OUT_DIR, filename))
    print("saved", filename, size)


# 일반 아이콘 (둥근 사각형, 브라우저/데스크톱 표시용)
make_icon(192, rounded=True, corner_ratio=0.22, font_scale=0.44, filename="icon-192.png")
make_icon(512, rounded=True, corner_ratio=0.22, font_scale=0.44, filename="icon-512.png")

# 마스커블 아이콘 (풀블리드, 80% 세이프존 안에 텍스트 배치 - font_scale 축소)
make_icon(192, rounded=False, font_scale=0.34, filename="icon-maskable-192.png")
make_icon(512, rounded=False, font_scale=0.34, filename="icon-maskable-512.png")

# iOS 홈 화면 아이콘 (iOS가 자체적으로 모서리를 둥글게 처리하므로 풀블리드 + 약간의 세이프존)
make_icon(180, rounded=False, font_scale=0.38, filename="apple-touch-icon.png")

# 파비콘
make_icon(32, rounded=True, corner_ratio=0.28, font_scale=0.5, filename="favicon-32.png")
make_icon(16, rounded=True, corner_ratio=0.28, font_scale=0.5, filename="favicon-16.png")

# favicon.ico (멀티 사이즈)
sizes = [16, 32, 48]
imgs = []
for s in sizes:
    hi = s * SUPERSAMPLE
    bg = vertical_gradient(hi, TOP_COLOR, BOTTOM_COLOR)
    canvas = Image.new("RGBA", (hi, hi), (0, 0, 0, 0))
    canvas.paste(bg, (0, 0))
    draw_cr_text(canvas, hi, 0.5)
    mask = rounded_mask(hi, int(hi * 0.28))
    canvas.putalpha(mask)
    imgs.append(canvas.resize((s, s), Image.LANCZOS))

imgs[0].save(os.path.join(OUT_DIR, "favicon.ico"), format="ICO", sizes=[(s, s) for s in sizes], append_images=imgs[1:])
print("saved favicon.ico")
