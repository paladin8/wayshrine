# Dazaifu Tenmangu (the heart-shaped pond and its three vermilion bridges, the tower gate, the bark-roofed main hall, plum trees in blossom) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python dazaifu.py
# Rebuilds content/landmarks/dazaifu.blend and public/models/landmarks/dazaifu.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/dazaifu.glb"
BLEND=ROOT+"/content/landmarks/dazaifu.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"red":"d6492f","white":"f0ede6","barkroof":"6e5444","gold":"d9b04a","stone":"b5b0a6","water":"4f7d76","plum":"f0c4d4","leaf":"4f7a45","bark":"4e3a30","bronze":"5f5a48","pave":"cdc8bc","glow_cream":"e8dcb0"}
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
rng=random.Random(47)
EXTRA_SOLIDS=[]; NOSOLID={"leaf","plum"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the shrine precinct from the pond to the hall
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0

def tube(mat,pts,rs,n=6):
    rings=[]
    for k,p in enumerate(pts):
        a=pts[max(k-1,0)]; b=pts[min(k+1,len(pts)-1)]
        d=Vector(b)-Vector(a); d.normalize()
        u=d.cross(Vector((0,0,1))) if abs(d.z)<0.95 else d.cross(Vector((1,0,0)))
        u.normalize(); w=d.cross(u)
        rings.append([tuple(Vector(p)+rs[k]*(math.cos(2*math.pi*i/n)*u+math.sin(2*math.pi*i/n)*w)) for i in range(n)])
    solid(rings,mat)

# ---- Shinji-ike, the heart-shaped pond, crossed by three vermilion bridges: drum bridge, flat bridge, drum bridge
PC=(0.0,-4.7)
def pr(a): return 1.0+0.22*abs(math.sin(a))**3 - 0.18*max(0.0,math.sin(a))**8
def in_pond(x,y,m=0.0):
    a=math.atan2((y-PC[1])/3.1,(x-PC[0])/4.6); r=math.hypot((x-PC[0])/4.6,(y-PC[1])/3.1); return r<pr(a)-m/3.4
ISL=[(0.0,-5.8,0.55),(0.0,-3.5,0.55)]
def on_island(x,y,m=0.0): return any(math.hypot((x-cx)/1.4,(y-cy)/r)<1.0+m for cx,cy,r in ISL)
BR=[(-8.75,-6.35,"arch"),(-5.5,-3.8,"flat"),(-2.95,-0.55,"arch")]   # the flat bridge rests a little way onto each island
BW=0.6    # half-width: a drum bridge is long and narrow, three or four times as long as it is wide
def bridge_z(x,y):
    if abs(x)>BW+0.02: return None
    for y0,y1,kind in BR:
        if y0<=y<=y1:
            t=(y-y0)/(y1-y0)
            return 0.18+(0.95*math.sin(math.pi*t)**0.8 if kind=="arch" else 0.02+0.08*math.sin(math.pi*t))
    return None
def water_disc(x,y): return in_pond(x,y,0.15) and not on_island(x,y,0.1) and bridge_z(x,y) is None
NP=28
ring=[(PC[0]+4.6*pr(2*math.pi*k/NP)*math.cos(2*math.pi*k/NP),PC[1]+3.1*pr(2*math.pi*k/NP)*math.sin(2*math.pi*k/NP)) for k in range(NP)]
emit([(x,y,0.04) for x,y in ring]+[(PC[0],PC[1],0.04)],[[k,(k+1)%NP,NP] for k in range(NP)],["water"]*NP)
for k in range(NP):
    a=2*math.pi*(k+0.5)/NP; x=PC[0]+(4.6*pr(a)+0.12)*math.cos(a); y=PC[1]+(3.1*pr(a)+0.12)*math.sin(a)
    if abs(x)<1.0: continue
    ico("stone",x,y,0.0,rng.uniform(0.25,0.4),rng.uniform(0.22,0.36),rng.uniform(0.15,0.25))
for cx,cy,r in ISL:
    emit([(cx+1.4*math.cos(2*math.pi*k/12),cy+r*math.sin(2*math.pi*k/12),0.08) for k in range(12)]+[(cx,cy,0.08)],[[k,(k+1)%12,12] for k in range(12)],["pave"]*12)
for y0,y1,kind in BR:
    n=12 if kind=="arch" else 4; th=0.12 if kind=="arch" else 0.08
    ys=[y0+(y1-y0)*k/n for k in range(n+1)]
    for ya,yb in zip(ys,ys[1:]):
        za,zb=bridge_z(0,ya+1e-6),bridge_z(0,yb-1e-6)
        solid([[(-BW,ya,za-th),(BW,ya,za-th),(BW,ya,za),(-BW,ya,za)],[(-BW,yb,zb-th),(BW,yb,zb-th),(BW,yb,zb),(-BW,yb,zb)]],"red")
    for sx in (-1,1):
        tube("red",[(sx*BW,y,bridge_z(0,min(max(y,y0+1e-6),y1-1e-6))+0.5) for y in ys],[0.04]*len(ys),4)
        for y in ys[::2]: box("red",sx*BW,y,bridge_z(0,min(max(y,y0+1e-6),y1-1e-6))-0.05,bridge_z(0,min(max(y,y0+1e-6),y1-1e-6))+0.56,0.04,0.04)
    for t in ((0.2,0.5,0.8) if kind=="arch" else (0.3,0.7)):       # legs down into the pond
        y=y0+(y1-y0)*t
        for sx in (-1,1): box("red",sx*(BW-0.12),y,-0.1,bridge_z(0,y)-th+0.02,0.05,0.05)

# ---- the approach: a granite torii at the edge, the bronze bull, stone lanterns, paving to the gate
box("pave",0,-9.95,-0.04,0.03,0.8,1.2)
box("pave",0,-0.15,-0.04,0.03,0.8,0.45)
for sx in (-1,1): prism("stone",sx*1.25,-10.4,-0.05,2.4,0.14,0.12,10)
box("stone",0,-10.4,1.85,1.97,1.45,0.08); box("stone",0,-10.4,2.35,2.5,1.7,0.12)
BX,BY=2.0,-9.8
box("stone",BX,BY,-0.05,0.3,0.55,0.3)
solid([[(BX-0.42,BY-0.18,0.3),(BX+0.3,BY-0.18,0.3),(BX+0.3,BY+0.18,0.3),(BX-0.42,BY+0.18,0.3)],[(BX-0.38,BY-0.16,0.62),(BX+0.26,BY-0.16,0.66),(BX+0.26,BY+0.16,0.66),(BX-0.38,BY+0.16,0.62)]],"bronze")
solid([[(BX+0.26,BY-0.11,0.42),(BX+0.26,BY+0.11,0.42),(BX+0.26,BY+0.11,0.66),(BX+0.26,BY-0.11,0.66)],[(BX+0.52,BY-0.08,0.36),(BX+0.52,BY+0.08,0.36),(BX+0.52,BY+0.08,0.56),(BX+0.52,BY-0.08,0.56)]],"bronze")
for sy in (-1,1): tube("bronze",[(BX+0.3,BY+sy*0.09,0.66),(BX+0.36,BY+sy*0.2,0.78)],[0.025,0.01],4)
for k,(x,y) in enumerate(((-1.7,-9.5),(-2.4,-0.9),(2.4,-0.9),(-2.8,4.0),(2.8,4.0))):
    prism("stone",x,y,-0.05,0.55,0.12,0.09,6); box("stone",x,y,0.55,0.6,0.2,0.2)
    box("glow_lantern_%d"%k,x,y,0.6,0.82,0.12,0.12); flared_roof([(0.26,0.26,0.82,0.04),(0.26,0.26,0.87,0.04),(0.03,0.03,1.07,0.0)],"stone",x,y)

# ---- the tower gate (romon): vermilion, two storeys, cypress-bark roofs
GY=1.3
box("stone",0,GY,-0.05,0.15,2.3,1.0)
for x in (-2.0,-0.95,0.95,2.0):
    for y in (-0.7,0.7): box("red",x,GY+y,0.15,1.85,0.1,0.1)
for sx in (-1,1): box("white",sx*1.48,GY,0.3,1.7,0.42,0.62)
box("red",0,GY,1.75,1.95,2.15,0.85)
flared_roof([(2.7,1.45,1.95,0.22),(2.7,1.45,2.05,0.22),(2.0,0.9,2.25,0.04)],"barkroof",0,GY)
box("red",0,GY,2.2,2.95,1.6,0.7); box("white",0,GY-0.71,2.35,2.8,1.4,0.01)
flared_roof([(2.4,1.4,2.95,0.28),(2.4,1.4,3.07,0.28),(1.55,0.6,3.5,0.06),(1.3,0.1,3.85,0.0)],"barkroof",0,GY)

# ---- the main hall (honden): vermilion and white under a thick bark roof, a curving karahafu porch hung with gold
HY=6.2
box("stone",0,HY,-0.05,0.4,3.4,2.2)
box("red",0,HY,0.4,2.1,3.0,1.9)
for k in range(7): box("white",-2.5+0.833*k,HY-1.91,0.6,1.9,0.3,0.01)
for k in range(8): box("red",-2.92+0.834*k,HY-1.93,0.4,2.1,0.07,0.04)
box("glow_hall",0,HY-1.94,0.6,1.6,0.7,0.01)
flared_roof([(3.9,2.75,2.1,0.32),(3.9,2.75,2.3,0.32),(2.9,1.75,3.2,0.08),(2.5,0.2,4.2,0.0)],"barkroof",0,HY)
box("gold",0,HY,4.15,4.3,2.5,0.12)
T=dict(cx=0,cy=HY-2.75,cz=1.95,rot=0)
lo=[(-1.2,0),(-0.72,0.3),(-0.3,0.85),(0,0.98),(0.3,0.85),(0.72,0.3),(1.2,0)]
extrude_y("gold",lo,0.1,-0.75,T)
hi=[(1.42,-0.08),(0.74,0.44),(0.3,1.02),(0,1.16),(-0.3,1.02),(-0.74,0.44),(-1.42,-0.08)]
extrude_y("barkroof",lo+hi,0.12,-0.95,T)
for sx in (-1,1): box("red",sx*1.1,HY-3.35,0.4,1.95,0.08,0.08)
for k in range(5): box("stone",0,HY-2.4-0.2*k,-0.05,0.4-0.08*k,1.0,0.1)

# ---- plum trees in blossom (the flying plum to the right of the hall), great camphors round about
def tree(x,y,s,m,crown=1.0):
    T2=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.16,-0.3,5),ngon(0.1,1.8,5,0,0.2,0)],"bark",T2)
    ico(m,0,0,2.4,1.25*crown,1.15*crown,0.95*crown,T2); ico(m,0.6,0.35,1.95,0.8*crown,0.75*crown,0.6*crown,T2)
for x,y,s in [(2.6,3.3,0.8),(-2.8,3.0,0.75),(4.2,-0.2,0.75),(-4.0,0.0,0.7),(3.4,-8.4,0.7),(-3.0,-8.6,0.7)]:
    tree(x,y,s,"plum",0.85)
for x,y,s in [(-8.0,-6.0,1.3),(8.0,-5.6,1.3),(-8.2,1.2,1.35),(8.4,2.0,1.35),(-6.6,8.0,1.3),(6.8,8.4,1.25),(-1.6,9.6,1.1),(2.6,9.6,1.1),(-9.2,5.0,1.1),(9.2,-1.6,1.0),(6.2,-9.4,1.0)]:
    tree(x,y,s,"leaf",1.15)

def ground_at(x,y):
    z=bridge_z(x,y)
    return z if z is not None else 0.0
def terrain_at(x,y): return 0.0                   # the bridges stand over the water
INTERACT=(0.0,0.0)    # on the paving before the tower gate
STAND=(-1.2,0.0)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/dazaifu.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/dazaifu.json"
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
    objname=key if key.startswith("glow_") else "dazaifu_"+key
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
