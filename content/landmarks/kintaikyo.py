# Kintaikyo Bridge (five timber arches on stone piers across the Nishiki river and its gravel beds, Iwakuni Castle on the hill behind) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python kintaikyo.py
# Rebuilds content/landmarks/kintaikyo.blend and public/models/landmarks/kintaikyo.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/kintaikyo.glb"
BLEND=ROOT+"/content/landmarks/kintaikyo.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"wood":"6b4e36","deck":"8a6a4a","stonewall":"a39e94","water":"4f9aa0","gravel":"cfc9bb","stone":"8a857c","forest":"3f6a3a","white":"f0ede6","tile":"4e5256","blossom":"f0c4d4","leaf":"4f7a45","bark":"4e3a30"}
def lin(h):
    o=[]
    for i in (0,2,4):
        c=int(h[i:i+2],16)/255
        o.append(c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4)
    return o+[1.0]

# geometry buckets: material key -> (verts, faces). Every piece is a closed solid; winding is
# made outward by checking the signed volume.
B={}
def emit(verts,faces,mats,orient=True):
    V=[Vector(v) for v in verts]
    vol=0.0
    for f in faces:
        a=V[f[0]]
        for i in range(1,len(f)-1):
            vol+=a.dot(V[f[i]].cross(V[f[i+1]]))
    if orient and vol<0: faces=[list(reversed(f)) for f in faces]
    maps={}
    for f,m in zip(faces,mats):
        if m is None: continue
        if m not in B: B[m]=([],[])
        bv,bf=B[m]; mp=maps.setdefault(m,{})
        idx=[]
        for i in f:
            if i not in mp:
                mp[i]=len(bv); bv.append(tuple(V[i]))
            idx.append(mp[i])
        bf.append(idx)

def xf(pts,cx=0,cy=0,cz=0,rot=0,s=1.0):
    c,sn=math.cos(rot),math.sin(rot)
    return [(cx+s*(x*c-y*sn), cy+s*(x*sn+y*c), cz+s*z) for (x,y,z) in pts]
def solid(rings,mat,T=None,mb='same',mt='same'):
    T=T or {}
    n=len(rings[0]); verts=[p for r in rings for p in r]; faces=[]; fm=[]
    for k in range(len(rings)-1):
        for i in range(n):
            j=(i+1)%n
            faces.append([k*n+i,k*n+j,(k+1)*n+j,(k+1)*n+i]); fm.append(mat)
    faces.append(list(range(n-1,-1,-1))); fm.append(mat if mb=='same' else mb)
    L=len(rings)-1
    faces.append([L*n+i for i in range(n)]); fm.append(mat if mt=='same' else mt)
    emit(xf(verts,**T),faces,fm)
def rect(hx,hy,z,ox=0,oy=0):
    return [(ox-hx,oy-hy,z),(ox+hx,oy-hy,z),(ox+hx,oy+hy,z),(ox-hx,oy+hy,z)]
def ngon(r,z,n,ph=0,ox=0,oy=0):
    return [(ox+r*math.cos(ph+2*math.pi*i/n), oy+r*math.sin(ph+2*math.pi*i/n), z) for i in range(n)]
def box(mat,ox,oy,z0,z1,hx,hy,T=None,mt='same'):
    solid([rect(hx,hy,z0,ox,oy),rect(hx,hy,z1,ox,oy)],mat,T,mt=mt)
def frus(mat,ox,oy,z0,z1,hx0,hy0,hx1,hy1,oy1=None,T=None):
    solid([rect(hx0,hy0,z0,ox,oy),rect(hx1,hy1,z1,ox,oy if oy1 is None else oy1)],mat,T)
def prism(mat,ox,oy,z0,z1,r0,r1,n=6,ph=0,T=None):
    solid([ngon(r0,z0,n,ph,ox,oy),ngon(r1,z1,n,ph,ox,oy)],mat,T)
def cone(mat,ring,apex,T=None):
    T=T or {}; n=len(ring); verts=list(ring)+[apex]
    faces=[list(range(n-1,-1,-1))]+[[i,(i+1)%n,n] for i in range(n)]
    emit(xf(verts,**T),faces,[mat]*len(faces))
def bipyr(mat,ox,oy,zc,r,zb,zt,n=6,T=None):
    T=T or {}; ring=ngon(r,zc,n,0,ox,oy); verts=ring+[(ox,oy,zb),(ox,oy,zt)]
    faces=[[(i+1)%n,i,n] for i in range(n)]+[[i,(i+1)%n,n+1] for i in range(n)]
    emit(xf(verts,**T),faces,[mat]*len(faces))
ICO_F=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]]
def ico(mat,ox,oy,oz,rx,ry,rz,T=None):
    T=T or {}; t=(1+5**0.5)/2
    raw=[(-1,t,0),(1,t,0),(-1,-t,0),(1,-t,0),(0,-1,t),(0,1,t),(0,-1,-t),(0,1,-t),(t,0,-1),(t,0,1),(-t,0,-1),(-t,0,1)]
    vs=[]
    for v in raw:
        l=Vector(v).normalized(); vs.append((ox+l.x*rx,oy+l.y*ry,oz+l.z*rz))
    emit(xf(vs,**T),ICO_F,[mat]*20)
def extrude_y(mat,prof,y0,y1,T=None): solid([[(x,y0,z) for x,z in prof],[(x,y1,z) for x,z in prof]],mat,T)
def extrude_x(mat,prof,x0,x1,T=None): solid([[(x0,y,z) for y,z in prof],[(x1,y,z) for y,z in prof]],mat,T)

def flared_roof(spec,mat="roof",ox=0.0,oy=0.0):
    """Hip roof from stacked rings (hx, hy, z, lift). Each ring has its corners raised by
    `lift` and pushed out along the diagonal, easing to flat at mid-edge (sori)."""
    sg=[(-1,-1),(1,-1),(1,1),(-1,1)]
    rings=[]
    for hx,hy,z,lift in spec:
        cs=[(-hx,-hy),(hx,-hy),(hx,hy),(-hx,hy)]; r=[]
        for k in range(4):
            (x0,y0),(x1,y1)=cs[k],cs[(k+1)%4]
            for t in (0.0,0.25,0.5,0.75):
                x=x0+(x1-x0)*t; y=y0+(y1-y0)*t
                if t==0.0: x+=sg[k][0]*0.45*lift; y+=sg[k][1]*0.45*lift
                r.append((ox+x,oy+y,z+lift*abs(2*t-1)**2.5))
        rings.append(r)
    n=16; verts=[p for r in rings for p in r]; faces=[]
    for k in range(len(rings)-1):
        for i in range(n):
            j=(i+1)%n; a,b,c,dd=k*n+i,k*n+j,(k+1)*n+j,(k+1)*n+i
            faces+=[[a,b,c],[a,c,dd]]
    cb=len(verts); verts.append((ox,oy,spec[0][2]))
    ct=len(verts); verts.append((ox,oy,spec[-1][2]))
    L=(len(rings)-1)*n
    for i in range(n):
        j=(i+1)%n; faces.append([cb,j,i]); faces.append([ct,L+i,L+j])
    emit(verts,faces,[mat]*len(faces))

import random
rng=random.Random(49)
EXTRA_SOLIDS=[]; NOSOLID={"leaf","blossom","pine"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the five arches across the river, the castle hill
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0
S2=math.sqrt(0.5)
def to_xy(u,v): return (S2*(u+v),S2*(v-u))     # u toward the camera, v screen-right
def to_uv(x,y): return (S2*(x-y),S2*(x+y))
def tube(mat,pts,rs,n=6):
    rings=[]
    for k,p in enumerate(pts):
        a=pts[max(k-1,0)]; b=pts[min(k+1,len(pts)-1)]
        d=Vector(b)-Vector(a); d.normalize()
        u=d.cross(Vector((0,0,1))) if abs(d.z)<0.95 else d.cross(Vector((1,0,0)))
        u.normalize(); w=d.cross(u)
        rings.append([tuple(Vector(p)+rs[k]*(math.cos(2*math.pi*i/n)*u+math.sin(2*math.pi*i/n)*w)) for i in range(n)])
    solid(rings,mat)

# ---- the Nishiki river runs toward the camera between broad gravel beds; at low water it sinks into the gravel
# before either edge, so it stays inside the footprint. Stone embankments hold the banks
WZ=-0.2; RIV=-0.5; GRV=-0.32; GM=-0.25    # GM: the gravel's drawn surface, just above the terrain beneath it
def rw(u): return 3.6*smooth(7.2,4.6,abs(u-0.6))+0.2      # half-width of the flowing water
def in_water(u,v,m=0.0): return abs(v-0.25*math.sin(0.3*u))<rw(u)-m and -6.6<u<7.8
def in_bed(u,v): return abs(v)<5.0 and -6.8<u<8.4
def G(u,v):
    if in_water(u,v): return RIV
    if in_bed(u,v): return GRV
    return 0.0
us=[-6.6+14.4*k/24 for k in range(25)]
for ua,ub in zip(us,us[1:]):
    wa,wb=rw(ua),rw(ub)
    if wa<0.25 and wb<0.25: continue
    ca,cb=0.25*math.sin(0.3*ua),0.25*math.sin(0.3*ub)
    q=[to_xy(ua,ca-wa),to_xy(ua,ca+wa),to_xy(ub,cb+wb),to_xy(ub,cb-wb)]
    emit([(*p,WZ) for p in q],[[0,1,2,3]],["water"])
q=[to_xy(-6.8,-5.0),to_xy(-6.8,5.0),to_xy(8.4,5.0),to_xy(8.4,-5.0)]
emit([(*p,GM) for p in q],[[0,1,2,3]],["gravel"])
for k in range(40):
    u,v=rng.uniform(-6.6,8.2),rng.uniform(-4.9,4.9)
    if in_water(u,v,-0.1): continue
    x,y=to_xy(u,v); ico("stone",x,y,GM,rng.uniform(0.12,0.25),rng.uniform(0.1,0.2),0.08)
for sd in (-1,1):                                      # the embankments along each bank
    a0=to_xy(-7.15,sd*5.0); a1=to_xy(8.75,sd*5.0); b0=to_xy(-7.15,sd*5.35); b1=to_xy(8.75,sd*5.35)
    solid([[(a0[0],a0[1],GRV-0.05),(b0[0],b0[1],GRV-0.05),(b0[0],b0[1],0.05),(a0[0],a0[1],0.05)],[(a1[0],a1[1],GRV-0.05),(b1[0],b1[1],GRV-0.05),(b1[0],b1[1],0.05),(a1[0],a1[1],0.05)]],"stonewall")
for ue,uo in ((-6.8,-7.15),(8.4,8.75)):
    a0=to_xy(ue,-5.0); a1=to_xy(ue,5.0); b0=to_xy(uo,-5.0); b1=to_xy(uo,5.0)
    solid([[(a0[0],a0[1],GRV-0.05),(b0[0],b0[1],GRV-0.05),(b0[0],b0[1],0.05),(a0[0],a0[1],0.05)],[(a1[0],a1[1],GRV-0.05),(b1[0],b1[1],GRV-0.05),(b1[0],b1[1],0.05),(a1[0],a1[1],0.05)]],"stonewall")

# ---- Kintaikyo: five timber arches, three great ones on tall stone piers and a lower one at each end on posts;
# the deck climbs and falls over each arch, railed
PIERS=[-4.0,-1.33,1.33,4.0]; VE=5.8; BW=0.62
def deck(v):
    av=abs(v)
    if av<=4.0:
        k=min(range(3),key=lambda i:abs(v-(-2.67+2.67*i))); c=-2.67+2.67*k
        t=(v-c)/1.335; return 1.15+0.95*(1-t*t)
    t=(av-4.0)/(VE-4.0); return 1.15*(1-t)+0.05*t+0.35*math.sin(math.pi*t)
def on_bridge(u,v): return abs(u)<=BW and abs(v)<=VE+0.4
def P(u,v,z): x,y=to_xy(u,v); return (x,y,z)
for v in PIERS:                                         # the piers: stone, pointed upstream and down
    x,y=to_xy(0,v); T=dict(cx=x,cy=y,rot=math.pi/4)
    solid([[(-1.6,-0.5,RIV-0.1),(-1.1,-0.62,RIV-0.1),(1.1,-0.62,RIV-0.1),(1.6,-0.5,RIV-0.1),(1.6,0.5,RIV-0.1),(1.1,0.62,RIV-0.1),(-1.1,0.62,RIV-0.1),(-1.6,0.5,RIV-0.1)],
           [(-1.15,-0.38,1.05),(-0.8,-0.48,1.05),(0.8,-0.48,1.05),(1.15,-0.38,1.05),(1.15,0.38,1.05),(0.8,0.48,1.05),(-0.8,0.48,1.05),(-1.15,0.38,1.05)]],"stonewall")
    for zc in (0.0,0.4,0.75): box("stone",0,0,zc,zc+0.025,0.01+1.2-0.3*zc,0.01+0.6-0.12*zc,T)
N=12
for sp in range(5):
    v0,v1=([-VE]+PIERS+[VE])[sp],([-VE]+PIERS+[VE])[sp+1]
    vs=[v0+(v1-v0)*k/N for k in range(N+1)]
    for su in (-0.45,-0.15,0.15,0.45):                   # the stacked arch beams beneath
        pts=[P(su,v,deck(v)-0.25) for v in vs]
        tube("wood",pts,[0.07]*len(pts),4)
    for va,vb in zip(vs,vs[1:]):
        za,zb=deck(va),deck(vb)
        a=[P(-BW,va,za-0.1),P(BW,va,za-0.1),P(BW,va,za),P(-BW,va,za)]
        b=[P(-BW,vb,zb-0.1),P(BW,vb,zb-0.1),P(BW,vb,zb),P(-BW,vb,zb)]
        solid([a,b],"deck")
    for sd in (-1,1):
        tube("wood",[P(sd*BW,v,deck(v)+0.55) for v in vs],[0.035]*len(vs),4)
        for v in vs[::2]: box("wood",*to_xy(sd*BW,v),deck(v),deck(v)+0.58,0.03,0.03)
    if sp in (0,4):                                      # the end spans stand on timber posts
        for v in vs[2:-1:3]:
            for su in (-0.4,0.4):
                x,y=to_xy(su,v); box("wood",x,y,GRV-0.05,deck(v)-0.3,0.07,0.07)
    else:
        for v in vs[1:-1:2]:                            # the copper-capped struts in the arch's spandrels
            for su in (-0.45,0.45):
                x,y=to_xy(su,v); box("wood",x,y,deck(v)-0.25-0.35*(1-((v-(v0+v1)/2)/(v1-v0)*2)**2),deck(v)-0.2,0.03,0.03)

# ---- the castle hill behind the far bank: forested, Iwakuni's white keep on its crown
HC=(-9.4,0.4)
def hill(u,v):
    d=math.hypot((u-HC[0])/1.0,(v-HC[1])/1.35); return 3.4*max(0.0,1-d/2.6)**1.2
def ground_at(x,y):
    u,v=to_uv(x,y)
    if on_bridge(u,v): return max(deck(v),G(u,v))
    return G(u,v)+hill(u,v)
def terrain_at(x,y):
    # the game samples the terrain on 1-unit tiles: under the bed it sits well below the gravel, so it never
    # rides up through it against the embankments
    u,v=to_uv(x,y)
    if in_bed(u,v): return min(G(u,v),-0.55)+hill(u,v)   # above the region water level (-0.6): not open water
    return G(u,v)+hill(u,v)
def water_disc(x,y): u,v=to_uv(x,y); return in_water(u,v,0.15) and not on_bridge(u,v)
hx,hy=to_xy(*HC); NA=12
rings=[]
for r,z in ((2.6,-0.1),(1.9,1.0),(1.15,2.2),(0.45,3.1),(0.0,3.4)):
    rings.append([(*to_xy(HC[0]+max(r,0.01)*math.cos(2*math.pi*k/NA),HC[1]+1.35*max(r,0.01)*math.sin(2*math.pi*k/NA)),z) for k in range(NA)])
solid(rings,"forest")
kz=3.35
box("stonewall",hx,hy,kz-0.4,kz+0.35,0.85,0.85)
for i,(w,z0,z1) in enumerate(((0.7,kz+0.35,kz+1.05),(0.55,kz+1.3,kz+1.85),(0.42,kz+2.1,kz+2.55))):
    box("white",hx,hy,z0,z1,w,w*0.85)
    flared_roof([(w+0.32,w*0.85+0.3,z1,0.15),(w+0.32,w*0.85+0.3,z1+0.08,0.15),(w*0.75,w*0.6,z1+0.22 if i<2 else z1+0.25,0.04 if i<2 else 0.0)] + ([] if i<2 else [(w*0.5,0.06,z1+0.55,0.0)]),"tile",hx,hy)

# ---- trees on both banks: cherries along the river, pines, the forest behind
def tree(u,v,s,m):
    x,y=to_xy(u,v); T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.14,-0.3,5),ngon(0.09,1.4,5,0,0.15,0)],"bark",T)
    ico(m,0,0,1.9,1.05,1.0,0.8,T); ico(m,0.5,0.3,1.55,0.65,0.6,0.5,T)
for u,v,s in [(-5.8,-6.4,0.9),(-3.6,-6.2,0.95),(-1.2,-6.6,0.9),(1.6,-6.2,0.9),(4.4,-6.4,0.85),(-5.6,6.4,0.9),(-3.2,6.2,0.95),(-0.8,6.6,0.9),(2.0,6.4,0.9),(4.8,6.2,0.85)]:
    x,y=to_xy(u,v)
    if abs(x)<FH-1.1 and abs(y)<FH-1.1: tree(u,v,s,"blossom")
for u,v,s in [(-8.6,-4.4,1.1),(-8.0,5.0,1.1),(-6.0,8.4,1.0),(-6.4,-8.0,1.0),(6.8,-7.8,0.9),(7.2,7.0,0.9)]:
    x,y=to_xy(u,v)
    if abs(x)<FH-1.1 and abs(y)<FH-1.1: tree(u,v,s,"leaf")
INTERACT=to_xy(0.0,VE+1.1)   # at the bridge's near-bank foot
STAND=to_xy(1.4,VE+1.6)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/kintaikyo.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=FH; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
ground=[[round(ground_at(-HALF+GSTEP*ix, -(-HALF+GSTEP*iz)),3) for ix in range(GN)] for iz in range(GN)]
for i in range(GN): ground[0][i]=ground[GN-1][i]=ground[i][0]=ground[i][GN-1]=EDGE_LEVEL    # the edge ring: the base height, or open water
CELL=0.3
solid_cells=set(); cellg={}
BAND0,BAND1=0.35,1.6
for key,(bv,bf) in B.items():
    if key in NOSOLID: continue      # foliage overhead (crowns, hanging tresses) doesn't block; trunks do
    for f in bf:
        for i in range(1,len(f)-1):
            a,b,c=[Vector(bv[k]) for k in (f[0],f[i],f[i+1])]
            n=(b-a).cross(c-a); ln=math.sqrt(n.dot(n))
            if ln<1e-9: continue
            nz=n.z/ln
            e=max(math.dist(tuple(a),tuple(b)),math.dist(tuple(b),tuple(c)),math.dist(tuple(a),tuple(c)))
            m=max(1,int(e/0.15))
            for p in range(m+1):
                for q in range(m+1-p):
                    u,v=p/m,q/m; w=1-u-v
                    x=a.x*w+b.x*u+c.x*v; y=a.y*w+b.y*u+c.y*v; z=a.z*w+b.z*u+c.z*v
                    if not(-HALF<=x<HALF and -HALF<=y<HALF): continue
                    ck=(int((x+HALF)/CELL),int((y+HALF)/CELL)); g=cellg.get(ck)
                    if g is None: g=cellg[ck]=ground_at(-HALF+CELL*(ck[0]+0.5),-HALF+CELL*(ck[1]+0.5))
                    if z<g+BAND0 or z>g+BAND1: continue
                    if nz>0.92 and z<g+0.6: continue
                    solid_cells.add(ck)
solids=[[round(-HALF+CELL*(cx+0.5),2), round(-(-HALF+CELL*(cy+0.5)),2), 0.22] for cx,cy in sorted(solid_cells)]
for ix in range(int(2*HALF/0.6)+1):
    for iy in range(int(2*HALF/0.6)+1):
        x,y=-HALF+0.3+ix*0.6,-HALF+0.3+iy*0.6
        if water_disc(x,y): EXTRA_SOLIDS.append((x,y,0.43))
solids+=[[round(x,2),round(-y,2),r] for x,y,r in EXTRA_SOLIDS]
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]]}
if TERRAIN_SURFACE: side["terrainSurface"]=True
if "terrain_at" in globals():         # the terrain's own height where it differs from the walkable ground (a deck over a gorge)
    terr=[[round(terrain_at(-HALF+GSTEP*ix, -(-HALF+GSTEP*iz)),3) for ix in range(GN)] for iz in range(GN)]
    for i in range(GN): terr[0][i]=terr[GN-1][i]=terr[i][0]=terr[i][GN-1]=EDGE_LEVEL
    if terr!=ground: side["terrain"]=terr
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/kintaikyo.json"
os.makedirs(os.path.dirname(_p),exist_ok=True)
open(_p,"w").write(json.dumps(side,separators=(",",":")))

# ---- one object per material (+ one object per glow part)
mats={}
def getmat(name):
    if name in mats: return mats[name]
    m=bpy.data.materials.new(name)
    if m.node_tree is None:
        try: m.use_nodes=True
        except Exception: pass
    p=[n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'][0]
    p.inputs["Base Color"].default_value=lin(PAL[name])
    p.inputs["Roughness"].default_value=1.0
    p.inputs["Metallic"].default_value=0.0
    m.diffuse_color=lin(PAL[name]); m.roughness=1.0
    mats[name]=m; return m
col=bpy.context.scene.collection
stats={}; allv=[]
for key in sorted(B):
    vs,fs=B[key]
    matname="glow_cream" if key.startswith("glow_") else key
    objname=key if key.startswith("glow_") else "kintaikyo_"+key
    me=bpy.data.meshes.new(objname); me.from_pydata(vs,[],fs); me.validate(); me.update()
    for p in me.polygons: p.use_smooth=False
    me.materials.append(getmat(matname))
    ob=bpy.data.objects.new(objname,me); col.objects.link(ob)
    stats[objname]=sum(len(p.vertices)-2 for p in me.polygons)
    allv+= [v.co.copy() for v in me.vertices]
mn=[min(v[i] for v in allv) for i in range(3)]; mx=[max(v[i] for v in allv) for i in range(3)]
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', export_yup=True, export_apply=True,
    export_cameras=False, export_lights=False, export_animations=False, export_materials='EXPORT')
clr=min(math.hypot(s[0]-STAND[0],s[1]+STAND[1])-s[2] for s in solids)
res={"stand_clear":round(clr,3),"tris":sum(stats.values()),"per_obj":stats,"materials":len(bpy.data.materials),"min":[round(v,3) for v in mn],"max":[round(v,3) for v in mx],"glb_bytes":os.path.getsize(GLB)}
json.dump(res,open("/tmp/lm_build.json","w"))
