# Title screen scene for Wayshrine: a wayshrine on a small island in a lake at sunset, the traveller resting beside
# it, a snow-capped peak and blue ranges behind, floating lanterns, pines framing the view.
# Run from the repo root:  Blender -b --factory-startup --python content/title/title.py
# Rebuilds content/title/title.blend and public/models/title/{title,toro}.glb.
#
# Hero quality in the game's language: flat-shaded low poly, the game's palette, roughness 1, but denser than a
# landmark (no triangle cap) and with a little per-face colour variation (COLOR_0) so large surfaces aren't flat.
# Named nodes the title scene animates or uses:
#   title_camera      the framing (the scene drifts gently around it)
#   spot_traveller    where the traveller sits; she faces the node's local -Y (the game's +Z)
#   spot_sun          where the sun's disc hangs
#   orb               the shrine's floating orb (glow)
#   toro              a floating lantern, cloned across the water by the scene
#   sway_*            trees that sway a little about their base (node origin at the trunk foot)
#   glow_*            parts that glow
# Everything sits on the lake at z=0; nothing but the island's foot and the rocks goes below it.
import bpy, bmesh, math, os, json, random
from mathutils import Vector, Matrix, noise

bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
GLB = ROOT + "/public/models/title/title.glb"
TORO_GLB = ROOT + "/public/models/title/toro.glb"
BLEND = ROOT + "/content/title/title.blend"
rng = random.Random(11)

PAL = {
    "grass": "86b86a", "grass2": "6f9f57", "moss": "5f8a4c", "sand": "e3d3a1", "rock": "a39e98", "rockdk": "7f7a75",
    "stone": "b9b3a8", "red": "d96b59", "reddk": "a93a2f", "roof": "2a2424", "paper": "f4efe2", "rope": "d9c79a",
    "bark": "5a4436", "pine": "3f7350", "pinedk": "2f5a40", "blossom": "f2b6c4", "blossom2": "f7cdd6",
    "wood": "8a6540", "glow_cream": "ffe9a8",
    "mtn_far": "c4ced4", "mtn_mid": "8fa2ad", "mtn_fuji": "9fb0ba", "snow": "f1f4f6", "shore": "4f6b52",
    "fgpine": "4f8a5a", "fgpinedk": "3a6b4b", "fgbark": "5a4436",
}
def lin(h):
    o = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        o.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return o

# ---- mesh buckets: node name -> {material -> (verts, faces, face colours)}
NODES = {}
ORIGINS = {}
def bucket(node, mat):
    n = NODES.setdefault(node, {})
    return n.setdefault(mat, ([], [], []))
def add(node, mat, verts, faces, jitter=0.06, orient=True):
    """Add a polygon soup. Faces wound outward when the piece is closed (signed volume); each face gets a
    slightly varied tint so big flat-shaded surfaces read as faceted, not flat."""
    V = [Vector(v) for v in verts]
    if orient:
        vol = 0.0
        for f in faces:
            a = V[f[0]]
            for i in range(1, len(f) - 1): vol += a.dot(V[f[i]].cross(V[f[i + 1]]))
        if vol < 0: faces = [list(reversed(f)) for f in faces]
    bv, bf, bc = bucket(node, mat)
    base = len(bv)
    bv.extend(tuple(v) for v in V)
    for f in faces:
        bf.append([base + i for i in f])
        bc.append(1.0 + rng.uniform(-jitter, jitter))
def solid(node, mat, rings, cap0=True, cap1=True, jitter=0.06):
    n = len(rings[0]); verts = [p for r in rings for p in r]; faces = []
    for k in range(len(rings) - 1):
        for i in range(n):
            j = (i + 1) % n
            faces.append([k * n + i, k * n + j, (k + 1) * n + j, (k + 1) * n + i])
    if cap0: faces.append(list(range(n - 1, -1, -1)))
    if cap1:
        L = len(rings) - 1; faces.append([L * n + i for i in range(n)])
    add(node, mat, verts, faces, jitter)
def ngon(r, z, n, ox=0, oy=0, ph=0, sx=1.0, sy=1.0):
    return [(ox + sx * r * math.cos(ph + 2 * math.pi * i / n), oy + sy * r * math.sin(ph + 2 * math.pi * i / n), z) for i in range(n)]
def box(node, mat, cx, cy, z0, z1, hx, hy, rot=0.0, jitter=0.04):
    c, s = math.cos(rot), math.sin(rot)
    def ring(z): return [(cx + x * c - y * s, cy + x * s + y * c, z) for x, y in ((-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy))]
    solid(node, mat, [ring(z0), ring(z1)], jitter=jitter)
def tube(node, mat, pts, rs, n=6, jitter=0.05):
    rings = []
    for k, p in enumerate(pts):
        a = Vector(pts[max(k - 1, 0)]); b = Vector(pts[min(k + 1, len(pts) - 1)])
        d = (b - a).normalized()
        u = d.cross(Vector((0, 0, 1))) if abs(d.z) < 0.95 else d.cross(Vector((1, 0, 0)))
        u.normalize(); w = d.cross(u)
        rings.append([tuple(Vector(p) + rs[k] * (math.cos(2 * math.pi * i / n) * u + math.sin(2 * math.pi * i / n) * w)) for i in range(n)])
    solid(node, mat, rings, jitter=jitter)
def blob(node, mat, c, r, sub=1, rough=0.18, squash=(1, 1, 1), seed=0.0, jitter=0.07, cut=None):
    """A faceted lump: an icosphere pushed about by noise (rocks, tree crowns)."""
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    verts = []
    for v in bm.verts:
        p = v.co.copy()
        k = 1 + rough * noise.noise(p * 1.7 + Vector((seed, seed * 1.3, seed * 0.7)))
        q = Vector((c[0] + p.x * r * squash[0] * k, c[1] + p.y * r * squash[1] * k, c[2] + p.z * r * squash[2] * k))
        if cut is not None: q.z = max(q.z, cut)
        verts.append(tuple(q))
    faces = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    add(node, mat, verts, faces, jitter)

# ---- the lake island: a low grassy mound, a pebble shore, rocks breaking the waterline
IC = Vector((-5.6, 4.4))
def isl_r(th):                      # the island's outline at the waterline, by angle
    return 5.0 * (1 + 0.10 * math.sin(2 * th + 0.6) + 0.07 * math.sin(3 * th + 1.9) + 0.04 * math.sin(5 * th + 0.3)) * (1.0 if math.sin(th) < 0 else 0.86)
def isl_h(x, y):
    d = Vector((x, y)) - IC; th = math.atan2(d.y, d.x); r = d.length / isl_r(th)
    top = 0.95 - 0.55 * r * r + 0.08 * noise.noise(Vector((x * 0.45, y * 0.45, 3.0)))
    if r < 0.82: return top
    if r < 1.0: return top + (0.12 - top) * ((r - 0.82) / 0.18) ** 1.4      # down to the pebble shore
    return 0.12 - 0.9 * (r - 1.0) / 0.25                                    # under the water
NS, NR = 56, 14
rings = []
for k in range(NR + 1):
    t = k / NR; rr = 1.25 * t ** 0.85
    ring = []
    for i in range(NS):
        th = 2 * math.pi * (i + (0.5 if k % 2 else 0)) / NS
        jr = rr + (rng.uniform(-0.02, 0.02) if 0 < k < NR else 0)
        x = IC.x + isl_r(th) * jr * math.cos(th); y = IC.y + isl_r(th) * jr * math.sin(th)
        ring.append((x, y, max(isl_h(x, y), -0.4)))
    rings.append(ring)
cv = (IC.x, IC.y, isl_h(IC.x, IC.y))
iv = [cv] + [p for r in rings[1:] for p in r]
def vid(k, i): return 0 if k == 0 else 1 + (k - 1) * NS + (i % NS)
tris = []
for i in range(NS): tris.append((vid(0, 0), vid(1, i), vid(1, i + 1)))
for k in range(1, NR):
    for i in range(NS):
        a, b = vid(k, i), vid(k, i + 1); c, d = vid(k + 1, i), vid(k + 1, i + 1)
        if k % 2: tris += [(a, c, d), (a, d, b)]
        else: tris += [(a, c, b), (b, c, d)]
for t3 in tris:
    P = [Vector(iv[j]) for j in t3]
    n = (P[1] - P[0]).cross(P[2] - P[0])
    if n.z < 0: t3 = (t3[0], t3[2], t3[1]); n = -n
    zc = sum(p.z for p in P) / 3; steep = n.normalized().z < 0.82
    m = "sand" if zc < 0.2 else ("moss" if steep else ("grass2" if rng.random() < 0.3 else "grass"))
    add("island", m, P, [[0, 1, 2]], 0.05, orient=False)
# rocks at the shore and out in the water
for (x, y, r, sq) in [(-10.2, 2.9, 0.75, 0.75), (-9.6, 2.1, 0.45, 0.8), (-1.0, 1.4, 0.55, 0.7), (-0.3, 2.3, 0.35, 0.8),
                      (-7.3, 0.5, 0.4, 0.7), (1.0, 5.4, 0.6, 0.8), (-11.0, 6.6, 0.55, 0.9), (2.6, -0.1, 0.3, 0.7)]:
    blob("rocks", "rock" if rng.random() < 0.6 else "rockdk", (x, y, 0.05), r, sub=1, rough=0.32, squash=(1.2, 1.0, sq), seed=x, jitter=0.1, cut=-0.35)
# stepping stones from the front shore up to the shrine
for k, (x, y) in enumerate([(-4.3, -0.2), (-4.8, 0.55), (-5.2, 1.25)]):
    z = isl_h(x, y)
    solid("island", "stone", [ngon(0.34, z - 0.06, 7, x, y, k), ngon(0.31, z + 0.05, 7, x, y, k)], jitter=0.06)

# ---- the wayshrine: the game's meadow gate made carefully, on a two-step stone plinth, a straw rope with paper
# streamers across the opening and the orb floating within
SX, SY = -5.6, 3.6
SZ = isl_h(SX, SY) - 0.05
solid("shrine", "stone", [ngon(1.72, SZ - 0.25, 8, SX, SY, math.pi / 8), ngon(1.72, SZ + 0.1, 8, SX, SY, math.pi / 8)], jitter=0.04)
solid("shrine", "stone", [ngon(1.45, SZ + 0.1, 8, SX, SY, math.pi / 8), ngon(1.45, SZ + 0.24, 8, SX, SY, math.pi / 8)], jitter=0.04)
B = SZ + 0.24          # the gate stands on the upper step
PX = 0.9               # the game's pillar offset
for sx in (-1, 1):
    x = SX + sx * PX
    solid("shrine", "roof", [ngon(0.2, B, 12, x, SY), ngon(0.2, B + 0.22, 12, x, SY), ngon(0.17, B + 0.26, 12, x, SY)], jitter=0.02)   # black foot (nemaki)
    solid("shrine", "red", [ngon(0.155, B + 0.22, 12, x, SY), ngon(0.125, B + 2.25, 12, x, SY)], jitter=0.03)                      # tapering post
H = B + 2.05
box("shrine", "red", SX, SY, H - 0.08, H + 0.08, PX + 0.42, 0.1)                     # the tie beam (nuki), through the posts
for sx in (-1, 1):
    box("shrine", "reddk", SX + sx * (PX + 0.46), SY, H - 0.07, H + 0.07, 0.04, 0.09)   # wedge ends
box("shrine", "red", SX, SY, H + 0.08, H + 0.38, 0.09, 0.08)                          # the centre strut (gakuzuka)
box("shrine", "red", SX, SY, H + 0.38, H + 0.5, PX + 0.55, 0.13)                      # the lower lintel (shimaki)
# the upper lintel (kasagi): black, its ends sweeping up, built as a curved bar along x
NK = 14; half = PX + 0.98
lo, hi = [], []
for k in range(NK + 1):
    t = -1 + 2 * k / NK; x = SX + half * t; lift = 0.22 * abs(t) ** 3
    lo.append((x, H + 0.5 + lift)); hi.append((x, H + 0.72 + lift + 0.04 * abs(t)))
for k in range(NK):
    (xa, za0), (xb, zb0) = lo[k], lo[k + 1]; za1, zb1 = hi[k][1], hi[k + 1][1]
    q = [(xa, SY - 0.17, za0), (xb, SY - 0.17, zb0), (xb, SY + 0.17, zb0), (xa, SY + 0.17, za0),
         (xa, SY - 0.2, za1), (xb, SY - 0.2, zb1), (xb, SY + 0.2, zb1), (xa, SY + 0.2, za1)]
    add("shrine", "roof", q, [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], 0.03)
box("shrine", "paper", SX, SY - 0.1, H + 0.12, H + 0.34, 0.16, 0.012)                 # the plaque
# the straw rope, sagging between the posts at shoulder height, with zigzag paper streamers
RZ = B + 1.62
rope = [(SX - PX + 0.12 + (2 * PX - 0.24) * k / 16, SY - 0.17, RZ - 0.22 * math.sin(math.pi * k / 16)) for k in range(17)]
tube("shrine", "rope", rope, [0.045 + 0.02 * math.sin(math.pi * k / 16) for k in range(17)], 6)
for k in (4, 8, 12):
    x, y, z = rope[k]
    pts = [(x - 0.07, y, z - 0.04), (x + 0.07, y, z - 0.04), (x + 0.07, y, z - 0.17), (x - 0.04, y, z - 0.17),
           (x - 0.04, y, z - 0.3), (x + 0.08, y, z - 0.3), (x + 0.08, y, z - 0.44), (x - 0.06, y, z - 0.44)]
    add("shrine", "paper", [(px, py - 0.006, pz) for px, py, pz in pts] + [(px, py + 0.006, pz) for px, py, pz in pts],
        [[0, 1, 2, 3], [3, 4, 5, 6], [6, 7, 4, 3]] + [[8 + 3, 8 + 2, 8 + 1, 8 + 0], [8 + 6, 8 + 5, 8 + 4, 8 + 3], [8 + 3, 8 + 4, 8 + 7, 8 + 6]], 0.0, orient=False)
# the orb: hangs in the gate's opening (its own node so the scene can float and turn it)
bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.3)
add("orb", "glow_cream", [tuple(v.co) for v in bm.verts], [[v.index for v in f.verts] for f in bm.faces], 0.04)
bm.free()
ORIGINS["orb"] = (SX, SY, B + 1.15)

# ---- a stone lantern on the front of the island
LX, LY = -8.0, 2.3
LZ = isl_h(LX, LY) - 0.05
solid("lantern", "stone", [ngon(0.3, LZ, 6, LX, LY), ngon(0.3, LZ + 0.14, 6, LX, LY)])
solid("lantern", "stone", [ngon(0.11, LZ + 0.14, 8, LX, LY), ngon(0.09, LZ + 0.72, 8, LX, LY)])
solid("lantern", "stone", [ngon(0.27, LZ + 0.72, 6, LX, LY), ngon(0.22, LZ + 0.84, 6, LX, LY)])
box("glow_ishidoro", "glow_cream", LX, LY, LZ + 0.86, LZ + 1.12, 0.13, 0.13, 0.3)
for a in range(4):                                                     # the posts framing the light
    th = 0.3 + math.pi / 4 + a * math.pi / 2
    box("lantern", "stone", LX + 0.19 * math.cos(th), LY + 0.19 * math.sin(th), LZ + 0.84, LZ + 1.14, 0.035, 0.035, 0.3)
solid("lantern", "stone", [ngon(0.42, LZ + 1.14, 6, LX, LY, 0.3), ngon(0.44, LZ + 1.2, 6, LX, LY, 0.3), ngon(0.12, LZ + 1.42, 6, LX, LY, 0.3)])
blob("lantern", "stone", (LX, LY, LZ + 1.48), 0.08, sub=1, rough=0.05)

# ---- trees on the island: a cherry in bloom behind the gate, a small pine at the back
def cherry(node, x, y, s):
    z = isl_h(x, y) - 0.1
    trunk = [(x, y, z), (x + 0.1 * s, y + 0.05 * s, z + 0.8 * s), (x + 0.05 * s, y + 0.1 * s, z + 1.5 * s)]
    tube(node, "bark", trunk, [0.2 * s, 0.15 * s, 0.11 * s], 7)
    for (dx, dy, dz, l) in [(0.9, 0.2, 0.6, 1.0), (-0.8, 0.3, 0.7, 0.9), (0.2, -0.7, 0.6, 0.8), (-0.1, 0.8, 0.8, 0.8)]:
        a = Vector(trunk[2]); b = a + Vector((dx, dy, dz)) * s * l
        tube(node, "bark", [tuple(a), tuple(a.lerp(b, 0.5) + Vector((0, 0, 0.1 * s))), tuple(b)], [0.09 * s, 0.07 * s, 0.04 * s], 5)
    for (dx, dy, dz, r) in [(0, 0, 2.35, 1.05), (0.95, 0.25, 2.15, 0.85), (-0.85, 0.3, 2.2, 0.85), (0.2, -0.7, 2.1, 0.75),
                            (-0.1, 0.75, 2.45, 0.8), (0.55, 0.5, 2.8, 0.7), (-0.5, -0.3, 2.75, 0.65)]:
        blob(node, "blossom" if rng.random() < 0.6 else "blossom2", (x + dx * s, y + dy * s, z + dz * s), r * s, sub=1,
             rough=0.22, squash=(1, 1, 0.8), seed=dx * 3 + dy, jitter=0.08)
    ORIGINS[node] = (x, y, z)
cherry("sway_cherry", -7.4, 5.4, 1.0)
def pine(node, x, y, z, s, mats=("pine", "pinedk"), bark="bark", lean=0.0):
    """A Japanese black pine: a leaning trunk carrying flat, layered pads of needles."""
    pts = [(x, y, z), (x + lean * 0.4 * s, y, z + 1.4 * s), (x + lean * 0.9 * s, y + 0.1 * s, z + 2.8 * s), (x + lean * 1.1 * s, y + 0.15 * s, z + 3.9 * s)]
    tube(node, bark, pts, [0.2 * s, 0.15 * s, 0.11 * s, 0.07 * s], 7)
    pads = [(0.0, 0.0, 4.25, 0.95), (-1.15, 0.2, 3.35, 0.85), (1.3, -0.1, 2.95, 0.95), (-0.75, -0.3, 2.35, 0.72), (0.6, 0.4, 3.8, 0.72),
            (1.75, 0.3, 2.15, 0.6), (-1.7, -0.1, 2.75, 0.55), (0.35, -0.45, 3.2, 0.6)]
    for k, (dx, dy, dz, r) in enumerate(pads):
        c = Vector((x + (dx + lean * dz * 0.28) * s, y + dy * s, z + dz * s))
        base = Vector(pts[min(3, int(dz / 1.3))])
        tube(node, bark, [tuple(base), tuple(base.lerp(c, 0.6) + Vector((0, 0, 0.15 * s))), tuple(c)], [0.07 * s, 0.05 * s, 0.03 * s], 5)
        blob(node, mats[0], tuple(c + Vector((0, 0, 0.1 * s))), r * s, sub=1, rough=0.2, squash=(1.25, 1.1, 0.42), seed=k + x, jitter=0.07)
        blob(node, mats[1], tuple(c - Vector((0, 0, 0.08 * s))), r * 0.9 * s, sub=1, rough=0.2, squash=(1.2, 1.05, 0.3), seed=k + x + 9, jitter=0.07)
    ORIGINS[node] = (x, y, z)
pine("sway_pine_island", -2.6, 6.6, isl_h(-2.6, 6.6) - 0.1, 0.62, lean=-0.6)
# low shrubs and tufts on the island
for (x, y, r) in [(-8.6, 3.4, 0.45), (-2.3, 4.6, 0.35), (-6.8, 1.5, 0.3), (-9.0, 5.9, 0.4), (-4.0, 6.9, 0.32)]:
    blob("island", "moss", (x, y, isl_h(x, y) + 0.1), r, sub=1, rough=0.25, squash=(1.2, 1.1, 0.65), seed=x * 2, jitter=0.08)

# where the traveller rests: on the grass to the right of the gate, looking out over the water toward the sun
TX, TY = -3.35, 3.25
ORIGINS["spot_traveller"] = (TX, TY, isl_h(TX, TY) - 0.02)
TRAVELLER_FACING = math.radians(53)      # rotation about z of the empty; she faces its local -Y: toward the lanterns

# ---- floating lanterns (toro): one, which the scene copies across the water
TORO = (0.0, -60.0, 0.0)                  # parked out of view; the scene moves the copies
def toro():
    x, y = TORO[0], TORO[1]
    box("toro", "wood", x, y, -0.05, 0.06, 0.24, 0.24, 0.0, 0.04)                        # the float
    box("toro", "glow_cream", x, y, 0.06, 0.4, 0.16, 0.16, 0.0, 0.02)                   # the paper
    for sx in (-1, 1):
        for sy in (-1, 1): box("toro", "wood", x + sx * 0.165, y + sy * 0.165, 0.06, 0.44, 0.018, 0.018, 0.0, 0.02)
    box("toro", "wood", x, y, 0.4, 0.45, 0.19, 0.19, 0.0, 0.02)
toro()
ORIGINS["toro"] = TORO

# ---- the far shore: low wooded hills along the water, a pagoda on a spur
def ridge(node, mat, x0, x1, y, hmin, hmax, depth, n, seed, jitter=0.06, zbase=-0.3):
    """A mountain range as faceted peaks: a front and back row of points, the front row's peaks irregular."""
    rr = random.Random(seed)
    xs = [x0 + (x1 - x0) * k / n for k in range(n + 1)]
    pk = [rr.uniform(hmin, hmax) * (0.35 if k in (0, n) else 1.0) for k in range(n + 1)]
    for k in range(n):
        xa, xb = xs[k], xs[k + 1]; xm = (xa + xb) / 2 + rr.uniform(-0.2, 0.2) * (xb - xa)
        ya = y + rr.uniform(-0.15, 0.15) * depth
        apex = (xm, ya + depth * 0.5, max(pk[k], pk[k + 1]) * rr.uniform(0.8, 1.05))
        a = (xa, ya, pk[k] * 0.45); b = (xb, ya, pk[k + 1] * 0.45)
        fa = (xa, ya - depth * 0.2, zbase); fb = (xb, ya - depth * 0.2, zbase)
        ba = (xa, ya + depth, zbase); bb = (xb, ya + depth, zbase)
        add(node, mat, [fa, fb, b, apex, a, ba, bb], [[0, 1, 2, 4], [4, 2, 3], [2, 6, 3], [4, 3, 5], [0, 4, 5], [1, 6, 2]], jitter, orient=False)
ridge("shore", "shore", -260, 260, 118, 0.8, 2.6, 8, 120, 3, 0.08, zbase=-0.2)
ridge("shore", "shore", -260, 260, 126, 2.0, 5.0, 12, 70, 4, 0.08, zbase=-0.2)
# pagoda on the far shore, small against the hills
PGX, PGY = 52.0, 114.0
for k in range(5):
    w = 1.5 - 0.2 * k; z0 = 1.0 + k * 1.35
    box("shore", "reddk", PGX, PGY, z0, z0 + 0.9, w * 0.6, w * 0.6)
    solid("shore", "roof", [ngon(w * 1.15, z0 + 0.9, 4, PGX, PGY, math.pi / 4), ngon(w * 0.55, z0 + 1.3, 4, PGX, PGY, math.pi / 4)], jitter=0.02)
box("shore", "roof", PGX, PGY, 1.0 + 5 * 1.35, 1.0 + 5 * 1.35 + 1.4, 0.07, 0.07)
solid("shore", "shore", [ngon(5.0, -0.2, 9, PGX, PGY), ngon(3.0, 1.0, 9, PGX, PGY), ngon(1.4, 1.2, 9, PGX, PGY)])   # the spur it stands on

# ---- the ranges: mid blue hills, the far pale range, and the snow-capped peak above them all
ridge("mtn_mid", "mtn_mid", -330, 330, 205, 14, 34, 40, 22, 7, 0.07)
ridge("mtn_far", "mtn_far", -420, 420, 330, 26, 52, 60, 18, 13, 0.06)
def peak(node, cx, cy, R, Hh, seed):
    """A tall volcano: a concave faceted cone with a flat crater rim and a ragged snow cap."""
    rr = random.Random(seed); NSg = 30; NRg = 9
    pts = {}
    for k in range(NRg + 1):
        t = k / NRg                            # 0 at the rim, 1 at the foot
        for i in range(NSg):
            th = 2 * math.pi * (i + (0.5 if k % 2 else 0)) / NSg
            r = R * (0.06 + 0.94 * t) * (1 + (rr.uniform(-0.05, 0.05) if 0 < k < NRg else 0))
            z = Hh * (1 - t) ** 1.7 + (rr.uniform(-0.02, 0.02) * Hh if 0 < k < NRg else 0)
            pts[(k, i)] = (cx + r * math.cos(th), cy + r * 0.7 * math.sin(th), z if k < NRg else -1.0)
    def P(k, i): return Vector(pts[(k, i % NSg)])
    for k in range(NRg):
        for i in range(NSg):
            for tri in ((P(k, i), P(k + 1, i), P(k + 1, i + 1)) if k % 2 == 0 else (P(k, i), P(k + 1, i), P(k, i + 1)),
                        (P(k, i), P(k + 1, i + 1), P(k, i + 1)) if k % 2 == 0 else (P(k, i + 1), P(k + 1, i), P(k + 1, i + 1))):
                zc = sum(p.z for p in tri) / 3; th = math.atan2(tri[0].y - cy, tri[0].x - cx)
                line = Hh * (0.62 + 0.09 * math.sin(5 * th + 1.0) + 0.05 * math.sin(11 * th))
                add(node, "snow" if zc > line else "mtn_fuji", list(tri), [[0, 2, 1]], 0.05, orient=False)
    rim = [P(0, i) for i in range(NSg)]
    add(node, "snow", [tuple(p) for p in rim] + [(cx, cy, Hh * 0.97)], [[i, (i + 1) % NSg, NSg] for i in range(NSg)][::-1], 0.03, orient=False)
peak("mtn_fuji", -40.0, 262.0, 135.0, 52.0, 5)

# ---- foreground pines framing the view, dark against the light, cut by the frame's edges
def conifer(node, x, y, z, s, lean=0.0, tiers=8, seed=0):
    """A tall pine: a straight, gently leaning trunk carrying tiers of drooping, ragged-edged boughs that shrink
    toward a pointed crown, lit green above and darker beneath (the game's pine, made carefully)."""
    rr = random.Random(seed)
    top = 10.2 * s
    def at(h): return (x + lean * h / top * 1.2 * s, y + 0.15 * s * h / top)
    tube(node, "fgbark", [(*at(h), z + h) for h in (0.0, 0.3 * top, 0.65 * top, 0.92 * top)], [0.3 * s, 0.22 * s, 0.13 * s, 0.05 * s], 7, 0.05)
    for k in range(tiers):
        t = k / (tiers - 1)
        zb = z + (2.4 + 7.0 * t ** 0.92) * s
        r = (0.45 + 2.05 * (1 - t) ** 1.15) * s
        h = (1.75 - 0.55 * t) * s
        cx, cy = at(zb - z)
        n = 11; ph = rr.uniform(0, 6.28)
        rim = []
        for i in range(n):
            a = ph + 2 * math.pi * i / n
            rad = r * rr.uniform(0.82, 1.12)
            rim.append((cx + rad * math.cos(a), cy + rad * 0.92 * math.sin(a), zb + rr.uniform(-0.12, 0.1) * r))
        lip = [(cx + (px - cx) * 0.9, cy + (py - cy) * 0.9, pz + 0.16 * s) for px, py, pz in rim]
        apex = (cx, cy, zb + h)
        under = (cx, cy, zb + 0.25 * h)
        V = rim + lip + [apex, under]; A = 2 * n; U = 2 * n + 1
        top_f = [[n + i, n + (i + 1) % n, A] for i in range(n)] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
        bot_f = [[(i + 1) % n, i, U] for i in range(n)]
        add(node, "fgpine", V, top_f, 0.07, orient=False)
        add(node, "fgpinedk", V, bot_f, 0.06, orient=False)
    ORIGINS[node] = (x, y, z)
conifer("sway_pine_left", -7.3, -9.3, -0.4, 1.0, lean=0.25, seed=1)
conifer("sway_pine_left2", -10.8, -3.6, -0.4, 0.8, lean=0.1, tiers=7, seed=4)
conifer("sway_pine_right", 8.9, -8.3, -0.4, 1.08, lean=-0.3, seed=2)
conifer("sway_pine_right2", 11.8, -3.2, -0.4, 0.85, lean=-0.15, tiers=7, seed=3)
for (x, y, r) in [(-7.0, -9.1, 0.9), (-5.8, -9.8, 0.5), (-10.6, -3.3, 0.7), (8.8, -8.1, 1.0), (7.4, -8.9, 0.55), (11.3, -3.2, 0.7)]:   # the rocks they grow from
    blob("fg_rocks", "rockdk", (x, y, -0.1), r, sub=1, rough=0.3, squash=(1.3, 1.0, 0.55), seed=x, jitter=0.1, cut=-0.5)

# ---- build the objects: one object per node and material, colour per face in COLOR_0
mats = {}
def getmat(name):
    if name in mats: return mats[name]
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    p = [n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    c = lin(PAL[name])
    p.inputs["Base Color"].default_value = c + [1.0]
    p.inputs["Roughness"].default_value = 1.0
    p.inputs["Metallic"].default_value = 0.0
    m.diffuse_color = c + [1.0]; m.roughness = 1.0
    mats[name] = m; return m
col = bpy.context.scene.collection
stats = {}
parents = {}
for node in sorted(NODES):
    origin = Vector(ORIGINS.get(node, (0, 0, 0)))
    groups = NODES[node]
    if len(groups) > 1 or node in ORIGINS:
        emp = bpy.data.objects.new(node, None); emp.location = origin; col.objects.link(emp); parents[node] = emp
    for mname, (vs, fs, cs) in sorted(groups.items()):
        oname = node if (len(groups) == 1 and node not in ORIGINS) else f"{node}_{mname}"
        if node.startswith("glow_") or mname.startswith("glow_"): oname = oname if oname.startswith("glow_") else "glow_" + oname
        me = bpy.data.meshes.new(oname)
        me.from_pydata([tuple(Vector(v) - origin) for v in vs], [], fs); me.validate(); me.update()
        for p in me.polygons: p.use_smooth = False
        ca = me.color_attributes.new(name="Col", type='BYTE_COLOR', domain='CORNER')
        for poly, k in zip(me.polygons, cs):
            for li in poly.loop_indices: ca.data[li].color = (min(1, k * 0.94), min(1, k * 0.94), min(1, k * 0.94), 1.0)
        me.color_attributes.active_color = ca
        me.materials.append(getmat(mname))
        ob = bpy.data.objects.new(oname, me); col.objects.link(ob)
        if node in parents: ob.parent = parents[node]
        else: ob.location = origin
        stats[oname] = sum(len(p.vertices) - 2 for p in me.polygons)
for name in ("spot_traveller",):
    emp = bpy.data.objects.new(name, None); emp.location = ORIGINS[name]; emp.rotation_euler = (0, 0, TRAVELLER_FACING); col.objects.link(emp)
emp = bpy.data.objects.new("spot_sun", None); emp.location = (-140.0, 400.0, 121.5); col.objects.link(emp)

# the framing: eye height above the water, looking a touch up so the sky and the peak fill the top
cam_d = bpy.data.cameras.new("title_camera"); cam_d.sensor_fit = 'VERTICAL'; cam_d.angle_y = math.radians(34)
cam_d.clip_start = 0.3; cam_d.clip_end = 900
cam = bpy.data.objects.new("title_camera", cam_d); col.objects.link(cam)
cam.location = (0.0, -22.0, 3.6); cam.rotation_euler = (math.radians(90 + 5.5), 0, 0)
bpy.context.scene.camera = cam

os.makedirs(os.path.dirname(GLB), exist_ok=True); os.makedirs(os.path.dirname(BLEND), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
kw = dict(filepath=GLB, export_format='GLB', export_yup=True, export_apply=True, export_cameras=True, export_lights=False,
          export_animations=False, export_materials='EXPORT')
def export_model(**options):
    try:
        bpy.ops.export_scene.gltf(**options, export_vertex_color='ACTIVE')
    except TypeError:
        bpy.ops.export_scene.gltf(**options, export_colors=True)

export_model(**kw)
# The game only needs the lantern, not the entire title scene.
bpy.ops.object.select_all(action='DESELECT')
lantern = parents["toro"]
lantern.location = (0, 0, 0)
for ob in (lantern, *lantern.children):
    ob.select_set(True)
bpy.context.view_layer.update()
export_model(**{**kw, "filepath": TORO_GLB, "export_cameras": False, "use_selection": True})
res = {"tris": sum(stats.values()), "objects": len(stats), "materials": len(mats), "glb_bytes": os.path.getsize(GLB),
       "top": sorted(stats.items(), key=lambda kv: -kv[1])[:8]}
json.dump(res, open("/tmp/title_build.json", "w"))
