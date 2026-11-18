#!/usr/bin/env python3
"""Generates the 'High Altar' team-PK t-shirt design as an SVG (fan art, original drawing)."""
import math, random
random.seed(7)
W, H = 1500, 1800
OUT = []
def add(s): OUT.append(s)
INK = "#140d08"

# ---------------------------------------------------------------- character
def person(x, y, s, c, arms, face=1, weapon=None, hood=False, helm=None, cape=None, extra=""):
    """Blocky low-poly figure, feet at (x,y). arms = (back_angle, front_angle) deg; -90 = forward."""
    g = [f'<g transform="translate({x},{y}) scale({s*face},{s})" stroke="{INK}" stroke-width="5" stroke-linejoin="round">']
    if cape:
        g.append(f'<polygon points="-36,-168 34,-168 46,-30 -48,-24" fill="{cape}"/>')
    def arm(a, col, front):
        out = [f'<g transform="translate({38 if front else -38},-164) rotate({a})">',
               f'<polygon points="-11,0 11,0 9,72 -9,72" fill="{col}"/>',
               f'<rect x="-10" y="68" width="20" height="18" fill="{c["skin"] if not c.get("glove") else c["glove"]}"/>']
        if front and weapon: out.append(f'<g transform="translate(0,80)">{weapon}</g>')
        if not front and c.get("offhand"): out.append(f'<g transform="translate(0,80)">{c["offhand"]}</g>')
        out.append('</g>')
        return "".join(out)
    g.append(arm(arms[0], c["arm_b"], False))
    # legs
    g.append(f'<polygon points="-30,-92 -4,-92 -6,-6 -30,-6" fill="{c["legs"]}"/>')
    g.append(f'<polygon points="4,-92 30,-92 30,-6 6,-6" fill="{c["legs2"]}"/>')
    g.append(f'<rect x="-34" y="-14" width="30" height="16" fill="{c["boots"]}"/>')
    g.append(f'<rect x="4" y="-14" width="32" height="16" fill="{c["boots"]}"/>')
    # torso
    g.append(f'<polygon points="-34,-88 34,-88 42,-172 -42,-172" fill="{c["body"]}"/>')
    g.append(f'<polygon points="-34,-88 34,-88 36,-104 -36,-104" fill="{c["belt"]}"/>')
    if c.get("trim"):
        g.append(f'<polygon points="-6,-172 6,-172 6,-104 -6,-104" fill="{c["trim"]}" stroke-width="3"/>')
    # head
    g.append(f'<polygon points="-22,-172 22,-172 24,-222 -24,-222" fill="{c["skin"]}"/>')
    g.append(f'<rect x="4" y="-206" width="10" height="7" fill="{INK}" stroke="none"/>')
    if hood:
        g.append(f'<polygon points="-30,-168 -32,-226 -10,-240 22,-236 30,-212 20,-210 20,-232 -6,-232 -14,-168" fill="{c["hood"]}"/>')
    if helm == "full":
        g.append(f'<polygon points="-26,-170 26,-170 28,-228 -28,-228" fill="{c["helm"]}"/>')
        g.append(f'<rect x="-2" y="-210" width="26" height="8" fill="{INK}" stroke="none"/>')
        g.append(f'<polygon points="-4,-228 4,-228 0,-252" fill="{c.get("plume","#b01818")}"/>')
    if helm == "coif":
        g.append(f'<polygon points="-28,-168 -28,-228 26,-228 26,-196 14,-196 14,-216 -10,-216 -10,-168" fill="{c["helm"]}"/>')
    g.append(extra)
    g.append(arm(arms[1], c["arm_f"], True))
    g.append('</g>')
    add("".join(g))

# ---------------------------------------------------------------- weapons (drawn along +y)
def godsword(glow=True):
    g = ""
    if glow:
        g += '<polygon points="-34,10 34,10 30,250 0,300 -30,250" fill="#ffe46b" opacity=".35" stroke="none"/>'
    g += ('<rect x="-8" y="-14" width="16" height="30" fill="#4a3a6a"/>'
          '<polygon points="-34,14 34,14 30,30 -30,30" fill="#e7b928"/>'
          '<polygon points="-20,30 20,30 22,250 0,286 -22,250" fill="#dfe6ee"/>'
          '<polygon points="-4,36 4,36 4,250 -4,250" fill="#9aa8b8" stroke="none"/>'
          '<polygon points="-30,22 -46,-4 -26,10" fill="#2f6fd6"/><polygon points="30,22 46,-4 26,10" fill="#2f6fd6"/>')
    return g

def claws():
    g = ""
    for dx, l in ((-10, 60), (0, 72), (10, 60)):
        g += f'<path d="M{dx-5},4 Q{dx+18},{l*0.55} {dx+4},{l} Q{dx+2},{l*0.55} {dx-5+0},{12}" fill="#c4161c"/>'
    return g

def staff(orb="#7fe6ff"):
    return ('<rect x="-6" y="-80" width="12" height="230" fill="#5b3d21"/>'
            f'<polygon points="0,138 18,160 0,196 -18,160" fill="{orb}"/>'
            '<polygon points="-16,132 16,132 12,146 -12,146" fill="#e7b928"/>')

# ---------------------------------------------------------------- effects
def hitsplat(x, y, n, s=1.0, col="#c8141c"):
    pts = []
    for i in range(14):
        a = i / 14 * 2 * math.pi
        r = 46 if i % 2 == 0 else 34
        pts.append(f"{x + r*s*math.cos(a):.1f},{y + r*s*0.82*math.sin(a):.1f}")
    add(f'<polygon points="{" ".join(pts)}" fill="{col}" stroke="{INK}" stroke-width="5"/>')
    add(f'<text x="{x+2}" y="{y+15*s+2}" font-family="Liberation Sans" font-weight="700" font-size="{40*s}" text-anchor="middle" fill="{INK}">{n}</text>')
    add(f'<text x="{x}" y="{y+15*s}" font-family="Liberation Sans" font-weight="700" font-size="{40*s}" text-anchor="middle" fill="#fff">{n}</text>')

def ice_spike(x, y, h, w, lean=0):
    add(f'<polygon points="{x-w},{y} {x+lean},{y-h} {x+w},{y}" fill="#bff3ff" stroke="#0e3b5c" stroke-width="5"/>')
    add(f'<polygon points="{x-w*0.2},{y} {x+lean},{y-h} {x+w*0.6},{y}" fill="#ffffff" opacity=".75"/>')

def overhead(x, y, txt, size=46, col="#ffff00"):
    add(f'<text x="{x+3}" y="{y+3}" font-family="Liberation Sans" font-weight="700" font-size="{size}" text-anchor="middle" fill="#000">{txt}</text>')
    add(f'<text x="{x}" y="{y}" font-family="Liberation Sans" font-weight="700" font-size="{size}" text-anchor="middle" fill="{col}">{txt}</text>')

def skull(x, y, s=1):
    add(f'<g transform="translate({x},{y}) scale({s})" stroke="{INK}" stroke-width="4">'
        '<path d="M-22,6 Q-26,-30 0,-32 Q26,-30 22,6 L14,8 L14,20 L-14,20 L-14,8 Z" fill="#f4f1e6"/>'
        f'<circle cx="-9" cy="-8" r="7" fill="{INK}"/><circle cx="9" cy="-8" r="7" fill="{INK}"/>'
        f'<polygon points="0,0 -4,8 4,8" fill="{INK}"/></g>')

# ================================================================= COMPOSITION
add(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">')
add('''<defs>
<radialGradient id="sky" cx="50%" cy="38%" r="65%">
  <stop offset="0" stop-color="#7a3b1f"/><stop offset=".55" stop-color="#3d1c10"/><stop offset="1" stop-color="#1c0d07"/></radialGradient>
<radialGradient id="frost" cx="50%" cy="50%" r="50%">
  <stop offset="0" stop-color="#e9fdff" stop-opacity=".95"/><stop offset=".45" stop-color="#7fdcff" stop-opacity=".55"/><stop offset="1" stop-color="#2a8fd6" stop-opacity="0"/></radialGradient>
<linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#4b3a2a"/><stop offset="1" stop-color="#2a1f15"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#fff27a"/><stop offset=".5" stop-color="#ffd21a"/><stop offset="1" stop-color="#d98a00"/></linearGradient>
<clipPath id="disc"><circle cx="750" cy="860" r="600"/></clipPath>
<path id="arcTop" d="M 210,860 A 540,540 0 0 1 1290,860"/>
</defs>''')

# --- emblem disc
add('<circle cx="750" cy="860" r="636" fill="#0d0805"/>')
add('<circle cx="750" cy="860" r="622" fill="#6f6a62" stroke="#0d0805" stroke-width="8"/>')
# stone rim blocks
for i in range(40):
    a0, a1 = i / 40 * 2 * math.pi, (i + 1) / 40 * 2 * math.pi
    r0, r1 = 600, 622
    p = [(750 + r * math.cos(a), 860 + r * math.sin(a)) for r, a in ((r0, a0), (r1, a0), (r1, a1), (r0, a1))]
    shade = random.choice(["#8a847a", "#7a746b", "#9a948a", "#6b655d"])
    add(f'<polygon points="{" ".join(f"{px:.1f},{py:.1f}" for px, py in p)}" fill="{shade}" stroke="#0d0805" stroke-width="3"/>')

add('<g clip-path="url(#disc)">')
add('<rect x="0" y="0" width="1500" height="1800" fill="url(#sky)"/>')
# dead wildy trees / hills silhouette
add('<path d="M150,1000 L260,930 L360,960 L470,900 L600,950 L760,890 L900,940 L1030,895 L1170,950 L1350,910 L1350,1500 L150,1500 Z" fill="#2a160c"/>')
for tx, th in ((300, 140), (1180, 170), (1290, 110)):
    add(f'<path d="M{tx},960 L{tx},{960-th} M{tx},{960-th*0.6} L{tx-34},{960-th*0.85} M{tx},{960-th*0.75} L{tx+30},{960-th*0.98} M{tx},{960-th*0.4} L{tx+26},{960-th*0.55}" stroke="#170b05" stroke-width="12" stroke-linecap="round" fill="none"/>')
# ground
add('<rect x="0" y="1050" width="1500" height="800" fill="url(#ground)"/>')
for i in range(60):
    gx, gy = random.uniform(160, 1340), random.uniform(1080, 1440)
    add(f'<rect x="{gx:.0f}" y="{gy:.0f}" width="{random.uniform(10,30):.0f}" height="6" fill="#5c4733" opacity=".7"/>')

# --- frost aura behind victim
add('<circle cx="750" cy="900" r="330" fill="url(#frost)"/>')
# radiating ice shards (barrage burst)
for i in range(16):
    a = i / 16 * 2 * math.pi + 0.1
    r0, r1 = 160, 330 + (i % 3) * 40
    x0, y0 = 750 + r0 * math.cos(a), 880 + r0 * math.sin(a)
    x1, y1 = 750 + r1 * math.cos(a), 880 + r1 * math.sin(a)
    nx, ny = -math.sin(a) * 16, math.cos(a) * 16
    add(f'<polygon points="{x0+nx:.0f},{y0+ny:.0f} {x1:.0f},{y1:.0f} {x0-nx:.0f},{y0-ny:.0f}" fill="#c9f6ff" opacity=".55"/>')

# --- the altar (dais + table + candles) behind the victim
add(f'<polygon points="470,1120 1030,1120 1080,1190 420,1190" fill="#8a847a" stroke="{INK}" stroke-width="6"/>')
add(f'<polygon points="520,1060 980,1060 1030,1120 470,1120" fill="#a29c91" stroke="{INK}" stroke-width="6"/>')
for bx in range(470, 1030, 70):
    add(f'<line x1="{bx}" y1="1120" x2="{bx-12}" y2="1190" stroke="{INK}" stroke-width="3"/>')
add(f'<polygon points="560,880 940,880 940,1060 560,1060" fill="#7c766c" stroke="{INK}" stroke-width="6"/>')
add(f'<polygon points="540,860 960,860 960,890 540,890" fill="#b8b2a6" stroke="{INK}" stroke-width="6"/>')
add(f'<polygon points="600,890 900,890 880,990 620,990" fill="#f2efe4" stroke="{INK}" stroke-width="5"/>')
add(f'<polygon points="735,905 765,905 765,930 790,930 790,950 765,950 765,980 735,980 735,950 710,950 710,930 735,930" fill="#e2b13a" stroke="{INK}" stroke-width="3"/>')
for cx in (575, 925):
    add(f'<rect x="{cx-10}" y="800" width="20" height="60" fill="#efe6c8" stroke="{INK}" stroke-width="4"/>')
    add(f'<path d="M{cx},798 Q{cx-12},780 {cx},758 Q{cx+12},780 {cx},798 Z" fill="#ffcf3a" stroke="#a24a00" stroke-width="3"/>')

# --- victim, frozen on the altar
victim = dict(skin="#d9a273", body="#3f5fa8", arm_b="#35508f", arm_f="#3f5fa8", legs="#4a3b8c", legs2="#3d3076",
              boots="#3a2a1a", belt="#2b2b2b", hood="#4a3b8c", trim="#d4c38a")
person(750, 1095, 1.45, victim, (-8, 14), face=1, hood=True)
# ice block encasing him
add('<polygon points="610,1100 600,780 660,700 840,700 900,780 890,1100" fill="#9fe6ff" opacity=".42" stroke="#e8fbff" stroke-width="6"/>')
add('<polygon points="630,1090 625,790 670,725 700,725 655,800 660,1090" fill="#ffffff" opacity=".35"/>')
add('<polyline points="700,830 740,870 725,920 770,960" fill="none" stroke="#ffffff" stroke-width="4" opacity=".8"/>')
add('<polyline points="820,760 800,800 830,840" fill="none" stroke="#ffffff" stroke-width="4" opacity=".8"/>')
for sx, sh, sw, ln in ((585, 150, 32, -18), (640, 110, 26, 6), (870, 160, 34, 20), (915, 115, 26, 10), (760, 90, 30, 0), (700, 80, 22, -8), (820, 95, 24, 6)):
    ice_spike(sx, 1120, sh, sw, ln)
# health bar & skull
add(f'<rect x="680" y="638" width="140" height="22" fill="#d8141c" stroke="{INK}" stroke-width="4"/>')
add(f'<rect x="682" y="640" width="12" height="18" fill="#23d62e"/>')
skull(750, 604, 1.0)

# --- attackers
ancestral = dict(skin="#d9a273", body="#1f2d52", arm_b="#1a2647", arm_f="#1f2d52", legs="#1f2d52", legs2="#1a2647",
                 boots="#2a1d12", belt="#b8902a", hood="#1f2d52", trim="#c9a23a")
# back-left barrager (smaller, further away)
mystic = dict(skin="#c48a5c", body="#2a2a2a", arm_b="#222", arm_f="#2a2a2a", legs="#2a2a2a", legs2="#222",
              boots="#1b130c", belt="#7a1a1a", hood="#2a2a2a", trim="#7a1a1a")
person(360, 1010, 0.95, mystic, (10, -110), face=1, weapon=staff("#9ef0ff"), hood=True)
# ice barrage projectile streaks from casters
add('<path d="M470,800 Q600,740 690,820" stroke="#bff3ff" stroke-width="18" fill="none" stroke-linecap="round" opacity=".85"/>')
add('<path d="M470,800 Q600,740 690,820" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round"/>')

# main barrager, left foreground
person(330, 1360, 1.55, ancestral, (14, -112), face=1, weapon=staff(), hood=True)
add('<circle cx="610" cy="905" r="38" fill="#e9fdff" stroke="#2a8fd6" stroke-width="6"/>')
add('<path d="M610,872 L610,938 M581,889 L639,921 M581,921 L639,889" stroke="#2a8fd6" stroke-width="6"/>')
add('<path d="M520,940 Q560,920 590,912" stroke="#bff3ff" stroke-width="14" fill="none" stroke-linecap="round" opacity=".9"/>')

# AGS warrior, right side, sword raised overhead about to slam
torva = dict(skin="#d9a273", body="#3b3b44", arm_b="#2f2f36", arm_f="#3b3b44", legs="#3b3b44", legs2="#2f2f36",
             boots="#1d1d22", belt="#8a1c1c", helm="#3b3b44", plume="#c8141c")
person(1150, 1300, 1.5, torva, (-200, -165), face=-1, weapon=godsword(), helm="full", cape="#9c1414")
# AGS spec flash
for i in range(10):
    a = -math.pi / 2 + (i - 4.5) * 0.22
    add(f'<line x1="{1060+60*math.cos(a):.0f}" y1="{680+60*math.sin(a):.0f}" x2="{1060+140*math.cos(a):.0f}" y2="{680+140*math.sin(a):.0f}" stroke="#ffe46b" stroke-width="7" stroke-linecap="round"/>')

# D claws user, front right lunging
dhide = dict(skin="#c48a5c", body="#1d1d1d", arm_b="#2b4f22", arm_f="#2b4f22", legs="#1d1d1d", legs2="#151515",
             boots="#3a2a1a", belt="#7a1a1a", helm="#2b4f22", trim="#2b4f22", glove="#5a3a20", offhand=claws())
person(1010, 1440, 1.6, dhide, (-70, -125), face=-1, weapon=claws(), helm="coif")
# claw slash marks across the ice block
for i, off in enumerate((-36, 0, 36)):
    add(f'<path d="M{880+off},740 Q{790+off},880 {690+off},1010" stroke="#fff6c8" stroke-width="{14-i*2}" fill="none" stroke-linecap="round" opacity=".9"/>')
    add(f'<path d="M{880+off},740 Q{790+off},880 {690+off},1010" stroke="#ff3a2a" stroke-width="4" fill="none" stroke-linecap="round"/>')

# --- hitsplats stack (claws 4-hit + AGS + barrage)
hitsplat(632, 765, 32)
hitsplat(872, 760, 16)
hitsplat(628, 1010, 8, 0.85)
hitsplat(882, 880, 8, 0.85)
hitsplat(750, 1045, 73, 1.25)
hitsplat(880, 1010, 30, 0.9)

# --- overhead chat
overhead(1255, 905, "Sit.", 60)
overhead(750, 545, "tele tele tele", 34, "#ffff00")
add('</g>')  # end clip

# --- title arc
add('<text font-family="Liberation Serif" font-weight="700" font-size="150" letter-spacing="10" text-anchor="middle" '
    'stroke="#000" stroke-width="22" stroke-linejoin="round" fill="#000"><textPath href="#arcTop" startOffset="50%">HIGH ALTAR</textPath></text>')
add('<text font-family="Liberation Serif" font-weight="700" font-size="150" letter-spacing="10" text-anchor="middle" '
    'fill="url(#gold)" stroke="#5a2a00" stroke-width="3"><textPath href="#arcTop" startOffset="50%">HIGH ALTAR</textPath></text>')

# --- bottom ribbon banner
add(f'<polygon points="120,1430 230,1400 230,1560 120,1590 170,1495" fill="#5a0b0b" stroke="{INK}" stroke-width="8"/>')
add(f'<polygon points="1380,1430 1270,1400 1270,1560 1380,1590 1330,1495" fill="#5a0b0b" stroke="{INK}" stroke-width="8"/>')
add(f'<polygon points="200,1380 1300,1380 1300,1540 200,1540" fill="#9c1414" stroke="{INK}" stroke-width="8"/>')
add('<polygon points="210,1392 1290,1392 1290,1404 210,1404" fill="#c43030"/>')
for txt, dx in (("FREEZE • SPEC • SIT", 0),):
    add(f'<text x="753" y="1503" font-family="Liberation Serif" font-weight="700" font-size="104" text-anchor="middle" fill="#000">{txt}</text>')
    add(f'<text x="750" y="1498" font-family="Liberation Serif" font-weight="700" font-size="104" text-anchor="middle" fill="url(#gold)" stroke="#5a2a00" stroke-width="2">{txt}</text>')
add('<text x="750" y="1640" font-family="Liberation Sans" font-weight="700" font-size="54" letter-spacing="14" text-anchor="middle" '
    'fill="#ffffff" stroke="#000" stroke-width="10" paint-order="stroke">BARRAGE · CLAWS · AGS</text>')
add('<text x="750" y="1720" font-family="Liberation Sans" font-weight="700" font-size="40" letter-spacing="12" text-anchor="middle" '
    'fill="#ffd21a" stroke="#000" stroke-width="8" paint-order="stroke">TEAM PK — LVL 38 WILDY</text>')
add('</svg>')

open(__file__.replace("make_design.py", "high-altar-pk.svg"), "w").write("\n".join(OUT))
print("ok")
