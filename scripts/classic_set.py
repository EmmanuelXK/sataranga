"""Original tournament set in the molded style of a modern chess app.
Not a copy of any existing piece art. Sataranga keeps the elephant and the X.
"""
from pathlib import Path
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 1280
OUT = Path("/workspace/public/pieces/classic")

WHITE = {
    "hi": np.array([255, 253, 248], dtype=np.float32),
    "mid": np.array([232, 222, 204], dtype=np.float32),
    "lo": np.array([186, 164, 136], dtype=np.float32),
    "groove": (150, 126, 96, 255),
}
BLACK = {
    "hi": np.array([132, 136, 144], dtype=np.float32),
    "mid": np.array([54, 56, 62], dtype=np.float32),
    "lo": np.array([20, 20, 24], dtype=np.float32),
    "groove": (10, 10, 12, 255),
}


def blank():
    return Image.new("L", (S, S), 0)


def cubics(segments, n=28):
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


def foot(d, top=860):
    """Shared Staunton foot. Every piece stands on this."""
    cx = S / 2
    d.polygon(
        [
            (cx - 250, top + 150),
            (cx + 250, top + 150),
            (cx + 210, top + 70),
            (cx - 210, top + 70),
        ],
        fill=255,
    )
    d.rounded_rectangle([cx - 250, top + 118, cx + 250, top + 186], radius=36, fill=255)
    d.polygon(
        [
            (cx - 196, top + 78),
            (cx + 196, top + 78),
            (cx + 168, top),
            (cx - 168, top),
        ],
        fill=255,
    )
    d.ellipse([cx - 188, top - 28, cx + 188, top + 36], fill=255)


def shade(mask_img, pal):
    mask = np.array(mask_img) > 20
    h, w = mask.shape
    ys, xs = np.indices((h, w))
    alpha = np.array(mask_img).astype(np.float32)
    if not mask.any():
        return Image.new("RGBA", (w, h), (0, 0, 0, 0))
    y0, y1 = ys[mask].min(), ys[mask].max()
    x0, x1 = xs[mask].min(), xs[mask].max()
    v = np.clip((ys - y0) / max(1, y1 - y0), 0, 1)
    u = np.clip((xs - (x0 + x1) / 2) / max(1, (x1 - x0) / 2), -1.2, 1.2)
    # light from the upper left, the way a studio piece is lit
    t = np.clip(0.62 - 0.34 * u - 0.22 * v, 0, 1)
    hi, mid, lo = pal["hi"], pal["mid"], pal["lo"]
    rgb = np.empty((h, w, 3), dtype=np.float32)
    left = t >= 0.5
    k = np.where(left, (t - 0.5) * 2, t * 2)
    for c in range(3):
        a = np.where(left, mid[c] + (hi[c] - mid[c]) * k, lo[c] + (mid[c] - lo[c]) * k)
        rgb[:, :, c] = a
    # soft bevel: darken the outer couple of pixels so the shape holds on a light square
    # approximate with a blurred mask
    blur = np.array(mask_img.filter(ImageFilter.GaussianBlur(6))).astype(np.float32) / 255
    edge = np.clip((blur - 0.15) / 0.7, 0, 1)
    rgb *= 0.72 + 0.28 * edge[:, :, None]
    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out[:, :, 3] = np.clip(alpha, 0, 255).astype(np.uint8)
    im = Image.fromarray(out, "RGBA")
    # contact shadow
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    cx = (x0 + x1) / 2
    sd.ellipse([cx - 230, y1 - 30, cx + 230, y1 + 36], fill=(0, 0, 0, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    base = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    base.alpha_composite(shadow)
    base.alpha_composite(im)
    return base


def groove(im, y, half, pal):
    d = ImageDraw.Draw(im)
    cx = S / 2
    d.line([(cx - half, y), (cx + half, y)], fill=pal["groove"], width=14)
    return im


def king(pal):
    m = blank()
    d = ImageDraw.Draw(m)
    foot(d, 900)
    cx = S / 2
    d.polygon([(cx - 150, 920), (cx + 150, 920), (cx + 108, 620), (cx - 108, 620)], fill=255)
    d.ellipse([cx - 150, 560, cx + 150, 680], fill=255)
    # crown cup
    d.polygon(
        [
            (cx - 200, 600),
            (cx - 230, 300),
            (cx - 140, 390),
            (cx - 60, 210),
            (cx, 300),
            (cx + 60, 210),
            (cx + 140, 390),
            (cx + 230, 300),
            (cx + 200, 600),
        ],
        fill=255,
    )
    for x, y, r in ((cx - 230, 285, 34), (cx + 230, 285, 34), (cx - 60, 198, 26), (cx + 60, 198, 26)):
        d.ellipse([x - r, y - r, x + r, y + r], fill=255)
    # cross
    d.rounded_rectangle([cx - 20, 70, cx + 20, 210], radius=8, fill=255)
    d.rounded_rectangle([cx - 62, 112, cx + 62, 150], radius=8, fill=255)
    im = shade(m, pal)
    return groove(im, 980, 180, pal)


def mantri(pal):
    m = blank()
    d = ImageDraw.Draw(m)
    foot(d, 940)
    cx = S / 2
    body = cubics(
        [
            ((cx - 130, 960), (cx - 160, 760), (cx - 70, 520), (cx, 300)),
            ((cx, 300), (cx + 70, 520), (cx + 160, 760), (cx + 130, 960)),
        ],
        n=36,
    )
    d.polygon(body, fill=255)
    d.ellipse([cx - 28, 248, cx + 28, 304], fill=255)
    im = shade(m, pal)
    dr = ImageDraw.Draw(im)
    # carved X, the minister's mark
    dr.line([(cx - 78, 470), (cx + 78, 690)], fill=pal["groove"], width=28)
    dr.line([(cx + 78, 470), (cx - 78, 690)], fill=pal["groove"], width=28)
    return groove(im, 1010, 170, pal)


def knight(pal):
    m = blank()
    d = ImageDraw.Draw(m)
    foot(d, 980)
    raw = [
        (560, 1020),
        (470, 980),
        (430, 840),
        (390, 720),
        (300, 640),
        (250, 520),
        (230, 400),
        (310, 330),
        (400, 360),
        (450, 280),
        (520, 230),
        (600, 150),
        (690, 175),
        (620, 250),
        (720, 210),
        (760, 280),
        (680, 360),
        (800, 430),
        (700, 520),
        (820, 640),
        (720, 780),
        (800, 920),
        (680, 1020),
    ]

    def smooth(pts, iters=3):
        pts = list(pts)
        for _ in range(iters):
            nxt = []
            n = len(pts)
            for i in range(n):
                p = pts[i]
                q = pts[(i + 1) % n]
                nxt.append((0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]))
                nxt.append((0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]))
            pts = nxt
        return pts

    d.polygon(smooth(raw), fill=255)
    im = shade(m, pal)
    dr = ImageDraw.Draw(im)
    dr.ellipse([430, 330, 490, 390], fill=pal["groove"])
    dr.ellipse([450, 348, 472, 370], fill=(255, 252, 245, 255))
    dr.ellipse([285, 390, 314, 418], fill=pal["groove"])
    return groove(im, 1050, 155, pal)


def rook(pal):
    m = blank()
    d = ImageDraw.Draw(m)
    foot(d, 960)
    cx = S / 2
    d.polygon([(cx - 175, 980), (cx + 175, 980), (cx + 145, 430), (cx - 145, 430)], fill=255)
    d.rectangle([cx - 190, 300, cx + 190, 460], fill=255)
    for x in (cx - 190, cx - 55, cx + 80):
        d.rounded_rectangle([x, 180, x + 100, 340], radius=10, fill=255)
    im = shade(m, pal)
    return groove(im, 1030, 160, pal)


def pawn(pal):
    m = blank()
    d = ImageDraw.Draw(m)
    foot(d, 980)
    cx = S / 2
    d.polygon([(cx - 120, 1000), (cx + 120, 1000), (cx + 62, 620), (cx - 62, 620)], fill=255)
    d.ellipse([cx - 108, 575, cx + 108, 680], fill=255)
    d.ellipse([cx - 108, 330, cx + 108, 560], fill=255)
    im = shade(m, pal)
    return groove(im, 1050, 150, pal)


def elephant(pal):
    m = blank()
    d = ImageDraw.Draw(m)
    foot(d, 980)
    # compact carved elephant, same footprint family as the knight
    pts = [
        (340, 1000),
        (360, 860),
        (300, 740),
        (360, 620),
        (500, 560),
        (640, 520),
        (720, 430),
        (800, 450),
        (860, 540),
        (930, 680),
        (900, 860),
        (820, 960),
        (880, 880),
        (860, 740),
        (790, 640),
        (720, 700),
        (760, 1000),
        (670, 1000),
        (650, 820),
        (560, 1000),
        (470, 1000),
        (490, 820),
        (400, 1000),
    ]
    d.polygon(pts, fill=255)
    d.ellipse([500, 470, 730, 720], fill=255)
    im = shade(m, pal)
    dr = ImageDraw.Draw(im)
    dr.ellipse([600, 560, 655, 615], fill=pal["groove"])
    dr.ellipse([618, 574, 638, 594], fill=(255, 252, 245, 255))
    dr.polygon([(690, 680), (675, 650), (770, 700)], fill=(236, 226, 206, 255))
    return groove(im, 1055, 160, pal)


def finish(im):
    return im.resize((512, 512), Image.Resampling.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    fns = {
        "raja": king,
        "mantri": mantri,
        "hasthi": elephant,
        "ashwa": knight,
        "ratha": rook,
        "padati": pawn,
    }
    for name, fn in fns.items():
        finish(fn(WHITE)).save(OUT / f"w-{name}.png")
        finish(fn(BLACK)).save(OUT / f"b-{name}.png")
    order = list(fns)
    sq = 86
    sheet = Image.new("RGB", (sq * 6, sq * 2), (20, 20, 20))
    for row, color in enumerate("wb"):
        for col, name in enumerate(order):
            bg = (238, 238, 210) if (row + col) % 2 == 0 else (118, 150, 86)
            cell = Image.new("RGBA", (sq, sq), bg + (255,))
            im = Image.open(OUT / f"{color}-{name}.png").convert("RGBA")
            im.thumbnail((sq - 4, sq - 4), Image.Resampling.LANCZOS)
            cell.alpha_composite(im, ((sq - im.width) // 2, (sq - im.height) // 2))
            sheet.paste(cell.convert("RGB"), (col * sq, row * sq))
    sheet.save("/workspace/artifacts/classic-small.jpg", quality=92)
    # larger white row
    big = 200
    rowim = Image.new("RGB", (big * 6, big), (90, 110, 70))
    for col, name in enumerate(order):
        bg = (238, 238, 210) if col % 2 == 0 else (118, 150, 86)
        cell = Image.new("RGBA", (big, big), bg + (255,))
        im = Image.open(OUT / f"w-{name}.png").convert("RGBA").resize((big, big))
        cell.alpha_composite(im)
        rowim.paste(cell.convert("RGB"), (col * big, 0))
    rowim.save("/workspace/artifacts/classic-large.jpg", quality=92)
    print("wrote")


if __name__ == "__main__":
    main()
