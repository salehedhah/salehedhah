#!/usr/bin/env python3
"""Generate Vida's silver product illustrations and banners as SVG files.

Run from the theme root:  python3 tools/generate_assets.py
"""
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRODUCTS = os.path.join(ROOT, "assets", "img", "products")
BANNERS = os.path.join(ROOT, "assets", "img", "banners")

# ---------------------------------------------------------------- shared defs
DEFS = """
<defs>
  <linearGradient id="silver" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fbfcfd"/>
    <stop offset=".22" stop-color="#c7ccd4"/>
    <stop offset=".45" stop-color="#8a919c"/>
    <stop offset=".62" stop-color="#eef1f4"/>
    <stop offset=".8" stop-color="#a3a9b3"/>
    <stop offset="1" stop-color="#e3e6ea"/>
  </linearGradient>
  <linearGradient id="silverV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset=".35" stop-color="#b9bfc8"/>
    <stop offset=".55" stop-color="#7d8490"/>
    <stop offset=".75" stop-color="#dfe3e8"/>
    <stop offset="1" stop-color="#9aa1ab"/>
  </linearGradient>
  <linearGradient id="silverDark" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6b727d"/>
    <stop offset=".5" stop-color="#3d434c"/>
    <stop offset="1" stop-color="#8b929c"/>
  </linearGradient>
  <radialGradient id="gem" cx=".38" cy=".32" r=".75">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset=".35" stop-color="#eaf3ff"/>
    <stop offset=".7" stop-color="#b8c9dc"/>
    <stop offset="1" stop-color="#7f93aa"/>
  </radialGradient>
  <radialGradient id="aqeeq" cx=".35" cy=".3" r=".8">
    <stop offset="0" stop-color="#ffb199"/>
    <stop offset=".25" stop-color="#c2412a"/>
    <stop offset=".7" stop-color="#7a1a10"/>
    <stop offset="1" stop-color="#3d0a05"/>
  </radialGradient>
  <radialGradient id="sapphire" cx=".35" cy=".3" r=".8">
    <stop offset="0" stop-color="#c9dcff"/>
    <stop offset=".3" stop-color="#3a64c8"/>
    <stop offset=".75" stop-color="#16296b"/>
    <stop offset="1" stop-color="#0a1233"/>
  </radialGradient>
  <radialGradient id="emerald" cx=".35" cy=".3" r=".8">
    <stop offset="0" stop-color="#c8ffe6"/>
    <stop offset=".3" stop-color="#1f9d6b"/>
    <stop offset=".75" stop-color="#0b5138"/>
    <stop offset="1" stop-color="#042419"/>
  </radialGradient>
  <radialGradient id="pearl" cx=".36" cy=".3" r=".78">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset=".45" stop-color="#f6f1ea"/>
    <stop offset=".8" stop-color="#d9d2c8"/>
    <stop offset="1" stop-color="#b5ada2"/>
  </radialGradient>
  <radialGradient id="bgLight" cx=".5" cy=".42" r=".75">
    <stop offset="0" stop-color="#fbfaf8"/>
    <stop offset=".6" stop-color="#eeece8"/>
    <stop offset="1" stop-color="#dcd9d3"/>
  </radialGradient>
  <radialGradient id="bgDark" cx=".5" cy=".45" r=".8">
    <stop offset="0" stop-color="#2f3238"/>
    <stop offset=".6" stop-color="#17191d"/>
    <stop offset="1" stop-color="#0b0c0e"/>
  </radialGradient>
  <radialGradient id="shadow" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#000" stop-opacity=".28"/>
    <stop offset="1" stop-color="#000" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="sparkle" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#fff" stop-opacity="1"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity=".22"/>
  </filter>
</defs>
"""


def svg(w, h, body, bg="bgLight"):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
        f"{DEFS}<rect width='{w}' height='{h}' fill='url(#{bg})'/>{body}</svg>\n"
    )


def f(n):
    return f"{n:.1f}"


# -------------------------------------------------------------- primitives
def floor_shadow(cx, cy, rx, ry=None):
    ry = ry or rx * 0.12
    return f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="url(#shadow)"/>'


def sparkle(x, y, s=18):
    return (
        f'<g transform="translate({f(x)} {f(y)})" opacity=".95">'
        f'<circle r="{f(s*.55)}" fill="url(#sparkle)"/>'
        f'<path d="M0 {-s} L{s*.12} {-s*.12} L{s} 0 L{s*.12} {s*.12} L0 {s} L{-s*.12} {s*.12} L{-s} 0 L{-s*.12} {-s*.12}Z" fill="#fff"/></g>'
    )


def round_gem(cx, cy, r, fill="gem"):
    facets = []
    for i in range(8):
        a = i * math.pi / 4
        facets.append(
            f'<line x1="{f(cx)}" y1="{f(cy)}" x2="{f(cx + r*math.cos(a))}" y2="{f(cy + r*math.sin(a))}"/>'
        )
    return (
        f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r+ r*.18)}" fill="url(#silver)"/>'
        f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="url(#{fill})"/>'
        f'<g stroke="#fff" stroke-opacity=".45" stroke-width="{f(max(r*.05,.6))}">{"".join(facets)}</g>'
        f'<polygon points="{",".join(f"{f(cx + r*.55*math.cos(i*math.pi/4 + math.pi/8))} {f(cy + r*.55*math.sin(i*math.pi/4+math.pi/8))}" for i in range(8))}" '
        f'fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="{f(max(r*.05,.6))}"/>'
        f'<ellipse cx="{f(cx - r*.35)}" cy="{f(cy - r*.38)}" rx="{f(r*.28)}" ry="{f(r*.16)}" fill="#fff" opacity=".8" transform="rotate(-30 {f(cx - r*.35)} {f(cy - r*.38)})"/>'
    )


def cabochon(cx, cy, rx, ry, fill):
    return (
        f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx*1.16)}" ry="{f(ry*1.16)}" fill="url(#silver)" stroke="#6f7680" stroke-width="2"/>'
        f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx*1.04)}" ry="{f(ry*1.04)}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>'
        f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="url(#{fill})"/>'
        f'<ellipse cx="{f(cx - rx*.32)}" cy="{f(cy - ry*.42)}" rx="{f(rx*.35)}" ry="{f(ry*.18)}" fill="#fff" opacity=".55" transform="rotate(-25 {f(cx - rx*.32)} {f(cy - ry*.42)})"/>'
    )


def diamond_side(cx, top, w):
    """A brilliant-cut stone seen from the side (crown + pavilion)."""
    h1, h2 = w * .28, w * .62
    tw = w * .55
    pts_crown = f"{f(cx-tw/2)},{f(top)} {f(cx+tw/2)},{f(top)} {f(cx+w/2)},{f(top+h1)} {f(cx-w/2)},{f(top+h1)}"
    pts_pav = f"{f(cx-w/2)},{f(top+h1)} {f(cx+w/2)},{f(top+h1)} {f(cx)},{f(top+h1+h2)}"
    lines = "".join(
        f'<line x1="{f(cx-w/2 + w*i/4)}" y1="{f(top+h1)}" x2="{f(cx)}" y2="{f(top+h1+h2)}"/>' for i in range(1, 4)
    )
    lines += "".join(
        f'<line x1="{f(cx-tw/2 + tw*i/3)}" y1="{f(top)}" x2="{f(cx-w/2 + w*(i*2-1)/6 + w/12)}" y2="{f(top+h1)}"/>' for i in range(0, 4)
    )
    return (
        f'<polygon points="{pts_pav}" fill="url(#gem)"/>'
        f'<polygon points="{pts_crown}" fill="#f4f9ff"/>'
        f'<g stroke="#9fb3c9" stroke-width="1.4" stroke-opacity=".8">{lines}</g>'
        f'<polygon points="{pts_crown}" fill="none" stroke="#c6d4e3" stroke-width="1.5"/>'
    )


def ring(cx, cy, rx, ry, thick, grad="silver"):
    """Band seen in perspective: back edge darker, front edge bright."""
    return (
        f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="none" stroke="url(#silverDark)" stroke-width="{f(thick)}"/>'
        f'<path d="M{f(cx-rx)} {f(cy)} A{f(rx)} {f(ry)} 0 0 0 {f(cx+rx)} {f(cy)}" fill="none" stroke="url(#{grad})" stroke-width="{f(thick)}" stroke-linecap="round"/>'
        f'<path d="M{f(cx-rx*.92)} {f(cy+ry*.35)} A{f(rx)} {f(ry)} 0 0 0 {f(cx+rx*.3)} {f(cy+ry*.98)}" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="{f(thick*.18)}" stroke-linecap="round"/>'
    )


def chain_along(points, link=14, thick=3.2):
    """Draw alternating oval links along a polyline of sample points."""
    out = []
    dist = 0.0
    acc = []
    for i in range(1, len(points)):
        (x0, y0), (x1, y1) = points[i - 1], points[i]
        seg = math.hypot(x1 - x0, y1 - y0)
        steps = max(int(seg), 1)
        for s in range(steps):
            t = s / steps
            dist += seg / steps
            if dist >= link * .82:
                dist = 0
                acc.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, math.degrees(math.atan2(y1 - y0, x1 - x0))))
    for i, (x, y, a) in enumerate(acc):
        if i % 2 == 0:
            out.append(
                f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(link*.62)}" ry="{f(link*.36)}" transform="rotate({f(a)} {f(x)} {f(y)})" fill="none" stroke="url(#silver)" stroke-width="{f(thick)}"/>'
            )
        else:
            out.append(
                f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(link*.62)}" ry="{f(link*.12)}" transform="rotate({f(a)} {f(x)} {f(y)})" fill="none" stroke="#9aa1ab" stroke-width="{f(thick)}"/>'
            )
    return "".join(out)


def curve_points(cx, top, w, depth, n=240):
    """U-shaped necklace curve (catenary-ish)."""
    pts = []
    for i in range(n + 1):
        t = -1 + 2 * i / n
        pts.append((cx + t * w / 2, top + depth * (1 - (math.cosh(t * 1.6) - 1) / (math.cosh(1.6) - 1))))
    return pts


def ellipse_points(cx, cy, rx, ry, n=360, start=0, end=360):
    return [
        (cx + rx * math.cos(math.radians(a)), cy + ry * math.sin(math.radians(a)))
        for a in [start + (end - start) * i / n for i in range(n + 1)]
    ]


# ------------------------------------------------------------ jewellery pieces
def p_solitaire(cx=400, cy=470, s=1.0):
    rx, ry = 190 * s, 70 * s
    return (
        floor_shadow(cx, cy + 150 * s, 260 * s, 26 * s)
        + ring(cx, cy, rx, ry, 30 * s)
        # prongs + basket
        + f'<path d="M{f(cx-70*s)} {f(cy-ry+6*s)} L{f(cx-42*s)} {f(cy-ry-78*s)} L{f(cx+42*s)} {f(cy-ry-78*s)} L{f(cx+70*s)} {f(cy-ry+6*s)} Z" fill="url(#silverV)" stroke="#7d8490" stroke-width="2"/>'
        + diamond_side(cx, cy - ry - 170 * s, 170 * s)
        + "".join(
            f'<path d="M{f(cx + dx*s)} {f(cy-ry-80*s)} L{f(cx + dx*1.08*s)} {f(cy-ry-160*s)}" stroke="url(#silverV)" stroke-width="{f(9*s)}" stroke-linecap="round"/>'
            for dx in (-72, -26, 26, 72)
        )
        + sparkle(cx - 48 * s, cy - ry - 150 * s, 26 * s)
        + sparkle(cx + 150 * s, cy - 40 * s, 14 * s)
    )


def p_band(cx=400, cy=430, s=1.0):
    rx, ry = 200 * s, 88 * s
    lines = "".join(
        f'<path d="M{f(cx - rx + i*s)} {f(cy)} A{f(rx)} {f(ry)} 0 0 0 {f(cx + rx - i*s)} {f(cy)}" fill="none" stroke="#6e757f" stroke-opacity=".5" stroke-width="{f(1.6*s)}"/>'
        for i in (-18, 18)
    )
    return (
        floor_shadow(cx, cy + 170 * s, 270 * s, 26 * s)
        + ring(cx, cy, rx, ry, 64 * s)
        + ring(cx, cy + 36 * s, rx, ry, 18 * s, "silverV")
        + lines
        + sparkle(cx - 120 * s, cy + 70 * s, 22 * s)
    )


def p_aqeeq(cx=400, cy=470, s=1.0, stone="aqeeq"):
    rx, ry = 180 * s, 72 * s
    return (
        floor_shadow(cx, cy + 150 * s, 260 * s, 26 * s)
        + ring(cx, cy, rx, ry, 42 * s)
        + f'<path d="M{f(cx-120*s)} {f(cy-ry+12*s)} Q{f(cx)} {f(cy-ry-60*s)} {f(cx+120*s)} {f(cy-ry+12*s)} L{f(cx+95*s)} {f(cy-ry+40*s)} Q{f(cx)} {f(cy-ry-10*s)} {f(cx-95*s)} {f(cy-ry+40*s)}Z" fill="url(#silverV)" stroke="#6f7680" stroke-width="2"/>'
        + cabochon(cx, cy - ry - 62 * s, 110 * s, 78 * s, stone)
        + sparkle(cx + 60 * s, cy - ry - 110 * s, 22 * s)
    )


def p_pendant(cx=400, top=110, s=1.0, style="drop"):
    pts = curve_points(cx, top, 560 * s, 360 * s)
    tip_y = top + 360 * s
    body = floor_shadow(cx, 730, 240, 22) + chain_along(pts, 15 * s, 3.4 * s)
    body += f'<circle cx="{f(cx)}" cy="{f(tip_y + 14*s)}" r="{f(12*s)}" fill="none" stroke="url(#silver)" stroke-width="{f(6*s)}"/>'
    if style == "drop":
        py = tip_y + 30 * s
        body += (
            f'<path d="M{f(cx)} {f(py)} C{f(cx+80*s)} {f(py+90*s)} {f(cx+70*s)} {f(py+190*s)} {f(cx)} {f(py+200*s)} C{f(cx-70*s)} {f(py+190*s)} {f(cx-80*s)} {f(py+90*s)} {f(cx)} {f(py)}Z" fill="url(#silver)" stroke="#6f7680" stroke-width="2" filter="url(#soft)"/>'
            f'<path d="M{f(cx)} {f(py+28*s)} C{f(cx+56*s)} {f(py+100*s)} {f(cx+48*s)} {f(py+172*s)} {f(cx)} {f(py+178*s)} C{f(cx-48*s)} {f(py+172*s)} {f(cx-56*s)} {f(py+100*s)} {f(cx)} {f(py+28*s)}Z" fill="url(#sapphire)"/>'
            f'<ellipse cx="{f(cx-18*s)}" cy="{f(py+95*s)}" rx="{f(10*s)}" ry="{f(26*s)}" fill="#fff" opacity=".45" transform="rotate(20 {f(cx-18*s)} {f(py+95*s)})"/>'
            + sparkle(cx + 40 * s, py + 60 * s, 20 * s)
        )
    elif style == "crescent":
        py = tip_y + 120 * s
        r = 100 * s
        mid = f"crescent-{int(cx)}-{int(py)}"
        body += (
            f'<mask id="{mid}"><rect x="{f(cx-2*r)}" y="{f(py-2*r)}" width="{f(4*r)}" height="{f(4*r)}" fill="#fff"/>'
            f'<circle cx="{f(cx+r*.42)}" cy="{f(py-r*.28)}" r="{f(r*.86)}" fill="#000"/></mask>'
            f'<g filter="url(#soft)"><circle cx="{f(cx)}" cy="{f(py)}" r="{f(r)}" fill="url(#silver)" mask="url(#{mid})"/></g>'
            f'<circle cx="{f(cx)}" cy="{f(py)}" r="{f(r*.93)}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="{f(2*s)}" mask="url(#{mid})"/>'
            + round_gem(cx + 62 * s, py + 58 * s, 13 * s)
            + sparkle(cx - 60 * s, py - 50 * s, 22 * s)
        )
    elif style == "letter":
        py = tip_y + 40 * s
        body += (
            f'<circle cx="{f(cx)}" cy="{f(py+95*s)}" r="{f(95*s)}" fill="url(#silver)" stroke="#6f7680" stroke-width="2" filter="url(#soft)"/>'
            f'<circle cx="{f(cx)}" cy="{f(py+95*s)}" r="{f(80*s)}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="{f(3*s)}"/>'
            f'<text x="{f(cx)}" y="{f(py+130*s)}" text-anchor="middle" font-family="Georgia, \'Times New Roman\', serif" font-size="{f(110*s)}" fill="#5d646e" font-style="italic">V</text>'
            + sparkle(cx + 70 * s, py + 30 * s, 20 * s)
        )
    return body


def earring_drop(cx, top, s, stone="pearl"):
    hook = (
        f'<path d="M{f(cx)} {f(top+120*s)} L{f(cx)} {f(top+40*s)} C{f(cx)} {f(top-20*s)} {f(cx+70*s)} {f(top-20*s)} {f(cx+64*s)} {f(top+40*s)}" '
        f'fill="none" stroke="url(#silver)" stroke-width="{f(7*s)}" stroke-linecap="round"/>'
    )
    if stone == "pearl":
        return (
            hook
            + round_gem(cx, top + 120 * s, 14 * s)
            + f'<line x1="{f(cx)}" y1="{f(top+134*s)}" x2="{f(cx)}" y2="{f(top+160*s)}" stroke="url(#silver)" stroke-width="{f(5*s)}"/>'
            + f'<circle cx="{f(cx)}" cy="{f(top+215*s)}" r="{f(58*s)}" fill="url(#pearl)" filter="url(#soft)"/>'
            + f'<ellipse cx="{f(cx-18*s)}" cy="{f(top+195*s)}" rx="{f(16*s)}" ry="{f(10*s)}" fill="#fff" opacity=".9"/>'
        )
    # geometric drop with emerald
    return (
        hook
        + f'<polygon points="{f(cx)},{f(top+120*s)} {f(cx+60*s)},{f(top+210*s)} {f(cx)},{f(top+320*s)} {f(cx-60*s)},{f(top+210*s)}" fill="url(#silver)" stroke="#6f7680" stroke-width="2" filter="url(#soft)"/>'
        + cabochon(cx, top + 215 * s, 30 * s, 44 * s, "emerald")
    )


def p_earrings_drop(stone="pearl"):
    return (
        floor_shadow(400, 690, 260, 22)
        + earring_drop(290, 180, 1.25, stone)
        + earring_drop(510, 150, 1.25, stone)
        + sparkle(600, 250, 22)
    )


def p_hoops():
    body = floor_shadow(400, 680, 280, 24)
    for cx, cy, rx, ry in ((300, 400, 130, 170), (510, 380, 120, 160)):
        body += (
            f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none" stroke="url(#silverDark)" stroke-width="26"/>'
            f'<path d="M{cx} {cy-ry} A{rx} {ry} 0 0 1 {cx} {cy+ry}" fill="none" stroke="url(#silver)" stroke-width="26"/>'
            f'<path d="M{cx+rx*.3} {cy-ry*.93} A{rx} {ry} 0 0 1 {cx+rx*.98} {cy+ry*.1}" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="5" stroke-linecap="round"/>'
        )
    return body + sparkle(620, 250, 22) + sparkle(210, 520, 14)


def p_studs():
    body = floor_shadow(400, 640, 260, 22)
    for cx, cy, r in ((290, 400, 1.0), (520, 380, 1.0)):
        petals = "".join(
            f'<ellipse cx="{f(cx + 58*math.cos(math.radians(a)))}" cy="{f(cy + 58*math.sin(math.radians(a)))}" rx="44" ry="28" '
            f'transform="rotate({a} {f(cx + 58*math.cos(math.radians(a)))} {f(cy + 58*math.sin(math.radians(a)))})" fill="url(#silver)" stroke="#6f7680" stroke-width="2"/>'
            for a in range(0, 360, 60)
        )
        small = "".join(round_gem(cx + 58 * math.cos(math.radians(a)), cy + 58 * math.sin(math.radians(a)), 10) for a in range(0, 360, 60))
        body += f'<g filter="url(#soft)">{petals}</g>{small}' + round_gem(cx, cy, 34)
    return body + sparkle(420, 300, 24)


def p_bangle(cx=400, cy=420, stones=True):
    rx, ry = 250, 120
    body = floor_shadow(cx, cy + 190, 320, 30)
    body += (
        f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none" stroke="url(#silverDark)" stroke-width="46"/>'
        f'<path d="M{cx-rx} {cy} A{rx} {ry} 0 0 0 {cx+rx} {cy}" fill="none" stroke="url(#silver)" stroke-width="46" stroke-linecap="round"/>'
        f'<path d="M{cx-rx} {cy+22} A{rx} {ry} 0 0 0 {cx+rx} {cy+22}" fill="none" stroke="url(#silverV)" stroke-width="12"/>'
    )
    if stones:
        for a in range(25, 160, 13):
            x = cx + rx * math.cos(math.radians(a)) * -1
            y = cy + ry * math.sin(math.radians(a)) - 4
            body += round_gem(x, y, 10)
    return body + sparkle(cx + 170, cy - 120, 24)


def p_tennis(cx=400, cy=420):
    rx, ry = 240, 125
    body = floor_shadow(cx, cy + 190, 310, 28)
    back = ellipse_points(cx, cy, rx, ry, n=34, start=180, end=360)
    front = ellipse_points(cx, cy, rx, ry, n=34, start=0, end=180)
    for x, y in back:
        body += f'<circle cx="{f(x)}" cy="{f(y)}" r="14" fill="url(#silverDark)"/><circle cx="{f(x)}" cy="{f(y)}" r="9" fill="#b9c7d6" opacity=".7"/>'
    for x, y in front:
        body += round_gem(x, y, 13)
    return body + sparkle(cx - 200, cy + 60, 24) + sparkle(cx + 120, cy + 140, 16)


def p_chain_bracelet(cx=400, cy=420):
    pts = ellipse_points(cx, cy, 240, 130, n=720)
    return (
        floor_shadow(cx, cy + 200, 310, 28)
        + chain_along(pts, 30, 7)
        + f'<rect x="{cx+200}" y="{cy+40}" width="70" height="30" rx="12" fill="url(#silver)" stroke="#6f7680" stroke-width="2" transform="rotate(-30 {cx+235} {cy+55})"/>'
        + sparkle(cx - 150, cy - 110, 22)
    )


def p_cuff(cx=400, cy=430):
    rx, ry = 230, 130
    body = floor_shadow(cx, cy + 190, 300, 28)
    body += (
        f'<path d="M{cx-rx*.75} {cy-ry*.66} A{rx} {ry} 0 1 0 {cx+rx*.75} {cy-ry*.66}" fill="none" stroke="url(#silverDark)" stroke-width="90"/>'
        f'<path d="M{cx-rx} {cy} A{rx} {ry} 0 0 0 {cx+rx} {cy}" fill="none" stroke="url(#silver)" stroke-width="90"/>'
    )
    # engraved arabesque waves on the front
    for k in (-24, 0, 24):
        pts = []
        for i in range(0, 181, 3):
            a = math.radians(i)
            x = cx + rx * math.cos(a)
            y = cy + ry * math.sin(a) + k + 7 * math.sin(i / 7)
            pts.append(f"{f(x)},{f(y)}")
        body += f'<polyline points="{" ".join(pts)}" fill="none" stroke="#6e757f" stroke-opacity=".55" stroke-width="2"/>'
    return body + sparkle(cx + 130, cy + 110, 24)


def p_anklet():
    pts = curve_points(400, 200, 600, 280)
    body = floor_shadow(400, 690, 280, 22) + chain_along(pts, 12, 2.8)
    for i in range(12, len(pts) - 12, 20):
        x, y = pts[i]
        body += f'<line x1="{f(x)}" y1="{f(y)}" x2="{f(x)}" y2="{f(y+34)}" stroke="url(#silver)" stroke-width="3"/>'
        body += f'<circle cx="{f(x)}" cy="{f(y+44)}" r="11" fill="url(#silver)" stroke="#6f7680" stroke-width="1.5"/>'
    return body + sparkle(560, 360, 20)


def p_mens_signet():
    cx, cy, s = 400, 480, 1.0
    rx, ry = 175, 70
    return (
        floor_shadow(cx, cy + 150, 260, 26)
        + ring(cx, cy, rx, ry, 54)
        + f'<path d="M{cx-120} {cy-ry+20} L{cx-100} {cy-ry-80} L{cx+100} {cy-ry-80} L{cx+120} {cy-ry+20}Z" fill="url(#silverV)" stroke="#6f7680" stroke-width="2"/>'
        + f'<rect x="{cx-110}" y="{cy-ry-190}" width="220" height="130" rx="26" fill="url(#silver)" stroke="#6f7680" stroke-width="2" filter="url(#soft)"/>'
        + f'<rect x="{cx-88}" y="{cy-ry-172}" width="176" height="94" rx="16" fill="url(#silverDark)"/>'
        + f'<rect x="{cx-80}" y="{cy-ry-165}" width="160" height="80" rx="12" fill="url(#sapphire)" opacity=".9"/>'
        + f'<path d="M{cx-60} {cy-ry-158} L{cx+10} {cy-ry-158} L{cx-40} {cy-ry-95}Z" fill="#fff" opacity=".25"/>'
        + sparkle(cx + 90, cy - ry - 190, 22)
    )


# -------------------------------------------------------------- write files
PRODUCT_ART = {
    "ring-solitaire": lambda: svg(800, 800, p_solitaire()),
    "ring-band": lambda: svg(800, 800, p_band()),
    "ring-aqeeq": lambda: svg(800, 800, p_aqeeq(), "bgDark"),
    "ring-signet": lambda: svg(800, 800, p_mens_signet(), "bgDark"),
    "necklace-drop": lambda: svg(800, 800, p_pendant(style="drop")),
    "necklace-crescent": lambda: svg(800, 800, p_pendant(style="crescent")),
    "necklace-letter": lambda: svg(800, 800, p_pendant(style="letter")),
    "earrings-pearl": lambda: svg(800, 800, p_earrings_drop("pearl")),
    "earrings-emerald": lambda: svg(800, 800, p_earrings_drop("emerald"), "bgDark"),
    "earrings-hoops": lambda: svg(800, 800, p_hoops()),
    "earrings-studs": lambda: svg(800, 800, p_studs()),
    "bracelet-bangle": lambda: svg(800, 800, p_bangle()),
    "bracelet-tennis": lambda: svg(800, 800, p_tennis(), "bgDark"),
    "bracelet-chain": lambda: svg(800, 800, p_chain_bracelet()),
    "bracelet-cuff": lambda: svg(800, 800, p_cuff()),
    "anklet-bells": lambda: svg(800, 800, p_anklet()),
}


def g(content, x, y, s):
    return f'<g transform="translate({x} {y}) scale({s})">{content}</g>'


def banner_lines(w, h, color="#ffffff", op=".07"):
    out = []
    for i in range(9):
        out.append(
            f'<path d="M{-100 + i*40} {h} C{w*.3} {h*.2 - i*18} {w*.6} {h*.9 + i*10} {w+100} {h*.05 + i*22}" fill="none" stroke="{color}" stroke-opacity="{op}" stroke-width="1.4"/>'
        )
    return "".join(out)


def banner_hero_1():
    # dark luxury: solitaire + tennis bracelet on the left (RTL layout keeps text on the right)
    w, h = 1600, 800
    body = banner_lines(w, h)
    body += f'<circle cx="430" cy="400" r="330" fill="#fff" opacity=".035"/>'
    body += g(p_tennis(), -70, 170, .95)
    body += g(p_solitaire(), 250, -10, 1.0)
    body += sparkle(760, 150, 30) + sparkle(120, 170, 18)
    return svg(w, h, body, "bgDark")


def banner_hero_2():
    w, h = 1600, 800
    body = banner_lines(w, h, "#8a8f98", ".18")
    body += g(p_pendant(style="crescent"), -20, -60, 1.1)
    body += g(p_earrings_drop("pearl"), 420, 170, .8)
    return svg(w, h, body, "bgLight")


def banner_hero_3():
    w, h = 1600, 800
    body = banner_lines(w, h)
    body += g(p_aqeeq(), -40, 20, 1.0)
    body += g(p_mens_signet(), 380, 130, .85)
    body += sparkle(700, 180, 26)
    return svg(w, h, body, "bgDark")


def banner_promo():
    w, h = 1600, 600
    body = banner_lines(w, h)
    body += g(p_bangle(), 0, -60, .85)
    body += g(p_cuff(), 500, 0, .75)
    return svg(w, h, body, "bgDark")


def banner_gift():
    w, h = 1200, 800
    ox = -40  # box sits in the left half; RTL copy occupies the right half
    body = banner_lines(w, h, "#8a8f98", ".16")
    body += f'<g transform="translate({ox} 20)">'
    body += '<rect x="130" y="330" width="440" height="330" rx="18" fill="#141518"/>'
    body += '<rect x="110" y="285" width="480" height="84" rx="14" fill="#1e2024"/>'
    body += '<rect x="450" y="285" width="40" height="375" fill="url(#silver)"/>'
    body += '<rect x="110" y="313" width="480" height="26" fill="url(#silver)"/>'
    body += (
        '<path d="M470 285 C395 185 310 220 365 285Z" fill="url(#silver)" stroke="#6f7680" stroke-width="2"/>'
        '<path d="M470 285 C550 185 630 220 575 285Z" fill="url(#silver)" stroke="#6f7680" stroke-width="2"/>'
    )
    body += '<text x="285" y="515" text-anchor="middle" font-family="Georgia, serif" font-size="58" letter-spacing="12" fill="#d9dde2">VIDA</text>'
    body += floor_shadow(350, 690, 300, 24) + sparkle(610, 250, 28) + sparkle(140, 600, 18) + "</g>"
    return svg(w, h, body, "bgLight")


def banner_story():
    w, h = 900, 1100
    body = banner_lines(w, h)
    body += g(p_pendant(style="drop"), 50, 60, 1.0)
    body += g(p_studs(), 200, 560, .6)
    return svg(w, h, body, "bgDark")


BANNER_ART = {
    "hero-1": banner_hero_1,
    "hero-2": banner_hero_2,
    "hero-3": banner_hero_3,
    "promo": banner_promo,
    "gift": banner_gift,
    "story": banner_story,
}


def main():
    os.makedirs(PRODUCTS, exist_ok=True)
    os.makedirs(BANNERS, exist_ok=True)
    for name, fn in PRODUCT_ART.items():
        with open(os.path.join(PRODUCTS, f"{name}.svg"), "w") as fh:
            fh.write(fn())
    for name, fn in BANNER_ART.items():
        with open(os.path.join(BANNERS, f"{name}.svg"), "w") as fh:
            fh.write(fn())
    print(f"wrote {len(PRODUCT_ART)} products, {len(BANNER_ART)} banners")


if __name__ == "__main__":
    main()
