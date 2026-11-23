# Kurashiki Bikan (the willow-lined canal, white namako-walled storehouses, the stone Naka-bashi, the Ohara Museum front) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python kurashiki-bikan.py
# Rebuilds content/landmarks/kurashiki-bikan.blend and public/models/landmarks/kurashiki-bikan.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/kurashiki-bikan.glb"
BLEND=ROOT+"/content/landmarks/kurashiki-bikan.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"water":"5a7d7a","stone":"a39e94","pave":"c4beb2","plaster":"efede6","black":"2a2a2e","roof":"4a4a4f","wood":"6e4c36","willow":"8fb35a","bark":"4e3a30","museum":"d9cfb8","leaf":"4f6e3c","glow_cream":"e8dcb0"}
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
rng=random.Random(24)
EXTRA_SOLIDS=[]
FH=11.2   # footprint half-width (the sidecar's half): the middle size, a stretch of the old merchant quarter
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
# axes: v runs along the canal (world +X), u across it (u>0 the near bank, world -Y). The canal runs corner to
# corner across the game view, so both banks show at an angle.
def to_xy(u,v): return (v,-u)
def to_uv(x,y): return (-y,x)
ROT=0.0
def T_uv(u,v,face=0.0): x,y=to_xy(u,v); return dict(cx=x,cy=y,rot=ROT+face)   # local +x along v, local -y toward the near bank

# ---- the Kurashiki river: a straight canal between sloping granite embankments, squared off at each end
CU=0.0; CHW=0.85; CV=8.6
box("water",0,0,-0.05,0.04,CV,CHW,T_uv(CU,0.0))
for sy in (-1,1):    # embankments: battered stone, rising a little above the promenade
    extrude_x("stone",[(sy*CHW,-0.05),(sy*(CHW+0.45),-0.05),(sy*(CHW+0.45),0.32),(sy*(CHW+0.12),0.32)],-CV-0.45,CV+0.45,T_uv(CU,0.0))
for sx in (-1,1): box("stone",sx*(CV+0.22),0,-0.05,0.32,0.22,CHW,T_uv(CU,0.0))
for sy in (-1,1): box("pave",0,sy*(CHW+1.25),-0.04,0.03,CV+1.2,0.8,T_uv(CU,0.0))     # the promenades
def in_water(x,y,pad=0.0):
    u,v=to_uv(x,y); return abs(u-CU)<CHW+pad and abs(v)<CV+pad

# ---- Naka-bashi: a stone arch bridge over the canal, its parapets following the arch
BV=-2.2; ARCH=0.55; BL=1.75
def zt(t): return 0.32+ARCH*math.sin(math.pi*t)
TB=T_uv(CU,BV,math.pi/2)     # local +x across the canal (along u)
ks=[k/12 for k in range(13)]
solid([[(-BL+2*BL*t,-0.85,zt(t)-0.25),(-BL+2*BL*t,0.85,zt(t)-0.25),(-BL+2*BL*t,0.85,zt(t)),(-BL+2*BL*t,-0.85,zt(t))] for t in ks],"stone",TB)
for sy in (-1,1):
    solid([[(-BL+2*BL*t,sy*0.78-0.07,zt(t)),(-BL+2*BL*t,sy*0.78+0.07,zt(t)),(-BL+2*BL*t,sy*0.78+0.07,zt(t)+0.42),(-BL+2*BL*t,sy*0.78-0.07,zt(t)+0.42)] for t in ks],"pave",TB)
    for ex in (-BL,BL): box("stone",ex,sy*0.78,-0.05,0.95,0.12,0.12,TB)
# the arch's span under the deck, a dark curve on each face
for sy in (-1,1):
    solid([[(-0.8+1.6*t,sy*0.86-0.02,0.04+0.55*math.sin(math.pi*t)-0.18),(-0.8+1.6*t,sy*0.86+0.02,0.04+0.55*math.sin(math.pi*t)-0.18),(-0.8+1.6*t,sy*0.86+0.02,0.04+0.55*math.sin(math.pi*t)),(-0.8+1.6*t,sy*0.86-0.02,0.04+0.55*math.sin(math.pi*t))] for t in ks],"black",TB)
def bridge_h(x,y):
    u,v=to_uv(x,y)
    if abs(v-BV)<=0.7 and abs(u-CU)<=BL: return zt((u-CU+BL)/(2*BL))
    return None

# ---- kura storehouses along the far bank, facing the canal: white plaster, the lower walls in namako tiling
# (black tiles set diagonally in white joints), dark tiled roofs, black shutters
def kura(v,w,u0=-4.0,d=1.1,h=2.5,face=0.0,tiles=True):
    T=T_uv(u0,v,face)
    box("plaster",0,0,-0.05,h,w,d,T)
    a=0.17; nx=int((2*w)/(2*a+0.06))
    for row in range(3 if tiles else 0):                    # the namako tiles on the canal face
        z=0.2+row*0.32
        for k in range(nx+(1 if row%2 else 0)):
            x=-w+a+0.03+k*(2*a+0.06)-(a+0.03 if row%2 else 0)
            if abs(x)>w-a: continue
            extrude_y("black",[(x-a,z),(x,z-a),(x+a,z),(x,z+a)],-d-0.03,-d+0.01,T)
    box("black",0,-d-0.01,1.05,1.12,w,0.02,T)                # the dark band above the tiling
    for x in (-w*0.45,w*0.45): box("black",x,-d-0.02,1.55,1.95,0.22,0.02,T)   # shuttered windows
    box("wood",0,-d-0.02,0.0,0.9,0.32,0.02,T)
    extrude_x("roof",[(-d-0.32,h-0.05),(d+0.32,h-0.05),(d+0.32,h+0.07),(0,h+0.8),(-d-0.32,h+0.07)],-w-0.28,w+0.28,T)
    box("roof",0,0,h+0.73,h+0.88,w+0.32,0.13,T)
    box("roof",0,-d-0.15,1.25,1.33,w+0.1,0.22,T)             # the pent roof over the ground floor
for v,w in [(-7.3,1.15),(-4.7,1.2),(0.3,1.1),(7.2,1.15)]: kura(v,w)
# a second row behind, roofs rising over the first
for v,w in [(-7.0,1.4),(-3.6,1.5),(0.0,1.3),(3.6,1.5),(7.2,1.3)]: kura(v,w,u0=-7.6,d=1.2,h=2.1,tiles=False)

# ---- the Ohara Museum of Art: a Greek-revival front of cream stone, Ionic columns and a pediment
MV=3.75; TM=T_uv(-4.3,MV)
box("stone",0,0.1,-0.05,0.3,2.1,1.5,TM)
box("museum",0,0.25,0.3,2.3,1.9,1.25,TM)
for k in range(4):
    x=-1.05+0.7*k
    prism("museum",*xf([(x,-1.25,0)],**TM)[0][:2],0.3,1.95,0.11,0.1,8,0)
    box("museum",x,-1.25,1.95,2.03,0.15,0.15,TM)
box("museum",0,-0.6,1.95,2.25,1.45,0.75,TM)                 # entablature over the portico
extrude_x("museum",[(-1.45,2.25),(-0.05,2.25),(-0.75,2.75)],-1.5,1.5,TM)                  # the pediment
box("roof",0,0.35,2.3,2.42,1.95,1.3,TM)
box("black",0,-1.01,0.3,1.25,0.32,0.02,TM)
for k in range(3): box("pave",0,-1.35-0.18*k,-0.05,0.3-0.1*k,1.2,0.09,TM)

# ---- the near bank: low shops at either end, so the canal stays in view
def shop(v,w):
    T=T_uv(4.1,v,math.pi)
    box("plaster",0,0,-0.05,1.3,w,0.9,T)
    box("wood",0,-0.91,0.0,1.0,w-0.15,0.02,T)
    box("glow_shop_%d"%(0 if v<0 else 1),0,-0.92,0.35,0.85,w*0.6,0.01,T)
    extrude_x("roof",[(-1.15,1.25),(1.15,1.25),(1.15,1.35),(0,1.9),(-1.15,1.35)],-w-0.2,w+0.2,T)
shop(-7.2,1.2); shop(7.0,1.2)
def house(u,v,w):                                           # merchant houses on the near side, set back from the canal
    T=T_uv(u,v,math.pi)
    box("plaster",0,0,-0.05,1.55,w,1.0,T)
    box("wood",0,0,-0.05,0.75,w+0.02,1.02,T)                 # dark lattice-board lower walls
    extrude_x("roof",[(-1.25,1.5),(1.25,1.5),(1.25,1.6),(0,2.25),(-1.25,1.6)],-w-0.22,w+0.22,T)
for v,w in [(-5.4,1.4),(-0.4,1.3),(3.4,1.5)]: house(7.4,v,w)

# ---- willows along both banks, punts on the water
def willow(u,v,s):
    x,y=to_xy(u,v); T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.13,-0.3,5),ngon(0.1,1.4,5,0,0.15,0),ngon(0.07,1.9,5,0,0.25,0.1)],"bark",T)
    ico("willow",0.2,0.05,2.15,0.75,0.75,0.4,T)
    for k in range(6):
        a=2*math.pi*k/6+rng.uniform(-0.2,0.2); r=rng.uniform(0.5,0.75)
        cx,cy=0.2+r*math.cos(a),0.05+r*math.sin(a)
        solid([ngon(0.22,2.1,4,a,cx,cy),ngon(0.05,rng.uniform(0.55,0.85),4,a,cx*1.12,cy*1.12)],"willow",T)
WILLOWS=[(-1.55,v) for v in (-7.6,-5.4,0.0,2.4,5.0,7.6)]+[(1.55,v) for v in (-6.0,-0.4,3.6,6.4)]
for u,v in WILLOWS: willow(u,v,rng.uniform(0.9,1.05))
def punt(v,flip,gi):
    T=T_uv(CU,v,math.pi if flip else 0.0)
    rings=[]
    for lx,hw,ztop in [(-1.0,0.2,0.28),(-0.85,0.27,0.24),(0.6,0.27,0.24),(0.9,0.16,0.28),(1.1,0.03,0.34)]:
        rings.append([(lx,-hw*0.8,-0.02),(lx,hw*0.8,-0.02),(lx,hw,ztop),(lx,-hw,ztop)])
    solid(rings,"wood",T)
    for lx in (-0.3,0.25): box("pave",lx,0,0.16,0.22,0.05,0.24,T)
    box("black",-0.75,0,0.24,0.8,0.07,0.07,T); ico("pave",-0.75,0,0.87,0.065,0.065,0.075,T)
    cone("pave",ngon(0.18,0.91,8,0,-0.75,0),(-0.75,0,1.05),T)
    solid([rect(0.02,0.02,0.3,-0.95,0.1),rect(0.02,0.02,1.55,-0.45,0.18)],"wood",T)
    box("glow_lamp_%d"%gi,0.95,0,0.34,0.46,0.05,0.05,T)
punt(-5.6,False,1); punt(4.8,True,2)
# trees in the corners beyond the buildings
def tree(u,v,s):
    x,y=to_xy(u,v); T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.14,-0.3,5),ngon(0.1,1.2,5,0,0.1,0)],"bark",T)
    ico("leaf",0,0,1.9,1.0,0.95,0.8,T); ico("leaf",0.55,0.3,1.5,0.6,0.55,0.5,T)
for u,v in [(-10.0,-1.8),(-10.0,5.4),(5.4,-3.0),(9.8,-7.8),(9.8,7.6),(-10.0,-8.6)]: tree(u,v,rng.uniform(0.85,1.05))

def floor_at(x,y):
    h=bridge_h(x,y); return h if h is not None else 0.0
STAND=to_xy(2.0,-4.4)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/kurashiki-bikan.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=FH; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y): return floor_at(x,y)   # the arch bridge; the game draws the ground beneath
ground=[[round(ground_at(-HALF+GSTEP*ix, -(-HALF+GSTEP*iz)),3) for ix in range(GN)] for iz in range(GN)]
CELL=0.3
solid_cells=set(); cellg={}
BAND0,BAND1=0.35,1.6
for key,(bv,bf) in B.items():
    if key in ("willow","leaf"): continue      # crowns and hanging tresses overhead don't block; the trunks (bark) do
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
        if in_water(x,y,-0.2) and floor_at(x,y)==0.0 and all(floor_at(x+dx,y+dy)==0.0 for dx,dy in ((0.5,0),(-0.5,0),(0,0.5),(0,-0.5))):
            EXTRA_SOLIDS.append((x,y,0.43))
solids+=[[round(x,2),round(-y,2),r] for x,y,r in EXTRA_SOLIDS]
INTERACT=to_xy(CU,BV)   # the top of Naka-bashi
# STAND (set above): the near promenade
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]],"terrainSurface":True}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/kurashiki-bikan.json"
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
    objname=key if key.startswith("glow_") else "kurashiki_"+key
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
