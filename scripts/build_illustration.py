"""Build the illustrated Nathan atlas.

A faceless, side-view figure drawn from Nathan's October 2026 photos: tall and
slim, white T-shirt tucked into high-waisted black wide-leg trousers, Korean-style
bangs with a 4:6 side part, black leather shoes. Shapes are angular with hard two-tone (cel) shading, so edges stay
sharp; a light grain gives a painted surface. Every frame is posed from a small
skeleton of joint angles.

Output: assets/nathan-illustrated.svg, one row of CELL_W x CELL_H cells.
Frames 0 to 18 match the pixel atlas order (F in sprite.js); frames 19 to 22
are the second half of the 8-frame run cycle.

    python3 scripts/build_illustration.py
"""
import math
from pathlib import Path

CELL_W, CELL_H = 160, 210
CELL_INSET = 3
FLOOR = 204
HIP_X = 80

SKIN, SKIN_SHADE, SKIN_DEEP = "#e8b591", "#c98a63", "#a96a47"
HAIR, HAIR_LIGHT = "#17161a", "#2e2c34"
TEE, TEE_SHADE, TEE_DEEP = "#f7f5ef", "#d3cdc0", "#b9b2a4"
PANTS, PANTS_SHADE, PANTS_LIGHT = "#262830", "#141519", "#444852"
SHOE, SHOE_LIGHT = "#0e0f11", "#4a4c52"

L = dict(thigh=45, shin=45, torso=46, neck=7, upper=30, fore=27)


# ---------- geometry ----------

def vec(angle, length):
    """Angle in degrees from straight down; positive points forward (+x)."""
    a = math.radians(angle)
    return (math.sin(a) * length, math.cos(a) * length)


def add(p, v, k=1.0):
    return (p[0] + v[0] * k, p[1] + v[1] * k)


def unit(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    d = math.hypot(dx, dy) or 1.0
    return dx / d, dy / d


def normal(a, b):
    ux, uy = unit(a, b)
    return -uy, ux


def f(n):
    return f"{n:.1f}"


def poly(points, fill, extra=""):
    return f'<path d="M' + "L".join(f"{f(x)} {f(y)}" for x, y in points) + f'Z" fill="{fill}"{extra}/>'


def line(a, b, color, width):
    return f'<path d="M{f(a[0])} {f(a[1])}L{f(b[0])} {f(b[1])}" stroke="{color}" stroke-width="{width}" stroke-linecap="round" fill="none"/>'


def quad(a, b, wa, wb):
    nx, ny = normal(a, b)
    return [add(a, (nx, ny), wa / 2), add(b, (nx, ny), wb / 2), add(b, (nx, ny), -wb / 2), add(a, (nx, ny), -wa / 2)]


def cel_limb(a, b, wa, wb, base, shade, lit_side):
    """Hard two-tone limb: a shadow quad, then a lit quad pushed toward the light."""
    nx, ny = normal(a, b)
    k = 0.2 * lit_side
    lit = quad(add(a, (nx, ny), wa * k), add(b, (nx, ny), wb * k), wa * 0.62, wb * 0.62)
    return [poly(quad(a, b, wa, wb), shade), poly(lit, base)]


def lit_side_for(a, b):
    """Light comes from the upper front: pick the side of a limb that faces it."""
    nx, ny = normal(a, b)
    return 1 if nx * 0.8 - ny * 0.6 > 0 else -1


def local_frame(center, rot):
    a = math.radians(rot)
    return lambda dx, dy: (center[0] + dx * math.cos(a) - dy * math.sin(a), center[1] + dx * math.sin(a) + dy * math.cos(a))


# ---------- body parts ----------

def leg(hip, thigh, knee, far, toe_down=0.0):
    knee_p = add(hip, vec(thigh, L["thigh"]))
    shin_angle = thigh - knee
    ankle = add(knee_p, vec(shin_angle, L["shin"]))
    base = PANTS_SHADE if far else PANTS
    out = []
    # shoe first, the trouser hem falls over it
    foot_angle = shin_angle + 90 - toe_down
    fx, fy = vec(foot_angle, 1)
    up = (fy, -fx) if fx >= 0 else (-fy, fx)
    heel = add(add(ankle, (fx, fy), -6), up, -1)
    toe = add(add(ankle, (fx, fy), 17), up, -1)
    shoe = [add(heel, up, 6), add(add(toe, (fx, fy), -4), up, 5), add(toe, up, 1.5), add(toe, up, -1.5), add(heel, up, -2)]
    out.append(poly(shoe, SHOE))
    if not far:
        out.append(line(add(heel, up, -1.6), add(toe, up, -1.2), SHOE_LIGHT, 1.1))
    # thigh and a long flared shin: one trouser leg
    nx, ny = normal(knee_p, ankle)
    hem = add(ankle, unit(knee_p, ankle), 5)
    flare = 13.5 - 3.5 * min(1.0, knee / 100)  # a bent knee gathers the wide leg in
    trouser = [add(hip, normal(hip, knee_p), 10.5), add(knee_p, (nx, ny), 9.5), add(hem, (nx, ny), flare),
               add(hem, (nx, ny), -flare), add(knee_p, (nx, ny), -9.5), add(hip, normal(hip, knee_p), -10.5)]
    out.append(poly(trouser, PANTS_SHADE))
    side = lit_side_for(knee_p, ankle)
    lit = [add(hip, normal(hip, knee_p), 10.5 * side), add(knee_p, (nx, ny), 9 * side), add(hem, (nx, ny), (flare - 0.5) * side),
           add(hem, (nx, ny), -6 * side), add(knee_p, (nx, ny), -3 * side), add(hip, normal(hip, knee_p), -2 * side)]
    out.append(poly(lit, base))
    if not far:
        out.append(line(add(knee_p, (nx, ny), 3.5 * side), add(hem, (nx, ny), 5 * side), PANTS_LIGHT, 1.3))
    return out, ankle


def arm(shoulder, angle, elbow, far, hand="open"):
    elbow_p = add(shoulder, vec(angle, L["upper"]))
    fore_angle = angle + elbow
    wrist = add(elbow_p, vec(fore_angle, L["fore"]))
    base, shade = (SKIN_SHADE, SKIN_DEEP) if far else (SKIN, SKIN_SHADE)
    out = []
    out += cel_limb(shoulder, elbow_p, 10, 8.5, base, shade, lit_side_for(shoulder, elbow_p))
    out += cel_limb(elbow_p, wrist, 8.5, 7, base, shade, lit_side_for(elbow_p, wrist))
    fx, fy = vec(fore_angle, 1)
    nx, ny = -fy, fx
    if hand == "fist":
        h = [add(wrist, (nx, ny), 4), add(add(wrist, (fx, fy), 8), (nx, ny), 4.5), add(add(wrist, (fx, fy), 10), (nx, ny), 0),
             add(add(wrist, (fx, fy), 8), (nx, ny), -4.5), add(wrist, (nx, ny), -4)]
    else:
        h = [add(wrist, (nx, ny), 3.6), add(add(wrist, (fx, fy), 11), (nx, ny), 2), add(add(wrist, (fx, fy), 13), (nx, ny), -0.5),
             add(add(wrist, (fx, fy), 9), (nx, ny), -3.6), add(wrist, (nx, ny), -3.4)]
    out.append(poly(h, shade))
    out.append(poly([add(p, (nx, ny), 0.8) for p in h[:3]] + [add(wrist, (nx, ny), 0)], base))
    # short tee sleeve over the upper arm, cut square
    s_end = add(shoulder, vec(angle, L["upper"] * 0.48))
    sleeve = quad(add(shoulder, vec(angle, -4)), s_end, 17, 15.5)
    sleeve_base = TEE_SHADE if far else TEE
    out.append(poly(sleeve, TEE_DEEP if far else TEE_SHADE))
    out.append(poly(quad(add(add(shoulder, vec(angle, -4)), normal(shoulder, s_end), 2.5 * lit_side_for(shoulder, s_end)),
                         add(s_end, normal(shoulder, s_end), 2.5 * lit_side_for(shoulder, s_end)), 11.5, 10), sleeve_base))
    hand_c = add(wrist, (fx, fy), 6)
    return out, hand_c, fore_angle


def body(hip, shoulder):
    up = unit(hip, shoulder)
    fwd = (-up[1], up[0])
    if fwd[0] < 0:
        fwd = (-fwd[0], -fwd[1])
    at = lambda u, w: add(add(hip, up, u), fwd, w)
    out = []
    # high-waisted trouser seat joining both legs, kept slim
    out.append(poly([at(9, -10.5), at(9, 10.5), at(-6, 11), at(-8, -10.5)], PANTS))
    out.append(poly([at(9, -10.5), at(9, 10.5), at(6.5, 10.5), at(6.5, -10.5)], PANTS_SHADE))
    # tucked-in tee, close to the body
    tee = [at(46, -9.5), at(47, 7.5), at(37, 11.5), at(14, 11), at(10, 10.2), at(8.5, -10.2), at(15, -11), at(34, -11.5)]
    out.append(poly(tee, TEE_SHADE))
    out.append(poly([at(46, -3), at(47, 7.5), at(37, 11.5), at(14, 11), at(10, 10.2), at(8.5, -1), at(20, -3.5)], TEE))
    out.append(poly([at(12, 2.5), at(21, 7.5), at(13.5, 9.5)], TEE_SHADE))
    return out


def head(neck_base, rot):
    up_angle = 180 - rot
    neck_top = add(neck_base, vec(up_angle, L["neck"]))
    c = add(neck_top, vec(up_angle, 12))
    p = local_frame(c, rot)
    out = []
    out += cel_limb(add(neck_base, vec(up_angle, -3)), add(neck_top, vec(up_angle, 4)), 9.5, 8.5, SKIN, SKIN_SHADE, 1)
    face = [p(-8, -6), p(2, -10), p(8, -8), p(10, -4), p(10.6, -1), p(10.1, 0.6), p(12.8, 4.4), p(10.6, 5.4), p(11, 6.8),
            p(10.3, 7.8), p(10.8, 8.7), p(9.6, 10.3), p(8.4, 12), p(3.5, 12.4), p(-1.5, 9.5), p(-4.5, 5), p(-7, 2)]
    out.append(poly(face, SKIN))
    out.append(poly([p(-7, 2), p(-1, 0), p(1.5, 6.5), p(3.5, 12.4), p(-1.5, 9.5), p(-4.5, 5)], SKIN_SHADE))
    out.append(poly([p(-3.6, -0.4), p(-0.8, -0.8), p(-0.2, 3.6), p(-2.6, 5.4), p(-4, 3)], SKIN_DEEP))
    # Korean-style bangs with a 4:6 part. The back hugs the skull, a sideburn runs
    # down in front of the ear and a lock falls behind it to the earlobe; the
    # fringe drops over the forehead to the brow in a few pointed locks.
    hair = [p(13.2, -0.6), p(11.6, -2.6), p(11.4, 0.4), p(9.8, -2.2), p(8.6, -0.4), p(6.4, -3.4), p(3.4, -4.2),
            p(1.8, -2.4), p(1.7, 3.0), p(0.3, 2.4), p(0.1, -1.4), p(-1.8, -2.4), p(-3.8, -1.2), p(-4.3, 2.6),
            p(-4.9, 4.6), p(-6.3, 5.0), p(-7.6, 3.6), p(-8.5, 0.8), p(-8.9, -4), p(-8.7, -8.6), p(-6.1, -12.6),
            p(-1.4, -15), p(5, -15.2), p(10, -13), p(13.2, -8.6), p(14, -3.8)]
    out.append(poly(hair, HAIR))
    # strand direction by zone: the back combs backward, the middle falls straight
    # down over the side, the front sweeps forward into the fringe
    strands = (((-3, -14.4), (-7.8, -11.8), (-8.4, -4.6)), ((-5, -11.4), (-7.2, -6.4), (-6.8, 2.2)),
               ((0.6, -14.4), (1.6, -9.4), (1, -3.8)), ((-1.6, -12.4), (-2.6, -7.8), (-2.6, -3)),
               ((3.4, -14.8), (10, -12.6), (12.4, -3.4)), ((4.4, -11.4), (8.6, -8.6), (9.6, -2.6)))
    for a, c2, b in strands:
        pa, pc, pb = p(*a), p(*c2), p(*b)
        out.append(f'<path d="M{f(pa[0])} {f(pa[1])}Q{f(pc[0])} {f(pc[1])} {f(pb[0])} {f(pb[1])}" stroke="{HAIR_LIGHT}" stroke-width="1.2" fill="none" stroke-linecap="round"/>')
    return out, c


# ---------- poses ----------

def pose(lean=2.0, tilt=0.0, near_leg=(10, 4), far_leg=(-8, 2), near_arm=(-4, 8), far_arm=(5, 10),
         near_hand="open", far_hand="open", props=None, toe=(0, 0)):
    hip = (HIP_X, 0.0)
    shoulder = add(hip, vec(180 - lean, L["torso"]))
    far_arm_parts, far_hand_c, _ = arm(add(shoulder, (-3, 2.5)), *far_arm, far=True, hand=far_hand)
    far_parts, far_ankle = leg(add(hip, (-2.5, 0)), *far_leg, far=True, toe_down=toe[1])
    near_parts, near_ankle = leg(add(hip, (2.5, 0)), *near_leg, far=False, toe_down=toe[0])
    torso_parts = body(hip, shoulder)
    head_parts, head_c = head(add(shoulder, vec(180 - lean, 1)), lean + tilt)
    near_arm_parts, near_hand_c, _ = arm(add(shoulder, (1, 3.5)), *near_arm, far=False, hand=near_hand)
    low = max(far_ankle[1], near_ankle[1]) + 8
    dy = FLOOR - low
    info = {"near_hand": add(near_hand_c, (0, dy)), "head": add(head_c, (0, dy))}
    layers = far_arm_parts + far_parts + near_parts + torso_parts + head_parts
    if props:
        layers += props(info, dy, "behind")
    layers += near_arm_parts
    if props:
        layers += props(info, dy, "front")
    return f'<g transform="translate(0 {f(dy)})">' + "".join(layers) + "</g>", info


# Run cycle after the reference: deep lean, high knee drive, long back leg, big
# forward and backward arm swing with bent elbows.
RUN_LEGS = [(30, 12), (16, 26), (0, 18), (-22, 14), (-36, 40), (-6, 82), (40, 90), (46, 54)]
RUN_TOES = [0, 0, 0, 6, 26, 40, 30, 4]


def run_frame(i):
    near, far = RUN_LEGS[i % 8], RUN_LEGS[(i + 4) % 8]
    swing = max(-72, min(72, -near[0] * 1.9))
    elbow = lambda a: 104 if a > 0 else 58  # the forward arm folds up, the back arm opens out
    return pose(lean=15, tilt=-9, near_leg=near, far_leg=far, near_arm=(swing, elbow(swing)), far_arm=(-swing, elbow(-swing)),
                near_hand="fist", far_hand="fist", toe=(RUN_TOES[i % 8], RUN_TOES[(i + 4) % 8]))[0]


def phone_props(bright):
    def draw(info, dy, layer_name):
        if layer_name != "front":
            return []
        h = info["near_hand"]
        c = (h[0] - 1, h[1] - 7 - dy)
        screen = "#d6efff" if bright else "#9fd0ea"
        return [f'<g transform="rotate(-24 {f(c[0])} {f(c[1])})"><rect x="{f(c[0] - 4)}" y="{f(c[1] - 8)}" width="8" height="15.5" rx="1.4" fill="#16181d"/>'
                f'<rect x="{f(c[0] - 2.9)}" y="{f(c[1] - 6.7)}" width="5.8" height="12" rx="0.6" fill="{screen}"/></g>']
    return draw


def pan_props(tossed):
    def draw(info, dy, layer_name):
        if layer_name != "front":
            return []
        h = info["near_hand"]
        hx, hy = h[0], h[1] - dy
        c = (hx + 10, hy - (3 if tossed else 0))
        tilt = -6 if tossed else 0
        out = [line((hx - 2, hy), (c[0] - 10, c[1]), "#8a5a3c", 3.2),
               f'<ellipse cx="{f(c[0])}" cy="{f(c[1])}" rx="12" ry="3.4" fill="#2f3136" transform="rotate({tilt} {f(c[0])} {f(c[1])})"/>',
               f'<ellipse cx="{f(c[0])}" cy="{f(c[1] - 1.1)}" rx="10" ry="2.2" fill="#4a4d54" transform="rotate({tilt} {f(c[0])} {f(c[1])})"/>']
        for dx, fy, color in ((-4, -3, "#e0533d"), (1, -3.4, "#f2c14e"), (5, -2.8, "#e0533d")):
            lift = (-15 - 3 * (dx % 2)) if tossed else 0
            out.append(f'<rect x="{f(c[0] + dx - 1.8)}" y="{f(c[1] + fy + lift - 1.8)}" width="3.6" height="3.6" fill="{color}" transform="rotate(20 {f(c[0] + dx)} {f(c[1] + fy + lift)})"/>')
        return out
    return draw


def lens_props(close):
    def draw(info, dy, layer_name):
        if layer_name != "front":
            return []
        h = info["near_hand"]
        hx, hy = h[0], h[1] - dy
        c = (hx + 1, hy - 15)
        return [line((hx, hy), (c[0], c[1] + 8), "#8a5a3c", 3),
                f'<circle cx="{f(c[0])}" cy="{f(c[1])}" r="8" fill="#d8eaf8" fill-opacity="0.5" stroke="#4d5259" stroke-width="2.6"/>',
                f'<path d="M{f(c[0] - 4.5)} {f(c[1] - 2)}L{f(c[0] - 1.5)} {f(c[1] - 5.4)}" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>']
    return draw


def thumb_prop(info, dy, layer_name):
    if layer_name != "front":
        return []
    h = info["near_hand"]
    return [poly([(h[0] - 3, h[1] - dy - 3), (h[0] - 1.6, h[1] - dy - 11), (h[0] + 0.8, h[1] - dy - 11), (h[0] + 1, h[1] - dy - 3)], SKIN)]


FRAMES = []
FRAMES.append(("stand", pose()[0]))
FRAMES.append(("blink", pose(tilt=5, near_arm=(-3, 10), far_arm=(4, 12))[0]))
FRAMES.append(("wave-a", pose(near_arm=(150, -16))[0]))
FRAMES.append(("wave-b", pose(near_arm=(160, 22))[0]))
for i in range(4):
    FRAMES.append((f"walk-{i}", run_frame(i)))
FRAMES.append(("phone-a", pose(tilt=18, near_arm=(22, 106), far_arm=(28, 100), props=phone_props(False))[0]))
FRAMES.append(("phone-b", pose(tilt=22, near_arm=(22, 106), far_arm=(28, 100), props=phone_props(True))[0]))
GRIP_ARM = (156, 8)
grip_svg, grip_info = pose(near_arm=GRIP_ARM, near_hand="fist")
FRAMES.append(("grip", grip_svg))
FRAMES.append(("grip-step-a", pose(near_arm=GRIP_ARM, near_hand="fist", near_leg=(18, 8), far_leg=(-16, 18))[0]))
FRAMES.append(("grip-step-b", pose(near_arm=GRIP_ARM, near_hand="fist", near_leg=(-12, 18), far_leg=(16, 8))[0]))
FRAMES.append(("pan-a", pose(tilt=12, near_arm=(30, 58), far_arm=(20, 70), near_hand="fist", props=pan_props(False))[0]))
FRAMES.append(("pan-b", pose(tilt=4, near_arm=(42, 60), far_arm=(24, 74), near_hand="fist", props=pan_props(True))[0]))
FRAMES.append(("look-a", pose(lean=6, tilt=6, near_arm=(50, 108), near_hand="fist", props=lens_props(False))[0]))
FRAMES.append(("look-b", pose(lean=10, tilt=12, near_arm=(46, 118), near_hand="fist", props=lens_props(True))[0]))
# Chin on the fist, the other forearm folded across the waist under that elbow
# (angles solved so the fist meets the chin).
FRAMES.append(("think", pose(tilt=-6, near_arm=(50, 163), far_arm=(-10, 106), near_hand="fist", far_hand="fist")[0]))
FRAMES.append(("thumbs", pose(near_arm=(30, 70), near_hand="fist", props=thumb_prop)[0]))
for i in range(4, 8):
    FRAMES.append((f"walk-{i}", run_frame(i)))


def svg():
    width = CELL_W * len(FRAMES)
    # Each cell is clipped 3 units inside its edges: when the browser scales the atlas, a
    # drawing that touched the edge would show as a stray pixel beside the next frame.
    clips = "".join(f'<clipPath id="c{i}"><rect x="{i * CELL_W + CELL_INSET}" y="0" width="{CELL_W - 2 * CELL_INSET}" height="{CELL_H}"/></clipPath>' for i in range(len(FRAMES)))
    body_svg = "".join(f'<g clip-path="url(#c{i})"><g transform="translate({i * CELL_W} 0)">{content}</g></g>' for i, (_, content) in enumerate(FRAMES))
    grain = (f'<filter id="grain" x="0" y="0" width="{width}" height="{CELL_H}" filterUnits="userSpaceOnUse">'
             '<feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="1" seed="9" result="noise"/>'
             '<feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 -0.2" result="speck"/>'
             '<feComposite in="speck" in2="SourceGraphic" operator="in" result="specks"/>'
             '<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="specks"/></feMerge></filter>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{CELL_H}" viewBox="0 0 {width} {CELL_H}">'
            f'<defs>{grain}{clips}</defs><g filter="url(#grain)">{body_svg}</g></svg>\n')


if __name__ == "__main__":
    target = Path(__file__).resolve().parent.parent / "assets" / "nathan-illustrated.svg"
    target.write_text(svg())
    print(f"{target.name}: {len(FRAMES)} frames of {CELL_W} x {CELL_H}, {target.stat().st_size} bytes")
    hand = grip_info["near_hand"]
    print(f"grip hand at x={hand[0]:.1f}, y={hand[1]:.1f}")
