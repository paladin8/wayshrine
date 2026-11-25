# Z-fighting check for the landmark models: finds pairs of surfaces that lie in the same plane and overlap, which
# the renderer can't order and so draws flickering between them.
#
# Run from the repo root:
#   Blender -b --factory-startup --python content/landmarks/zfight_check.py                 # every model
#   Blender -b --factory-startup --python content/landmarks/zfight_check.py -- dogo-onsen   # named ones
#
# It reads each content/landmarks/<id>.blend (so build the model first) and reports only flicker that can be
# seen: pairs with different materials (two surfaces of one colour flicker invisibly), facing the game camera
# (down-facing faces are skipped), and not hidden by geometry within OCCLUDE units toward the camera (an eave
# over a wall, say). Exits 1 if anything is found.
#
# Positions are in the model's own frame (Blender x, y, z; the game's z is -y). The usual fix is to pull one of the
# two surfaces back 1-3 cm so they no longer share a plane.
import bpy, sys, os, math, glob, json
from collections import defaultdict
from mathutils import Vector
from mathutils.bvhtree import BVHTree

D = os.path.dirname(os.path.abspath(__file__))
CAM = Vector((0.55, -0.55, 0.63)).normalized()   # toward the game's isometric camera
PLANE_TOL = 0.004     # surfaces closer than this (units) count as one plane
MIN_AREA = 0.004      # smallest overlap reported (square units)
OCCLUDE = 2.5         # geometry this close toward the camera hides a spot
MODEL_PAD = 0.6       # the game's terrain under a model with its own ground sits this far below it
SURFACE_PAD = 0.01    # the game's terrain under a terrainSurface model sits this far below the sidecar surface

def material(obj_name):
    if obj_name.startswith("glow_"): return "glow"          # every glow_* object shares the glow material
    return obj_name.split("_", 1)[1] if "_" in obj_name else obj_name

def clip(poly, a, b):
    out = []
    def side(p): return (b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0])
    for i in range(len(poly)):
        p, q = poly[i], poly[(i+1) % len(poly)]; sp, sq = side(p), side(q)
        if sp >= 0: out.append(p)
        if (sp >= 0) != (sq >= 0):
            t = sp/(sp-sq); out.append((p[0]+(q[0]-p[0])*t, p[1]+(q[1]-p[1])*t))
    return out

def signed_area(poly):
    return 0.5*sum(poly[i][0]*poly[(i+1) % len(poly)][1] - poly[(i+1) % len(poly)][0]*poly[i][1] for i in range(len(poly)))

def overlap(A, B):
    """Overlap of two triangles in 2D: (area, sample points inside it)."""
    if signed_area(A) < 0: A = A[::-1]
    if signed_area(B) < 0: B = B[::-1]
    P = A
    for i in range(len(B)):
        P = clip(P, B[i], B[(i+1) % len(B)])
        if not P: return 0.0, []
    a = abs(signed_area(P))
    if a < 1e-9: return 0.0, []
    cx = sum(p[0] for p in P)/len(P); cy = sum(p[1] for p in P)/len(P)
    return a, [(cx, cy)] + [(cx+0.7*(p[0]-cx), cy+0.7*(p[1]-cy)) for p in P]

def terrain(name):
    """The game's terrain under the model, as triangles. Under a terrainSurface model: 1-unit tiles whose corners
    sample the sidecar's terrain (or ground) grid bilinearly, SURFACE_PAD below it (terrain-grid.ts cornerOf), the
    base height 0 outside."""
    side = os.path.join(D, "..", "..", "src", "world", "landmark-grounds", name + ".json")
    if not os.path.exists(side): return []
    g = json.load(open(side))
    gh, gs, gg = g["half"], g["step"], g.get("terrain") or g["ground"]; n = len(gg)
    if not g.get("terrainSurface"): return sunk(gh, gs, gg)
    def surf(dx, dz):
        if max(abs(dx), abs(dz)) >= gh: return 0.0
        return grid(dx, dz) - SURFACE_PAD
    def grid(dx, dz):
        fx = min(n-1, max(0.0, (dx+gh)/gs)); fz = min(n-1, max(0.0, (dz+gh)/gs))
        x0 = min(n-2, int(fx)); z0 = min(n-2, int(fz)); tx = fx-x0; tz = fz-z0
        return gg[z0][x0]*(1-tx)*(1-tz) + gg[z0][x0+1]*tx*(1-tz) + gg[z0+1][x0]*(1-tx)*tz + gg[z0+1][x0+1]*tx*tz
    m = int(math.ceil(gh)) + 1
    V = {(x, z): Vector((x, -z, surf(x, z))) for x in range(-m, m+1) for z in range(-m, m+1)}
    out = []
    for x in range(-m, m):
        for z in range(-m, m):
            a, b, c, d = V[(x, z)], V[(x+1, z)], V[(x+1, z+1)], V[(x, z+1)]
            for vs in ((a, c, b), (a, d, c)):
                nn = (vs[1]-vs[0]).cross(vs[2]-vs[0])
                if nn.length < 1e-9: continue
                nn.normalize()
                if nn.z < 0: vs = vs[::-1]; nn = -nn
                out.append(("terrain", nn, list(vs)))
    return out

def sunk(gh, gs, gg):
    """The game's terrain sunk under a model with its own ground (terrain-grid.ts sunkUnder): flat 1-unit tiles at
    the lowest surface of the tile and its neighbours (sampled at tile centres) less MODEL_PAD, with the cliffs
    between them, which stand on tile lines where a model wall may stand too."""
    n = len(gg)
    def grid(dx, dz):
        fx = min(n-1, max(0.0, (dx+gh)/gs)); fz = min(n-1, max(0.0, (dz+gh)/gs))
        x0 = min(n-2, int(fx)); z0 = min(n-2, int(fz)); tx = fx-x0; tz = fz-z0
        return gg[z0][x0]*(1-tx)*(1-tz) + gg[z0][x0+1]*tx*(1-tz) + gg[z0+1][x0]*(1-tx)*tz + gg[z0+1][x0+1]*tx*tz
    m = int(math.ceil(gh))
    h = {}
    for x in range(-m, m):
        for z in range(-m, m):
            if max(abs(x+0.5), abs(z+0.5)) > gh-0.5: continue      # tiles at the edge belong to the blend
            h[(x, z)] = min(grid(x+0.5+i, z+0.5+j) for i in (-1, 0, 1) for j in (-1, 0, 1)) - MODEL_PAD
    out = []
    up = Vector((0, 0, 1))
    for (x, z), t in h.items():
        out.append(("terrain", up, [Vector((x, -z, t)), Vector((x+1, -z, t)), Vector((x+1, -z-1, t))]))
        out.append(("terrain", up, [Vector((x, -z, t)), Vector((x+1, -z-1, t)), Vector((x, -z-1, t))]))
        for (ox, oz) in ((1, 0), (0, 1)):
            u = h.get((x+ox, z+oz))
            if u is None or abs(u-t) < 1e-6: continue
            lo, hi = min(t, u), max(t, u)
            if ox: a, b = Vector((x+1, -z, 0)), Vector((x+1, -z-1, 0)); nn = Vector((1 if t > u else -1, 0, 0))
            else:  a, b = Vector((x, -z-1, 0)), Vector((x+1, -z-1, 0)); nn = Vector((0, -1 if t > u else 1, 0))
            q = [a+up*lo, b+up*lo, b+up*hi, a+up*hi]
            out.append(("terrain", nn, [q[0], q[1], q[2]])); out.append(("terrain", nn, [q[0], q[2], q[3]]))
    return out

def check(path):
    bpy.ops.wm.open_mainfile(filepath=path)
    tris = []
    for o in bpy.data.objects:
        if o.type != "MESH": continue
        me = o.data; me.calc_loop_triangles(); M = o.matrix_world
        W = [M @ v.co for v in me.vertices]
        for t in me.loop_triangles:
            vs = [W[i] for i in t.vertices]
            n = (vs[1]-vs[0]).cross(vs[2]-vs[0])
            if n.length < 1e-9: continue
            n.normalize()
            if n.z < -0.3: continue
            tris.append((o.name, n, vs))
    tris += terrain(os.path.splitext(os.path.basename(path))[0])
    verts, faces = [], []
    for _, _, vs in tris:
        b = len(verts); verts += [tuple(v) for v in vs]; faces.append((b, b+1, b+2))
    bvh = BVHTree.FromPolygons(verts, faces, epsilon=0.0)
    planes = defaultdict(list)
    for k, (_, n, vs) in enumerate(tris):
        planes[(round(n.x*50), round(n.y*50), round(n.z*50), round(n.dot(vs[0])*100))].append(k)
    hits, seen = [], set()
    for key, own in planes.items():
        nxt = planes.get((key[0], key[1], key[2], key[3]+1), [])     # a neighbouring offset bucket, for near-equal planes
        group = own + nxt
        if len(group) < 2: continue
        n = tris[own[0]][1]
        u = (Vector((1, 0, 0)) if abs(n.x) < 0.9 else Vector((0, 1, 0))).cross(n).normalized(); w = n.cross(u)
        P = {j: [(v.dot(u), v.dot(w)) for v in tris[j][2]] for j in group}
        grid = defaultdict(list)
        for j in group:
            xs = [p[0] for p in P[j]]; ys = [p[1] for p in P[j]]
            for gx in range(math.floor(min(xs)*2), math.floor(max(xs)*2)+1):
                for gy in range(math.floor(min(ys)*2), math.floor(max(ys)*2)+1):
                    grid[(gx, gy)].append(j)
        for cell in grid.values():
            for a in range(len(cell)):
                for b in range(a+1, len(cell)):
                    i, j = cell[a], cell[b]
                    pair = (min(i, j), max(i, j))
                    if pair in seen: continue
                    seen.add(pair)
                    if material(tris[i][0]) == material(tris[j][0]): continue
                    if tris[i][1].dot(tris[j][1]) < 0.999: continue
                    if abs(tris[i][1].dot(tris[i][2][0]) - tris[i][1].dot(tris[j][2][0])) > PLANE_TOL: continue
                    sa = {tuple(round(c, 4) for c in v) for v in tris[i][2]}
                    sb = {tuple(round(c, 4) for c in v) for v in tris[j][2]}
                    if len(sa & sb) >= 2: continue                       # neighbours sharing an edge
                    if tris[i][1].dot(CAM) < 0.05: continue              # faces away from the camera
                    area, pts = overlap(P[i], P[j])
                    if area <= MIN_AREA: continue
                    nn = tris[i][1]; d = nn.dot(tris[i][2][0])
                    seen_from_cam = False
                    for cx, cy in pts:
                        p3 = u*cx + w*cy + nn*d
                        if bvh.ray_cast(p3 + nn*0.003 + CAM*0.003, CAM, OCCLUDE)[0] is None:
                            seen_from_cam = True; break
                    if not seen_from_cam: continue
                    cx, cy = pts[0]; c = u*cx + w*cy + nn*d
                    hits.append((material(tris[i][0]), material(tris[j][0]), c, area, nn))
    return hits

args = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
names = args or sorted(os.path.basename(f)[:-6] for f in glob.glob(os.path.join(D, "*.blend")))
found = 0
for name in names:
    path = os.path.join(D, name + ".blend")
    if not os.path.exists(path):
        print(f"{name}: no .blend (build it first)"); found += 1; continue
    hits = check(path)
    if not hits:
        print(f"{name}: ok"); continue
    found += len(hits)
    print(f"{name}: {len(hits)} visible coplanar overlap(s)")
    shown = set()
    for ma, mb, c, area, n in hits:
        key = (ma, mb, round(c.x, 1), round(c.y, 1), round(c.z, 1))
        if key in shown: continue
        shown.add(key)
        print(f"  {ma} / {mb} at ({c.x:.2f}, {c.y:.2f}, {c.z:.2f}) facing ({n.x:.2f}, {n.y:.2f}, {n.z:.2f}), overlap {area:.3f}")
sys.exit(1 if found else 0)
