"""Child-simple standard pieces. Two finishes, one family of shapes."""
from PIL import Image, ImageDraw
from pathlib import Path

S = 1024
OUT_ICON = Path("/workspace/public/pieces")
OUT_WOOD = Path("/workspace/public/pieces/set2")


def canvas():
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))


def bez(pts, n=18):
    out = []
    for i in range(len(pts) - 1):
        p0 = pts[i]
        p1 = pts[i + 1]
        # quadratic via a midpoint control stored as triples is overkill;
        # callers pass cubic groups.
        out.append(p0)
    return out


def cubics(segments, n=20):
    pts = []
    for p0, p1, p2, p3 in segments:
        for i in range(n):
            t = i / n
            u = 1 - t
            x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
            y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
            pts.append((x, y))
    pts.append(segments[-1][3])
    return pts


def stroke_poly(d, pts, fill, ink, width):
    d.polygon(pts, fill=fill)
    d.line(pts + [pts[0]], fill=ink, width=width, joint="curve")


def plinth(d, fill, ink, width, gold=None):
    cx = S / 2
    bot = S * 0.90
    top = S * 0.755
    mid = S * 0.815
    hb = S * 0.30
    ht = S * 0.22
    # two-step base, narrow enough to leave the file letter
    lower = [(cx - hb, bot), (cx + hb, bot), (cx + hb - 18, mid), (cx - hb + 18, mid)]
    upper = [(cx - ht - 10, mid), (cx + ht + 10, mid), (cx + ht, top), (cx - ht, top)]
    stroke_poly(d, lower, gold or fill, ink, width)
    stroke_poly(d, upper, fill, ink, width)
    d.line([(cx - ht + 28, top + 22), (cx + ht - 28, top + 22)], fill=ink, width=max(10, width - 4))


def king(fill, ink, gold=None):
    im = canvas()
    d = ImageDraw.Draw(im)
    w = 22
    plinth(d, fill, ink, w, gold)
    cx = S / 2
    accent = gold or ink
    body = [
        (cx - 150, 775),
        (cx + 150, 775),
        (cx + 118, 520),
        (cx - 118, 520),
    ]
    stroke_poly(d, body, fill, ink, w)
    # collar
    d.ellipse([cx - 168, 470, cx + 168, 575], fill=fill, outline=ink, width=w)
    # crown
    crown = [
        (cx - 210, 500),
        (cx - 230, 250),
        (cx - 150, 340),
        (cx - 70, 150),
        (cx, 250),
        (cx + 70, 150),
        (cx + 150, 340),
        (cx + 230, 250),
        (cx + 210, 500),
    ]
    stroke_poly(d, crown, fill, ink, w)
    # balls
    for x, y, r in ((cx - 230, 230, 28), (cx, 228, 26), (cx + 230, 230, 28), (cx - 70, 132, 22), (cx + 70, 132, 22)):
        d.ellipse([x - r, y - r, x + r, y + r], fill=accent, outline=ink, width=8)
    # cross, the word "king"
    d.rectangle([cx - 16, 40, cx + 16, 150], fill=accent, outline=ink, width=6)
    d.rectangle([cx - 52, 72, cx + 52, 104], fill=accent, outline=ink, width=6)
    return im


def mantri(fill, ink, gold=None):
    im = canvas()
    d = ImageDraw.Draw(im)
    w = 22
    plinth(d, fill, ink, w, gold)
    cx = S / 2
    body = cubics(
        [
            ((cx - 150, 775), (cx - 170, 620), (cx - 40, 430), (cx, 250)),
            ((cx, 250), (cx + 40, 430), (cx + 170, 620), (cx + 150, 775)),
        ],
        n=28,
    )
    stroke_poly(d, body, fill, ink, w)
    # tip
    d.ellipse([cx - 26, 188, cx + 26, 240], fill=gold or ink, outline=ink, width=8)
    # bold X, not a plus
    d.line([(cx - 78, 390), (cx + 78, 560)], fill=ink, width=36)
    d.line([(cx + 78, 390), (cx - 78, 560)], fill=ink, width=36)
    return im


def elephant(fill, ink, gold=None):
    im = canvas()
    d = ImageDraw.Draw(im)
    w = 18
    # one outline: back, head, hanging trunk, four feet
    pts = [
        (230, 800), (255, 650), (185, 500), (250, 370), (410, 315), (560, 290),
        (650, 210), (735, 225), (785, 310), (860, 430), (885, 575), (855, 710),
        (775, 785), (825, 710), (800, 575), (735, 450), (670, 515),
        (705, 800), (620, 800), (595, 630), (510, 800), (425, 800), (450, 630), (365, 800), (285, 800),
    ]
    d.polygon(pts, fill=fill)
    d.line(pts + [pts[0]], fill=ink, width=w, joint="curve")
    d.ellipse([455, 230, 675, 470], fill=fill, outline=ink, width=w)
    d.ellipse([560, 310, 615, 365], fill=ink)
    d.ellipse([576, 324, 598, 346], fill=(248, 246, 240, 255))
    d.polygon([(650, 470), (635, 445), (745, 500)], fill=(244, 236, 214, 255), outline=ink)
    if gold:
        d.rectangle([360, 400, 400, 620], fill=gold, outline=ink, width=8)
    plinth(d, fill, ink, w, gold)
    return im


def knight(fill, ink, gold=None):
    im = canvas()
    d = ImageDraw.Draw(im)
    w = 20
    plinth(d, fill, ink, w, gold)
    head = [
        (520, 800),
        (400, 750),
        (350, 620),
        (380, 520),
        (300, 450),
        (250, 360),
        (220, 280),
        (280, 230),
        (360, 260),
        (400, 200),
        (500, 150),
        (560, 60),
        (500, 160),
        (620, 130),
        (700, 220),
        (640, 300),
        (730, 360),
        (640, 430),
        (750, 520),
        (660, 640),
        (740, 760),
        (640, 800),
    ]
    stroke_poly(d, head, fill, ink, w)
    d.ellipse([340, 250, 400, 310], fill=ink)
    d.ellipse([358, 266, 382, 290], fill=(248, 246, 240, 255))
    d.ellipse([240, 270, 268, 298], fill=ink)
    return im


def wheel(fill, ink, gold=None):
    im = canvas()
    d = ImageDraw.Draw(im)
    w = 22
    plinth(d, fill, ink, w, gold)
    cx, cy, r = S // 2, 430, 250
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill, outline=ink, width=w)
    d.ellipse([cx - r + 46, cy - r + 46, cx + r - 46, cy + r - 46], outline=ink, width=18)
    d.ellipse([cx - 48, cy - 48, cx + 48, cy + 48], fill=ink)
    d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], fill=gold or fill)
    import math

    for i in range(6):
        a = math.radians(i * 60 - 90)
        x = cx + math.cos(a) * (r - 58)
        y = cy + math.sin(a) * (r - 58)
        d.line([(cx, cy), (x, y)], fill=ink, width=22)
    d.ellipse([cx - 48, cy - 48, cx + 48, cy + 48], fill=ink)
    d.ellipse([cx - 20, cy - 20, cx + 20, cy + 20], fill=gold or fill)
    return im


def castle(fill, ink, gold=None):
    im = canvas()
    d = ImageDraw.Draw(im)
    w = 22
    plinth(d, fill, ink, w, gold)
    cx = S / 2
    tower = [(cx - 200, 775), (cx + 200, 775), (cx + 160, 280), (cx - 160, 280)]
    stroke_poly(d, tower, fill, ink, w)
    # merlons
    for x in (cx - 200, cx - 60, cx + 80):
        d.rectangle([x, 160, x + 90, 300], fill=fill, outline=ink, width=w)
    # door
    d.rounded_rectangle([cx - 55, 560, cx + 55, 775], radius=40, outline=ink, width=16)
    # flag
    d.line([(cx, 160), (cx, 70)], fill=ink, width=12)
    d.polygon([(cx, 70), (cx + 90, 100), (cx, 130)], fill=gold or ink, outline=ink)
    return im


def pawn(fill, ink, gold=None):
    im = canvas()
    d = ImageDraw.Draw(im)
    w = 22
    plinth(d, fill, ink, w, gold)
    cx = S / 2
    body = [(cx - 150, 775), (cx + 150, 775), (cx + 70, 470), (cx - 70, 470)]
    stroke_poly(d, body, fill, ink, w)
    d.ellipse([cx - 130, 430, cx + 130, 520], fill=fill, outline=ink, width=w)
    d.ellipse([cx - 115, 210, cx + 115, 450], fill=fill, outline=ink, width=w)
    return im


def finish(im):
    return im.resize((512, 512), Image.Resampling.LANCZOS)


INK = (22, 22, 24, 255)
IVORY = (246, 243, 234, 255)
WOOD_W = (236, 224, 200, 255)
WOOD_B = (156, 100, 54, 255)
EDGE = (48, 30, 16, 255)
GOLD = (196, 148, 54, 255)

ICON = {
    "raja": king,
    "mantri": mantri,
    "hasthi": elephant,
    "ashwa": knight,
    "ratha": wheel,
    "padati": pawn,
}
WOOD = {**ICON, "ratha": castle}


def main():
    OUT_WOOD.mkdir(parents=True, exist_ok=True)
    for name, fn in ICON.items():
        finish(fn(IVORY, INK)).save(OUT_ICON / f"w-{name}.png")
        finish(fn(INK, IVORY)).save(OUT_ICON / f"b-{name}.png")
    for name, fn in WOOD.items():
        finish(fn(WOOD_W, EDGE, GOLD)).save(OUT_WOOD / f"w-{name}.png")
        finish(fn(WOOD_B, EDGE, GOLD)).save(OUT_WOOD / f"b-{name}.png")
    # phone-size sheet
    order = ["raja", "mantri", "hasthi", "ashwa", "ratha", "padati"]
    sq = 72
    sheet = Image.new("RGB", (sq * 6, sq * 4), (30, 30, 30))
    for block, folder in ((0, OUT_ICON), (2, OUT_WOOD)):
        for row, color in enumerate("wb"):
            for col, name in enumerate(order):
                bg = (238, 238, 210) if (row + col) % 2 == 0 else (118, 150, 86)
                cell = Image.new("RGBA", (sq, sq), bg + (255,))
                im = Image.open(folder / f"{color}-{name}.png").convert("RGBA")
                im.thumbnail((sq - 2, sq - 2), Image.Resampling.LANCZOS)
                cell.alpha_composite(im, ((sq - im.width) // 2, (sq - im.height) // 2))
                sheet.paste(cell.convert("RGB"), (col * sq, (block + row) * sq))
    sheet.save("/workspace/artifacts/polished-small.jpg", quality=92)
    print("wrote")


if __name__ == "__main__":
    main()
