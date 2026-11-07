"""
Generates every Kaiju Rampage 3D asset as a vertex-colored low-poly .glb.

Run:  python tools/lowpoly/build_assets.py
Out:  build/meshes/*.glb   (imported into Lens Studio under Assets/Meshes)

Conventions
- 1 unit = 1 cm. +Y up. Models face -Z (toward the incoming camera direction).
- "Lit" meshes use M_Lit (vertex-color PBR). "Glow" meshes use M_Glow (vertex-color unlit).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from meshkit import MeshKit, hex_color as C  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "build", "meshes")

# ---------------------------------------------------------------- palette
PAL = {
    "ground": C("24407a"), "ground_top": C("2e5299"), "ground_edge": C("1b2f5c"),
    "road": C("262b36"), "road_line": C("e8e2c4"),
    "b1": C("4f74ff"), "b1_top": C("7d9bff"),
    "b2": C("ff7a52"), "b2_top": C("ffa07a"),
    "b3": C("3fd187"), "b3_top": C("8ef0b8"),
    "b4": C("ffc75a"), "b4_top": C("ffe39a"),
    "b5": C("a07bff"), "b5_top": C("c4adff"),
    "window": C("ffe9a3"), "window_dark": C("3b4a66"),
    "tree": C("3fa36b"), "tree_dark": C("2e7d52"), "trunk": C("7a5236"),
    "pole": C("5b6577"),
    "reactor_base": C("3d4a63"), "reactor_ring": C("5d6f91"),
    # UFO
    "ufo_hull": C("7a4dff"), "ufo_hull_dark": C("5a2fd6"), "ufo_belly": C("3a1f9e"),
    "ufo_rim": C("a98cff"),
    # Kaiju
    "claw_skin": C("1f9e8a"), "claw_skin_dark": C("147a6a"), "claw_scale": C("2fc4a8"),
    "claw_nail": C("f2fff7"), "claw_nail_dark": C("b8c4b6"),
}
GLOW = {
    "cyan": C("38f6ff"), "green": C("7dff4a"), "purple": C("c48bff"), "dome": C("9ff7ff"),
    "reactor": C("4dfff0"), "window": C("ffe27a"), "lamp": C("fff2a8"), "red": C("ff4d6d"),
    "white": C("ffffff"), "orange": C("ffae3d"), "yellow": C("ffe066"),
}


def save(mesh, name):
    os.makedirs(OUT, exist_ok=True)
    tris = mesh.write_glb(os.path.join(OUT, name + ".glb"), name)
    mn, mx = mesh.bounds()
    print(f"{name:24s} tris={tris:5d}  size=({mx[0]-mn[0]:.1f}, {mx[1]-mn[1]:.1f}, {mx[2]-mn[2]:.1f})")
    return tris


# ================================================================ CITY
def city_platform():
    m = MeshKit()
    # octagonal hover platform, radius 26cm, 3cm thick with bevel
    seg = 8
    m.lathe([(24.0, -3.0), (26.0, -1.2), (26.0, 0.0), (25.2, 0.6)], seg,
            [PAL["ground_edge"], PAL["ground"], PAL["ground"]], phase=math.pi / 8)
    # underside thruster cone
    m.lathe([(0.0, -9.0), (10.0, -4.5), (20.0, -3.0)], seg, [PAL["ground_edge"], PAL["ground_edge"]],
            phase=math.pi / 8, cap_top=False)
    # top surface (slightly raised plate)
    m.lathe([(25.2, 0.6), (24.6, 0.9)], seg, [PAL["ground_top"]], phase=math.pi / 8)
    # roads: a cross + ring, thin raised strips
    w = 3.2
    m.box((0, 1.0, 0), (46, 0.25, w), PAL["road"])
    m.box((0, 1.0, 0), (w, 0.25, 46), PAL["road"])
    for i in range(-5, 6):
        if abs(i) < 2:
            continue
        m.box((i * 4.0, 1.16, 0), (1.6, 0.08, 0.35), PAL["road_line"])
        m.box((0, 1.16, i * 4.0), (0.35, 0.08, 1.6), PAL["road_line"])
    return m


def platform_glow():
    m = MeshKit()
    # neon trim ring around the platform edge
    seg = 8
    m.lathe([(26.15, -0.9), (26.15, -0.3)], seg, [GLOW["cyan"]], phase=math.pi / 8, cap_top=False, cap_bottom=False)
    # thruster glow
    m.lathe([(0.0, -9.6), (3.0, -9.0)], 6, [GLOW["cyan"]], cap_bottom=False)
    return m


def building(kind):
    """Returns (lit, glow) meshes. Base sits on y=0."""
    lit, glow = MeshKit(), MeshKit()
    if kind == 1:  # tall tower with setbacks
        body, top = PAL["b1"], PAL["b1_top"]
        lit.box((0, 7, 0), (7, 14, 7), body, top, bevel=0.8)
        lit.box((0, 16.5, 0), (5, 5, 5), body, top, bevel=0.6)
        lit.box((0, 20, 0), (2.4, 2, 2.4), top, top, bevel=0.3)
        glow.cylinder((0, 21, 0), 0.25, 3.5, 4, GLOW["red"])
        glow.ico((0, 24.8, 0), 0.6, GLOW["red"])
        for y in (3, 6, 9, 12):
            for sx in (-1.6, 1.6):
                glow.box((sx, y, -3.52), (1.4, 1.5, 0.08), GLOW["window"])
                glow.box((3.52, y, sx), (0.08, 1.5, 1.4), GLOW["window"])
        for sx in (-1.0, 1.0):
            glow.box((sx, 16, -2.52), (1.0, 1.5, 0.08), GLOW["window"])
    elif kind == 2:  # chunky mid-rise with rooftop dish
        body, top = PAL["b2"], PAL["b2_top"]
        lit.box((0, 5, 0), (9, 10, 7), body, top, bevel=0.9)
        lit.cylinder((2, 10, 1), 1.6, 1.2, 6, PAL["pole"], top)
        lit.lathe([(0.3, 11.2), (2.0, 12.6), (2.2, 12.8)], 8, [C("d9dde6"), C("d9dde6")], center=(2, 0, 1), cap_top=True)
        lit.box((-2.5, 11, -1), (2.5, 2, 2.5), top, top, bevel=0.3)
        for y in (2.5, 5.5, 8):
            for sx in (-3, -1, 1, 3):
                glow.box((sx, y, -3.52), (1.2, 1.4, 0.08), GLOW["window"])
    elif kind == 3:  # round dome habitat
        body, top = PAL["b3"], PAL["b3_top"]
        lit.cylinder((0, 0, 0), 5.5, 5, 10, body, top)
        lit.lathe([(5.0, 5), (4.6, 7.2), (3.2, 9.0), (1.2, 10.0), (0.0, 10.2)], 10,
                  [top, top, top, top])
        for k in range(5):
            a = 2 * math.pi * k / 5 + 0.3
            glow.box((math.cos(a) * 5.55, 2.6, -math.sin(a) * 5.55), (1.1, 1.3, 1.1), GLOW["window"])
        glow.lathe([(5.6, 4.8), (5.6, 5.4)], 10, [GLOW["green"]], cap_top=False, cap_bottom=False)
    elif kind == 4:  # twin slim towers + skybridge
        body, top = PAL["b4"], PAL["b4_top"]
        lit.box((-2.6, 9, 0), (4, 18, 4), body, top, bevel=0.5)
        lit.box((2.6, 7, 0), (4, 14, 4), body, top, bevel=0.5)
        lit.box((0, 10.5, 0), (2, 1.5, 2.4), top, top)
        for y in range(2, 17, 3):
            glow.box((-2.6, y, -2.02), (2.6, 1.2, 0.08), GLOW["window"])
        for y in range(2, 13, 3):
            glow.box((2.6, y, -2.02), (2.6, 1.2, 0.08), GLOW["window"])
        glow.box((0, 10.5, -1.22), (1.8, 0.6, 0.08), GLOW["cyan"])
    elif kind == 5:  # low wide hangar with antenna
        body, top = PAL["b5"], PAL["b5_top"]
        lit.box((0, 3, 0), (11, 6, 7), body, top, bevel=0.8)
        lit.lathe([(3.4, 6), (3.0, 7.6), (1.8, 8.6), (0.0, 9.0)], 8, [top, top, top], center=(-2, 0, 0))
        lit.cylinder((3, 6, 1.5), 0.25, 5, 4, PAL["pole"])
        glow.ico((3, 11.2, 1.5), 0.55, GLOW["purple"])
        glow.box((0, 2.2, -3.52), (6.5, 2.4, 0.08), GLOW["cyan"])
        for sx in (-4, 4):
            glow.box((sx, 4.2, -3.52), (1.4, 1.0, 0.08), GLOW["window"])
    return lit, glow


def reactor():
    lit, glow = MeshKit(), MeshKit()
    lit.cylinder((0, 0, 0), 6.0, 1.6, 8, PAL["reactor_base"], PAL["reactor_ring"])
    lit.cylinder((0, 1.6, 0), 4.6, 1.0, 8, PAL["reactor_ring"])
    for k in range(4):
        a = 2 * math.pi * k / 4 + math.pi / 4
        x, z = math.cos(a) * 4.6, -math.sin(a) * 4.6
        lit.box((x, 4.5, z), (1.2, 7, 1.2), PAL["reactor_ring"], bevel=0.25)
    lit.cylinder((0, 8.0, 0), 5.2, 0.8, 8, PAL["reactor_ring"], PAL["reactor_base"])
    glow.ico((0, 0, 0), 3.0, GLOW["reactor"], squash=(1, 1.35, 1))  # core gem, origin-centered (animated separately)
    return lit, glow


def tree():
    m = MeshKit()
    m.cylinder((0, 0, 0), 0.45, 1.8, 5, PAL["trunk"])
    m.cone((0, 1.4, 0), 2.0, 3.2, 6, PAL["tree"])
    m.cone((0, 3.2, 0), 1.5, 2.6, 6, PAL["tree_dark"])
    return m


def streetlight():
    lit, glow = MeshKit(), MeshKit()
    lit.cylinder((0, 0, 0), 0.22, 5.0, 4, PAL["pole"])
    lit.box((0.6, 5.0, 0), (1.6, 0.35, 0.5), PAL["pole"])
    glow.box((1.1, 4.75, 0), (0.6, 0.2, 0.45), GLOW["lamp"])
    return lit, glow


# ================================================================ UFO
def ufo():
    """Saucer ~16cm wide. Origin at the center of the hull."""
    lit, dome, ring, lights = MeshKit(), MeshKit(), MeshKit(), MeshKit()
    seg = 12
    lit.lathe([(0.0, -2.6), (3.2, -2.4), (5.6, -1.4), (8.0, -0.2), (8.2, 0.3), (6.2, 1.2), (3.6, 1.7)], seg,
              [PAL["ufo_belly"], PAL["ufo_belly"], PAL["ufo_hull_dark"], PAL["ufo_rim"], PAL["ufo_hull"],
               PAL["ufo_hull"]], phase=math.pi / seg)
    # little landing fins
    for k in range(3):
        a = 2 * math.pi * k / 3
        x, z = math.cos(a) * 4.0, -math.sin(a) * 4.0
        lit.box((x, -2.9, z), (1.1, 1.2, 1.1), PAL["ufo_hull_dark"], bevel=0.25)
    # glass dome (glow material)
    dome.lathe([(3.7, 1.6), (3.5, 2.8), (2.6, 4.0), (1.3, 4.7), (0.0, 4.9)], 10,
               [GLOW["dome"], GLOW["dome"], GLOW["dome"], GLOW["dome"]])
    # cute alien eyes peeking inside the dome (dark dots on the front, -Z)
    for sx in (-0.9, 0.9):
        dome.ico((sx, 3.2, -2.75), 0.55, C("1b1440"))
    # neon accent ring around the rim
    ring.lathe([(8.35, -0.15), (8.35, 0.35)], seg, [GLOW["green"]], phase=math.pi / seg, cap_top=False, cap_bottom=False)
    ring.lathe([(8.30, 0.35), (7.9, 0.55)], seg, [GLOW["green"]], phase=math.pi / seg, cap_top=False, cap_bottom=False)
    # under-lights ring
    for k in range(6):
        a = 2 * math.pi * k / 6
        lights.ico((math.cos(a) * 5.2, -1.7, -math.sin(a) * 5.2), 0.55, GLOW["green"])
    lights.lathe([(0.0, -3.0), (1.6, -2.7)], 8, [GLOW["purple"]], cap_bottom=False)
    m_glow = MeshKit()
    m_glow.merge(ring)
    m_glow.merge(lights)
    return lit, dome, m_glow


def tractor_beam():
    m = MeshKit()
    m.lathe([(1.2, 0.0), (4.0, -10.0)], 8, [GLOW["green"]], cap_top=False, cap_bottom=False)
    return m


# ================================================================ KAIJU CLAW
def kaiju_claw():
    """
    Right claw, wrist at origin, knuckles toward -Z (pointing away from player),
    palm facing -Y. Mirror on X for the left hand at runtime (scale x = -1).
    ~13cm long so it reads as a giant monster hand over a real hand.
    """
    lit, glow = MeshKit(), MeshKit()
    skin, dark, scale = PAL["claw_skin"], PAL["claw_skin_dark"], PAL["claw_scale"]
    # forearm cuff
    lit.lathe([(3.4, 0.0), (3.6, 1.5), (3.2, 3.0)], 7, [dark, dark], center=(0, 0, 0), cap_bottom=True, cap_top=True)
    lit.transform(lambda p: (p[0], p[2], p[1] + 2.0), lambda n: (n[0], n[2], n[1]))  # cuff along +Z (toward player)
    # palm block (fist), chamfered
    palm = MeshKit()
    palm.box((0, 0, -3.2), (7.4, 4.8, 6.8), skin, scale, bevel=1.1)
    lit.merge(palm)
    # back-of-hand ridge plates
    for i, z in enumerate((-1.2, -3.4, -5.6)):
        lit.box((0, 2.6, z), (4.2 - i * 0.5, 0.9, 1.6), scale, scale, bevel=0.3)
    # 3 fingers curled into a fist + talons
    for k, x in enumerate((-2.4, 0.0, 2.4)):
        lit.box((x, 0.6, -7.2), (2.1, 3.2, 2.4), skin, scale, bevel=0.5)
        lit.box((x, -1.3, -6.6), (2.0, 1.6, 2.0), dark, dark, bevel=0.4)
        # talon: cone pointing forward (-Z) and slightly down
        talon = MeshKit()
        talon.cone((0, 0, 0), 0.85, 3.4, 5, PAL["claw_nail"])
        talon.transform(lambda p: (p[0], p[2] * 0.25 - p[1] * 0.0, -p[1]), lambda n: (n[0], n[2] * 0.25, -n[1]))
        lit.merge(talon, offset=(x, 0.4, -8.3))
    # thumb
    lit.box((-4.3, -0.6, -3.2), (1.8, 2.4, 3.4), skin, scale, bevel=0.45)
    th = MeshKit()
    th.cone((0, 0, 0), 0.7, 2.6, 5, PAL["claw_nail"])
    th.transform(lambda p: (p[0] - p[1] * 0.35, p[2] * 0.2, -p[1]), lambda n: (n[0], n[2], -n[1]))
    lit.merge(th, offset=(-4.6, -0.5, -4.9))
    # dorsal spikes
    for i, z in enumerate((-0.8, -2.8, -4.8)):
        sp = MeshKit()
        sp.cone((0, 0, 0), 0.75 - i * 0.1, 2.2 - i * 0.3, 4, dark)
        lit.merge(sp, offset=(0, 3.0, z))
    # glowing cyan accents: knuckle studs + vein stripes + cuff ring
    for x in (-2.4, 0.0, 2.4):
        glow.ico((x, 2.3, -7.0), 0.55, GLOW["cyan"])
    glow.box((-2.9, 1.9, -3.0), (0.35, 0.2, 4.2), GLOW["cyan"])
    glow.box((2.9, 1.9, -3.0), (0.35, 0.2, 4.2), GLOW["cyan"])
    ring = MeshKit()
    ring.lathe([(3.65, 0.0), (3.65, 0.5)], 7, [GLOW["cyan"]], cap_top=False, cap_bottom=False)
    ring.transform(lambda p: (p[0], p[2], p[1] + 3.2), lambda n: (n[0], n[2], n[1]))
    glow.merge(ring)
    return lit, glow


# ================================================================ FX
def fx_shard():
    m = MeshKit()
    m.ico((0, 0, 0), 1.0, GLOW["white"], squash=(1.0, 0.6, 1.4))
    return m


def fx_ring():
    """Flat shock ring, radius 1, lying in XZ plane; two-sided via duplicated faces."""
    m = MeshKit()
    seg = 16
    for s in range(seg):
        a0 = 2 * math.pi * s / seg
        a1 = 2 * math.pi * (s + 1) / seg
        p = lambda r, a: (r * math.cos(a), 0.0, -r * math.sin(a))
        m.quad(p(0.8, a0), p(1.0, a0), p(1.0, a1), p(0.8, a1), GLOW["white"])
        m.quad(p(0.8, a1), p(1.0, a1), p(1.0, a0), p(0.8, a0), GLOW["white"])
    return m


def fx_star():
    """Cartoon impact star (flat, double-sided), in XY plane facing -Z and +Z."""
    m = MeshKit()
    pts = []
    for k in range(10):
        a = math.pi / 2 + 2 * math.pi * k / 10
        r = 1.0 if k % 2 == 0 else 0.45
        pts.append((r * math.cos(a), r * math.sin(a), 0.0))
    for k in range(10):
        a, b = pts[k], pts[(k + 1) % 10]
        m.tri((0, 0, 0), a, b, GLOW["yellow"])
        m.tri((0, 0, 0), b, a, GLOW["yellow"])
    return m


def fx_puff():
    m = MeshKit()
    m.ico((0, 0, 0), 1.0, C("9aa3b5"))
    return m


def ui_panel():
    """Rounded-ish hologram panel 1x1 in XY plane, front faces -Z... (double-sided)."""
    m = MeshKit()
    w, h, b = 0.5, 0.5, 0.08
    pts = [(w - b, h, 0), (-w + b, h, 0), (-w, h - b, 0), (-w, -h + b, 0), (-w + b, -h, 0), (w - b, -h, 0),
           (w, -h + b, 0), (w, h - b, 0)]
    col = C("0d2f3a")
    m.poly(pts, col)
    m.poly(list(reversed(pts)), col)
    return m


def ui_frame():
    """Thin glowing frame outline for panels/buttons (1x1, XY plane, double-sided)."""
    m = MeshKit()
    t = 0.025
    col = GLOW["cyan"]
    for (cx, cy, sx, sy) in ((0, 0.5, 1.0, t), (0, -0.5, 1.0, t), (0.5, 0, t, 1.0), (-0.5, 0, t, 1.0)):
        x0, x1, y0, y1 = cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2
        m.quad((x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0), col)
        m.quad((x0, y1, 0), (x1, y1, 0), (x1, y0, 0), (x0, y0, 0), col)
    return m


def ui_bar():
    """Unit bar (1 x 1) anchored at its left edge (x from 0..1), double-sided, white (tinted by mesh color)."""
    m = MeshKit()
    col = GLOW["green"]
    m.quad((0, -0.5, 0), (1, -0.5, 0), (1, 0.5, 0), (0, 0.5, 0), col)
    m.quad((0, 0.5, 0), (1, 0.5, 0), (1, -0.5, 0), (0, -0.5, 0), col)
    return m


def main():
    total = 0
    total += save(city_platform(), "CityPlatform")
    total += save(platform_glow(), "CityPlatform_Glow")
    for k in range(1, 6):
        lit, glow = building(k)
        total += save(lit, f"Building{k}")
        total += save(glow, f"Building{k}_Glow")
    lit, glow = reactor()
    total += save(lit, "Reactor")
    total += save(glow, "Reactor_Core")
    total += save(tree(), "Tree")
    lit, glow = streetlight()
    total += save(lit, "StreetLight")
    total += save(glow, "StreetLight_Glow")
    lit, dome, glow = ufo()
    total += save(lit, "UFO_Hull")
    total += save(dome, "UFO_Dome")
    total += save(glow, "UFO_Neon")
    total += save(tractor_beam(), "UFO_Beam")
    lit, glow = kaiju_claw()
    total += save(lit, "KaijuClaw")
    total += save(glow, "KaijuClaw_Glow")
    total += save(lit.mirrored_x(), "KaijuClaw_L")
    total += save(glow.mirrored_x(), "KaijuClaw_L_Glow")
    total += save(fx_shard(), "FX_Shard")
    total += save(fx_ring(), "FX_Ring")
    total += save(fx_star(), "FX_Star")
    total += save(fx_puff(), "FX_Puff")
    total += save(ui_panel(), "UI_Panel")
    total += save(ui_frame(), "UI_Frame")
    total += save(ui_bar(), "UI_Bar")
    print("total triangles (unique meshes):", total)


if __name__ == "__main__":
    main()
