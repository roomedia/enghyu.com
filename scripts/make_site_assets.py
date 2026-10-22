#!/usr/bin/env python3
"""사이트 기본 이미지 자산을 생성한다 (OG 기본 커버 + Organization 로고).

텍스트만으로 구성한 브랜드 카드 — 실제 사이트명·설명 외 내용은 넣지 않는다.
한 번 생성해 레포에 커밋하는 자산이라 배포 파이프라인에서는 실행하지 않는다.
"""
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"

INK = (25, 25, 25)
PAPER = (251, 252, 250)
MUTED = (85, 96, 90)
ACCENT = (254, 229, 0)


def font(path, size):
    return ImageFont.truetype(path, size)


def rounded(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def make_cover():
    img = Image.new("RGB", (1200, 630), PAPER)
    d = ImageDraw.Draw(img)
    # 로고 마크
    rounded(d, (90, 120, 164, 194), 20, ACCENT)
    d.text((127, 157), "e", font=font(FONT_BOLD, 40), fill=INK, anchor="mm")
    d.text((88, 250), "enghyu", font=font(FONT_BOLD, 96), fill=INK)
    d.text((90, 400), "웹에서 끝나는 작은 도구들 · AX 트렌드",
           font=font(FONT_REG, 36), fill=MUTED)
    out = os.path.join(ROOT, "site-cover.png")
    img.save(out)
    print(f"site-cover.png 생성 ({os.path.getsize(out)} bytes)")


def make_logo():
    img = Image.new("RGBA", (600, 600), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rounded(d, (110, 110, 490, 490), 112, ACCENT)
    d.text((300, 306), "e", font=font(FONT_BOLD, 190), fill=INK, anchor="mm")
    out = os.path.join(ROOT, "site-logo.png")
    img.save(out)
    print(f"site-logo.png 생성 ({os.path.getsize(out)} bytes)")


if __name__ == "__main__":
    make_cover()
    make_logo()
