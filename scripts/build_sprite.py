"""Build the pixel Nathan sprite atlas, in the style of the Codex version.

The base parts (head, shirt, legs, wave, phone, cooking) are the hand-authored
64 x 96 artwork from the Codex preview (October 19, 2026), rasterized from their
path data. Poses it did not have (relaxed arms, blink, a magnifier, thinking,
thumbs up, a head turned toward the direction of travel) are painted here on the
same grid with the same palette.

Output: assets/nathan-sprite.svg, one row of 64 x 88 cells (rows 5 to 92 of the
original grid). Frame order must match F in sprite.js.

    python3 scripts/build_sprite.py
"""
import re
from pathlib import Path

GRID_W, GRID_H = 64, 96
TOP, BOTTOM = 5, 93  # rows kept
CELL_H = BOTTOM - TOP

CODEX_PARTS = {
    "head": [
        ("#25272b", "M26 7H36V9H40V11H43V15H45V24H42V28H39V31H26V29H22V26H20V22H19V15H21V11H24V9H26Z"),
        ("#dba681", "M25 16H39V19H41V27H38V31H35V35H28V31H25V28H23V20H25Z"),
        ("#edbd95", "M27 18H37V21H39V26H36V29H28V27H25V22H27Z"),
        ("#c78d69", "M23 22H25V27H28V30H35V32H28V30H25V28H23ZM36 28H39V30H36Z"),
        ("#25272b", "M24 11H31V17H29V21H26V23H23V25H21V16H24ZM34 11H40V14H43V23H40V21H37V18H35V16H34Z"),
        ("#3c3e42", "M25 11H29V13H26V17H23V20H22V15H25ZM35 10H39V12H41V17H39V14H37V12H35Z"),
        ("#55565a", "M27 9H31V10H28V12H26V14H25V11H27ZM34 9H37V10H39V11H36V10H34Z"),
        ("#363134", "M27 23H29V25H27ZM36 23H38V25H36Z"),
        ("#bd815f", "M32 24H33V27H31V26H32ZM29 28H30V29H36V28H37V30H35V31H31V30H29Z"),
        ("#fff3dd", "M30 28H36V29H30Z"),
    ],
    "shirt": [
        ("#c9cfcb", "M25 33H28V35H35V33H39V35H42V38H44V45H41V56H40V59H23V56H22V46H19V39H21V36H25Z"),
        ("#f7f7ef", "M25 35H28V37H35V35H38V37H41V43H38V56H24V44H21V39H24V37H25Z"),
        ("#e3e8e2", "M36 37H39V44H38V56H34V54H36ZM24 46H26V53H29V55H24Z"),
        ("#aeb8b1", "M25 56H39V58H24V57H25Z"),
    ],
    "stand": [
        ("#25292e", "M24 58H40V61H41V76H43V86H33V72H31V85H21V77H22V64H24Z"),
        ("#3b4045", "M25 61H28V72H26V82H23V75H24V65H25ZM35 62H38V77H40V84H37V78H36V69H35Z"),
        ("#171c22", "M21 84H31V88H33V91H18V89H19V86H21ZM34 85H43V87H46V91H33V87H34Z"),
        ("#52595e", "M20 87H25V88H22V89H19V88H20ZM38 87H43V88H45V89H39V88H38Z"),
        ("#7b8385", "M18 91H32V92H18ZM34 91H46V92H34Z"),
    ],
    "step-left": [
        ("#25292e", "M24 58H40V61H41V69H39V74H37V84H28V79H30V72H31V67H28V73H25V80H21V88H11V83H15V78H18V72H20V65H24Z"),
        ("#3b4045", "M25 62H28V68H25V74H21V80H18V84H15V81H18V76H21V70H23V65H25ZM35 62H38V68H36V76H33V81H31V78H33V70H35Z"),
        ("#171c22", "M11 85H21V89H23V92H8V90H9V87H11ZM28 83H37V86H40V90H27V86H28Z"),
        ("#52595e", "M10 88H16V89H13V90H9V89H10ZM31 85H36V86H39V88H33V87H31Z"),
        ("#7b8385", "M8 92H23V93H8ZM28 90H40V91H28Z"),
    ],
    "step-right": [
        ("#25292e", "M24 58H40V63H42V69H45V75H48V84H38V79H35V73H32V68H30V78H28V86H18V78H20V69H22V63H24Z"),
        ("#3b4045", "M25 62H28V69H25V77H23V83H20V78H22V70H24V65H25ZM35 62H38V69H41V75H44V82H41V77H38V72H35Z"),
        ("#171c22", "M18 84H28V88H30V91H15V89H16V86H18ZM38 83H48V86H51V90H37V86H38Z"),
        ("#52595e", "M17 87H22V88H19V89H16V88H17ZM42 85H47V86H50V88H44V87H42Z"),
        ("#7b8385", "M15 91H30V92H15ZM38 90H51V91H38Z"),
    ],
    "grip-arms": [
        ("#c78d69", "M20 43H24V46H27V42H30V37H34V43H32V47H29V50H23V48H20ZM40 43H44V47H42V50H36V47H34V42H32V37H36V41H39V45H40Z"),
        ("#edbd95", "M20 43H23V47H26V45H29V41H31V36H34V40H32V44H30V47H27V49H24V47H21ZM41 43H44V46H41V48H38V46H36V43H34V39H32V36H35V40H37V43H39V46H41Z"),
    ],
    "wave-up": [
        ("#dba681", "M20 43H24V51H27V55H23V53H20ZM41 42H45V37H48V28H46V25H47V21H49V23H50V20H52V24H54V23H55V28H53V31H52V40H49V44H45V46H41Z"),
        ("#f0c5a1", "M48 25H52V29H50V37H48ZM21 44H23V51H25V53H23V51H21Z"),
    ],
    "wave-down": [
        ("#dba681", "M20 43H24V51H27V55H23V53H20ZM41 42H45V39H49V33H51V27H49V24H50V21H52V24H54V23H56V27H58V29H57V32H54V37H52V42H49V46H44V47H41Z"),
        ("#f0c5a1", "M52 27H55V31H53V36H51V38H49V35H51ZM21 44H23V51H25V53H23V51H21Z"),
    ],
    "phone-arms": [
        ("#dba681", "M20 43H24V51H27V55H23V53H20ZM41 43H45V40H43V36H40V30H37V31H36V35H38V40H39V45H41Z"),
        ("#181f27", "M35 26H42V37H35Z"),
        ("#94afa7", "M36 28H41V34H36Z"),
        ("#edbd95", "M40 33H43V38H41V36H40ZM21 44H23V51H25V53H23V51H21Z"),
    ],
    "apron": [
        ("#9aaf7f", "M27 35H29V41H35V35H37V42H39V63H25V42H27Z"),
        ("#bbcb9c", "M28 42H36V59H28Z"),
        ("#7e9863", "M30 50H35V55H30Z"),
    ],
    "pan-arms": [
        ("#dba681", "M20 43H24V47H29V44H32V48H29V51H23V49H20ZM41 43H44V47H41V49H38V45H35V42H38V44H41Z"),
        ("#8b5945", "M28 46H41V53H39V55H31V53H29V50H24V48H28Z"),
        ("#ba8061", "M30 47H40V51H38V53H32V51H30Z"),
        ("#493f37", "M40 47H47V49H40Z"),
    ],
}
SPOONS = ["M32 36H34V40H36V45H34V42H32Z", "M38 36H40V40H38V43H36V45H34V43H36V40H38Z"]
SPOON = "#9a794b"
SKIN, SKIN_LIGHT, SKIN_SHADE, LINE = "#dba681", "#f0c5a1", "#c78d69", "#bd815f"
EYE = "#363134"
RING, LENS = "#5c6168", "#d8eaf8"


# ---------- rasterizing the Codex paths ----------

def polygons(d):
    tokens = re.findall(r"[MHVZ]|-?\d+(?:\.\d+)?", d)
    shapes, points, x, y, i = [], [], 0.0, 0.0, 0
    while i < len(tokens):
        t = tokens[i]
        if t == "M":
            x, y = float(tokens[i + 1]), float(tokens[i + 2])
            points = [(x, y)]
            i += 3
        elif t == "H":
            x = float(tokens[i + 1]); points.append((x, y)); i += 2
        elif t == "V":
            y = float(tokens[i + 1]); points.append((x, y)); i += 2
        elif t == "Z":
            shapes.append(points); points = []; i += 1
        else:
            i += 1
    return shapes


def raster(paths):
    """[(fill, d)] -> {(x, y): fill}; later paths paint over earlier ones (nonzero rule)."""
    out = {}
    for fill, d in paths:
        edges = []
        for shape in polygons(d):
            for (x1, y1), (x2, y2) in zip(shape, shape[1:] + shape[:1]):
                if x1 == x2 and y1 != y2:
                    edges.append((x1, y1, y2))
        if not edges:
            continue
        ys = [v for e in edges for v in e[1:]]
        xs = [e[0] for e in edges]
        for py in range(int(min(ys)), int(max(ys))):
            for px in range(int(min(xs)), int(max(xs))):
                cx, cy, winding = px + 0.5, py + 0.5, 0
                for ex, y1, y2 in edges:
                    if ex > cx and min(y1, y2) < cy < max(y1, y2):
                        winding += 1 if y2 > y1 else -1
                if winding:
                    out[(px, py)] = fill
    return out


P = {name: raster(paths) for name, paths in CODEX_PARTS.items()}
HEAD_BASE = raster(CODEX_PARTS["head"][:7])
EYES = raster(CODEX_PARTS["head"][7:8])
MOUTH = raster(CODEX_PARTS["head"][8:10])


# ---------- pixel helpers ----------

def rects(color, *boxes):
    """Inclusive boxes (x0, y0, x1, y1)."""
    return {(x, y): color for x0, y0, x1, y1 in boxes for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)}


def shift(pixels, dx=0, dy=0):
    return {(x + dx, y + dy): c for (x, y), c in pixels.items()}


def mirror(pixels):
    return {(GRID_W - 1 - x, y): c for (x, y), c in pixels.items()}


def only(pixels, keep):
    return {k: c for k, c in pixels.items() if keep(*k)}


def recolor(pixels, mapping):
    return {k: mapping.get(c, c) for k, c in pixels.items()}


def layer(*stack):
    out = {}
    for pixels in stack:
        out.update(pixels)
    return out


# ---------- parts ----------

def head(eyes="open", turn=0):
    if eyes == "open":
        eye = EYES
    elif eyes == "closed":
        eye = rects(LINE, (27, 24, 28, 24), (36, 24, 37, 24))
    elif eyes == "down":
        eye = shift(EYES, 0, 1)
    else:  # up
        eye = shift(EYES, 1, -1)
    return layer(HEAD_BASE, shift(eye, turn), shift(MOUTH, turn))


LEFT_ARM = layer(only(raster(CODEX_PARTS["wave-up"][:1]), lambda x, y: x < 32),
                 only(raster(CODEX_PARTS["wave-up"][1:2]), lambda x, y: x < 32))
RIGHT_ARM = mirror(LEFT_ARM)
ARMS_DOWN = layer(LEFT_ARM, RIGHT_ARM)


def magnifier(close):
    """Right arm raised beside the head, holding a magnifying glass."""
    cx, cy = (39, 22) if close else (43, 16)
    ring, glass = {}, {}
    for y in range(cy - 6, cy + 7):
        for x in range(cx - 6, cx + 7):
            r = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if r <= 4.6:
                glass[(x, y)] = LENS
            elif r <= 5.9:
                ring[(x, y)] = RING
    eye = {}
    if close:  # the right eye, magnified, behind the lens
        eye = layer(rects(EYE, (35, 21, 38, 24)), rects("#ffffff", (37, 21, 37, 21)))
    hx, hy = cx + 4, cy + 4
    handle = rects(SPOON, (hx, hy, hx, hy), (hx + 1, hy + 1, hx + 1, hy + 1), (hx + 1, hy + 2, hx + 2, hy + 2))
    hand_x = hx
    arm = layer(rects(SKIN, (hand_x, hy + 3, hand_x + 3, hy + 6)), rects(SKIN_LIGHT, (hand_x + 1, hy + 3, hand_x + 2, hy + 4)))
    top = hy + 7
    for y in range(top, 45):  # forearm drops from the hand, then bends into the sleeve
        t = max(0.0, ((y - top) / max(1, 44 - top) - 0.45) / 0.55)
        x0 = round(hand_x + (44 - hand_x) * t)
        arm.update(rects(SKIN, (x0, y, x0 + 2, y)))
        arm[(x0, y)] = SKIN_SHADE
        arm[(x0 + 1, y)] = SKIN_LIGHT
    return layer(LEFT_ARM, arm, glass, eye, ring, handle)


def thinking():
    """Right forearm up to the chin."""
    band = {}
    path = [(43, 47), (42, 46), (42, 45), (41, 44), (41, 43), (40, 42), (40, 41), (39, 40), (38, 39), (38, 38), (37, 37)]
    for x, y in path:
        band.update(rects(SKIN, (x - 1, y, x + 1, y)))
        band[(x + 2, y)] = SKIN_SHADE
        band[(x - 2, y)] = SKIN_SHADE
    hand = layer(rects(SKIN, (32, 32, 37, 36)), rects(SKIN_LIGHT, (33, 33, 35, 34)), rects(SKIN_SHADE, (32, 36, 37, 36)))
    elbow = layer(rects(SKIN, (41, 45, 44, 49)), rects(SKIN_SHADE, (41, 49, 44, 49)))
    return layer(LEFT_ARM, elbow, band, hand)


def thumbs_up():
    forearm = layer(rects(SKIN, (38, 45, 44, 48)), rects(SKIN_SHADE, (38, 48, 44, 48)), rects(SKIN_LIGHT, (39, 45, 43, 45)))
    fist = layer(rects(SKIN, (34, 42, 39, 48)), rects(SKIN_SHADE, (34, 48, 39, 48)), rects(SKIN_SHADE, (34, 44, 37, 44)), rects(SKIN_SHADE, (34, 46, 37, 46)))
    thumb = layer(rects(SKIN, (36, 37, 38, 41)), rects(SKIN_LIGHT, (37, 38, 37, 40)))
    upper = layer(rects(SKIN, (42, 43, 44, 47)))
    return layer(LEFT_ARM, upper, forearm, fist, thumb)


def body(legs="stand", lift=0):
    return layer(P[legs], shift(P["shirt"], 0, lift))


def figure(legs="stand", lift=0, eyes="open", turn=0, arms=None, extra=()):
    out = layer(body(legs, lift), shift(head(eyes, turn), 0, lift), shift(arms if arms is not None else ARMS_DOWN, 0, lift))
    for pixels in extra:
        out.update(shift(pixels, 0, lift))
    return out


SCREEN_LIGHT = recolor(P["phone-arms"], {"#94afa7": "#cfe3dc"})
SPOON_A = raster([(SPOON, SPOONS[0])])
SPOON_B = raster([(SPOON, SPOONS[1])])

FRAMES = [
    ("stand", figure()),
    ("blink", figure(eyes="closed")),
    ("wave-a", figure(arms=P["wave-up"])),
    ("wave-b", figure(arms=P["wave-down"])),
    ("walk-0", figure("step-left", -1, turn=2)),
    ("walk-1", figure(turn=2)),
    ("walk-2", figure("step-right", 0, turn=2)),
    ("walk-3", figure(turn=2)),
    ("phone-a", figure(eyes="down", arms=P["phone-arms"])),
    ("phone-b", figure(eyes="down", arms=SCREEN_LIGHT)),
    ("grip", figure(arms=P["grip-arms"])),
    ("grip-step-a", figure("step-left", -1, arms=P["grip-arms"])),
    ("grip-step-b", figure("step-right", 0, arms=P["grip-arms"])),
    ("pan-a", figure(eyes="down", arms=layer(P["apron"], P["pan-arms"], SPOON_A))),
    ("pan-b", figure(eyes="down", arms=layer(P["apron"], P["pan-arms"], SPOON_B))),
    ("look-a", figure(arms=magnifier(False))),
    ("look-b", figure(arms=magnifier(True))),
    ("think", figure(eyes="up", arms=thinking())),
    ("thumbs", figure(arms=thumbs_up())),
]


def svg():
    runs = {}
    for index, (_, pixels) in enumerate(FRAMES):
        for y in range(TOP, BOTTOM):
            x = 0
            while x < GRID_W:
                color = pixels.get((x, y))
                if color is None:
                    x += 1
                    continue
                start = x
                while x < GRID_W and pixels.get((x, y)) == color:
                    x += 1
                runs.setdefault(color, []).append(f"M{index * GRID_W + start} {y - TOP}h{x - start}v1h-{x - start}z")
    width = GRID_W * len(FRAMES)
    paths = "".join(f'<path fill="{color}" d="{"".join(d)}"/>' for color, d in runs.items())
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{CELL_H}" viewBox="0 0 {width} {CELL_H}" shape-rendering="crispEdges">'
            + paths + "</svg>\n")


if __name__ == "__main__":
    target = Path(__file__).resolve().parent.parent / "assets" / "nathan-sprite.svg"
    target.write_text(svg())
    print(f"{target.name}: {len(FRAMES)} frames of {GRID_W} x {CELL_H}, {target.stat().st_size} bytes")
    print(", ".join(name for name, _ in FRAMES))
