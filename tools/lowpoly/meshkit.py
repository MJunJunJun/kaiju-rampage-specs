"""
Tiny low-poly mesh toolkit + binary glTF (.glb) writer. Pure Python, no deps.

Every triangle gets its own vertices (flat shading) and a per-face RGBA color
stored in COLOR_0, so a single vertex-colored material can render whole models.
Units: 1.0 == 1 cm (Lens Studio world units).
"""
import json
import math
import struct


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def _mul(a, s):
    return (a[0] * s, a[1] * s, a[2] * s)


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _norm(a):
    l = math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2])
    if l < 1e-9:
        return (0.0, 1.0, 0.0)
    return (a[0] / l, a[1] / l, a[2] / l)


def hex_color(h, a=1.0):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255.0, int(h[2:4], 16) / 255.0, int(h[4:6], 16) / 255.0, a)


def _rot_y(p, ang):
    c, s = math.cos(ang), math.sin(ang)
    return (p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c)


class MeshKit:
    def __init__(self):
        self.pos = []
        self.nrm = []
        self.col = []

    # ---------------------------------------------------------------- primitives
    def tri(self, a, b, c, color):
        n = _norm(_cross(_sub(b, a), _sub(c, a)))
        for p in (a, b, c):
            self.pos.append(p)
            self.nrm.append(n)
            self.col.append(color)

    def quad(self, a, b, c, d, color):
        """a,b,c,d counter-clockwise when seen from the front."""
        self.tri(a, b, c, color)
        self.tri(a, c, d, color)

    def poly(self, pts, color):
        """Convex polygon, counter-clockwise from the front (fan)."""
        for i in range(1, len(pts) - 1):
            self.tri(pts[0], pts[i], pts[i + 1], color)

    def merge(self, other, offset=(0, 0, 0), rot_y=0.0, scale=1.0):
        for p, n, c in zip(other.pos, other.nrm, other.col):
            pp = _rot_y(_mul(p, scale), rot_y)
            self.pos.append(_add(pp, offset))
            self.nrm.append(_rot_y(n, rot_y))
            self.col.append(c)

    def transform(self, fn_pos, fn_nrm=None):
        """Apply a linear-ish map. Mapped normals define 'outside'; triangles whose
        winding no longer agrees (e.g. after a reflection) are re-wound."""
        self.pos = [fn_pos(p) for p in self.pos]
        if fn_nrm:
            self.nrm = [_norm(fn_nrm(n)) for n in self.nrm]
        for i in range(0, len(self.pos), 3):
            a, b, c = self.pos[i], self.pos[i + 1], self.pos[i + 2]
            cr = _cross(_sub(b, a), _sub(c, a))
            n = self.nrm[i]
            if cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0:
                self.pos[i + 1], self.pos[i + 2] = c, b
                self.nrm[i + 1], self.nrm[i + 2] = self.nrm[i + 2], self.nrm[i + 1]
                self.col[i + 1], self.col[i + 2] = self.col[i + 2], self.col[i + 1]

    # ---------------------------------------------------------------- shapes
    def box(self, center, size, color, top_color=None, bevel=0.0):
        """Axis-aligned box. bevel>0 chamfers the vertical edges and the top rim."""
        cx, cy, cz = center
        sx, sy, sz = size[0] / 2.0, size[1] / 2.0, size[2] / 2.0
        top_color = top_color or color
        b = max(0.0, min(bevel, sx * 0.45, sz * 0.45, sy * 0.45))

        def ring(y, inset):
            ax, az = sx - inset, sz - inset
            if b <= 0:
                pts = [(cx + ax, y, cz + az), (cx + ax, y, cz - az), (cx - ax, y, cz - az), (cx - ax, y, cz + az)]
            else:
                pts = [(cx + ax, y, cz + az - b), (cx + ax, y, cz - az + b), (cx + ax - b, y, cz - az),
                       (cx - ax + b, y, cz - az), (cx - ax, y, cz - az + b), (cx - ax, y, cz + az - b),
                       (cx - ax + b, y, cz + az), (cx + ax - b, y, cz + az)]
            return pts  # counter-clockwise seen from +y

        bottom = ring(cy - sy, 0)
        if b <= 0:
            top = ring(cy + sy, 0)
            self.loft(bottom, top, color)
        else:
            mid = ring(cy + sy - b, 0)
            top = ring(cy + sy, b)
            self.loft(bottom, mid, color)
            self.loft(mid, top, top_color)
        self.poly(top, top_color)
        self.poly(list(reversed(bottom)), color)

    def loft(self, ring_a, ring_b, color):
        """Connect two rings (same vertex count, counter-clockwise seen from +y), faces outward."""
        n = len(ring_a)
        for i in range(n):
            j = (i + 1) % n
            self.quad(ring_a[i], ring_a[j], ring_b[j], ring_b[i], color)

    def lathe(self, profile, segments, colors, center=(0, 0, 0), phase=0.0, cap_top=True, cap_bottom=True):
        """
        profile: list of (radius, y) from bottom to top. colors: one per band
        (len(profile)-1) or a single color. Caps close radius>0 ends.
        """
        if not isinstance(colors, list):
            colors = [colors] * (len(profile) - 1)
        rings = []
        for (r, y) in profile:
            ring = []
            for s in range(segments):
                a = phase + 2.0 * math.pi * s / segments
                ring.append((center[0] + r * math.cos(a), center[1] + y, center[2] - r * math.sin(a)))
            rings.append(ring)
        for k in range(len(rings) - 1):
            ra, rb = rings[k], rings[k + 1]
            r0, r1 = profile[k][0], profile[k + 1][0]
            if r0 < 1e-6 and r1 < 1e-6:
                continue
            for i in range(segments):
                j = (i + 1) % segments
                if r0 < 1e-6:
                    self.tri(ra[i], rb[j], rb[i], colors[k])
                elif r1 < 1e-6:
                    self.tri(ra[i], ra[j], rb[j], colors[k])
                else:
                    self.quad(ra[i], ra[j], rb[j], rb[i], colors[k])
        if cap_bottom and profile[0][0] > 1e-6:
            self.poly(list(reversed(rings[0])), colors[0])
        if cap_top and profile[-1][0] > 1e-6:
            self.poly(rings[-1], colors[-1])

    def cylinder(self, center, radius, height, segments, color, top_color=None, radius_top=None):
        rt = radius if radius_top is None else radius_top
        c = [color]
        self.lathe([(radius, 0), (rt, height)], segments, c, center=center, cap_top=False)
        top = []
        for s in range(segments):
            a = 2.0 * math.pi * s / segments
            top.append((center[0] + rt * math.cos(a), center[1] + height, center[2] - rt * math.sin(a)))
        if rt > 1e-6:
            self.poly(top, top_color or color)

    def cone(self, base_center, radius, height, segments, color):
        self.lathe([(radius, 0), (0.0, height)], segments, [color], center=base_center)

    def ico(self, center, radius, color, squash=(1, 1, 1)):
        """Low-poly icosahedron (20 faces)."""
        t = (1.0 + math.sqrt(5.0)) / 2.0
        v = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t),
             (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
        f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6),
             (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10),
             (8, 6, 7), (9, 8, 1)]
        vv = []
        for p in v:
            n = _norm(p)
            vv.append((center[0] + n[0] * radius * squash[0], center[1] + n[1] * radius * squash[1],
                       center[2] + n[2] * radius * squash[2]))
        for a, b, c in f:
            self.tri(vv[a], vv[b], vv[c], color)

    def mirrored_x(self):
        """Mirror across X (left/right) and fix winding so faces stay outward."""
        m = MeshKit()
        for i in range(0, len(self.pos), 3):
            for k in (0, 2, 1):
                p, n = self.pos[i + k], self.nrm[i + k]
                m.pos.append((-p[0], p[1], p[2]))
                m.nrm.append((-n[0], n[1], n[2]))
                m.col.append(self.col[i + k])
        return m

    # ---------------------------------------------------------------- export
    def bounds(self):
        xs = [p[0] for p in self.pos]
        ys = [p[1] for p in self.pos]
        zs = [p[2] for p in self.pos]
        return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))

    def write_glb(self, path, name="mesh"):
        n = len(self.pos)
        assert n > 0, "empty mesh"
        pos_bytes = b"".join(struct.pack("<3f", *p) for p in self.pos)
        nrm_bytes = b"".join(struct.pack("<3f", *v) for v in self.nrm)
        col_bytes = b"".join(struct.pack("<4f", *c) for c in self.col)
        idx_bytes = b"".join(struct.pack("<I", i) for i in range(n))
        blobs = [pos_bytes, nrm_bytes, col_bytes, idx_bytes]
        offsets = []
        buf = b""
        for b in blobs:
            while len(buf) % 4:
                buf += b"\x00"
            offsets.append(len(buf))
            buf += b
        while len(buf) % 4:
            buf += b"\x00"
        mn, mx = self.bounds()
        gltf = {
            "asset": {"version": "2.0", "generator": "kaiju-meshkit"},
            "scene": 0,
            "scenes": [{"nodes": [0]}],
            "nodes": [{"mesh": 0, "name": name}],
            "materials": [{"name": name + "_mat", "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1],
                                                                           "metallicFactor": 0.0, "roughnessFactor": 0.6}}],
            "meshes": [{"name": name, "primitives": [{
                "attributes": {"POSITION": 0, "NORMAL": 1, "COLOR_0": 2},
                "indices": 3, "material": 0, "mode": 4}]}],
            "buffers": [{"byteLength": len(buf)}],
            "bufferViews": [
                {"buffer": 0, "byteOffset": offsets[0], "byteLength": len(pos_bytes), "target": 34962},
                {"buffer": 0, "byteOffset": offsets[1], "byteLength": len(nrm_bytes), "target": 34962},
                {"buffer": 0, "byteOffset": offsets[2], "byteLength": len(col_bytes), "target": 34962},
                {"buffer": 0, "byteOffset": offsets[3], "byteLength": len(idx_bytes), "target": 34963},
            ],
            "accessors": [
                {"bufferView": 0, "componentType": 5126, "count": n, "type": "VEC3",
                 "min": list(mn), "max": list(mx)},
                {"bufferView": 1, "componentType": 5126, "count": n, "type": "VEC3"},
                {"bufferView": 2, "componentType": 5126, "count": n, "type": "VEC4"},
                {"bufferView": 3, "componentType": 5125, "count": n, "type": "SCALAR"},
            ],
        }
        js = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
        while len(js) % 4:
            js += b" "
        total = 12 + 8 + len(js) + 8 + len(buf)
        with open(path, "wb") as f:
            f.write(struct.pack("<4sII", b"glTF", 2, total))
            f.write(struct.pack("<I4s", len(js), b"JSON"))
            f.write(js)
            f.write(struct.pack("<I4s", len(buf), b"BIN\x00"))
            f.write(buf)
        return n // 3
