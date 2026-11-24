# Kumamoto Castle (the black great and small keeps and Uto turret on the curving musha-gaeshi stone walls) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python kumamoto-castle.py
# Rebuilds content/landmarks/kumamoto-castle.blend and public/models/landmarks/kumamoto-castle.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/kumamoto-castle.glb"
BLEND=ROOT+"/content/landmarks/kumamoto-castle.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"black":"2a2a2e","white":"f0ede6","tile":"4e5256","stone":"a39e94","joint":"6e6a63","pave":"c9c3b6","ginkgo":"d8b23a","leaf":"4f7a45","bark":"4e3a30","glow_cream":"e8dcb0"}
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
rng=random.Random(46)
EXTRA_SOLIDS=[]; NOSOLID={"leaf","ginkgo"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the honmaru with its two keeps and a turret
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0
def water_disc(x,y): return False

# ---- the honmaru on its musha-gaeshi walls: dressed stone that rises gently, then curves up to stand sheer,
# so no one could climb it (laid on the 0.8 grid so the terrain's slope stays inside the stone)
HM=2.4; HX0,HX1,HY0,HY1=-6.4,4.8,-2.4,7.2
def wring(o,z): return rect((HX1-HX0)/2+o,(HY1-HY0)/2+o,z,(HX0+HX1)/2,(HY0+HY1)/2)
# exaggerated for the game camera: a long shallow foot, then the last third standing almost sheer
WP=[(-0.05,2.15),(0.45,1.45),(0.9,0.86),(1.3,0.42),(1.6,0.16),(1.95,0.04),(HM,0.0)]
solid([wring(o,z) for z,o in WP],"stone",mt="pave")
def wo(z):
    for (z0,o0),(z1,o1) in zip(WP,WP[1:]):
        if z0<=z<=z1: return o0+(o1-o0)*(z-z0)/(z1-z0)
    return 0.0
SX0,SX1=1.6,3.2
for ci,(za,zb) in enumerate(zip([0.0,0.4,0.8,1.15,1.5,1.82,2.12],[0.4,0.8,1.15,1.5,1.82,2.12,HM-0.04])):
    oa=wo(zb)+0.012; om=wo((za+zb)/2)+0.012
    for (x0,x1) in ((HX0,SX0),(SX1,HX1)):
        box("joint",(x0+x1)/2,HY0-oa,zb-0.025,zb,(x1-x0)/2,0.012)
    box("joint",HX1+oa,(HY0+HY1)/2,zb-0.025,zb,0.012,(HY1-HY0)/2+oa)
    x=HX0+rng.uniform(0.2,0.9)
    while x<HX1-0.3:
        if not (SX0-0.3<x<SX1+0.3): box("joint",x,HY0-om,za,zb,0.012,0.012)
        x+=rng.uniform(0.7,1.4)
    y=HY0+rng.uniform(0.2,0.9)
    while y<HY1-0.3:
        box("joint",HX1+om,y,za,zb,0.012,0.012); y+=rng.uniform(0.7,1.4)
# the front corner, nearest the camera: long and short corner stones (sangi-zumi) in paler stone trace the curve,
# so the shallow foot and the sheer lip can be compared at a glance
zs=[i*HM/14 for i in range(15)]
for i,(za,zb) in enumerate(zip(zs,zs[1:])):
    o=wo((za+zb)/2)+0.02; cx,cy=HX1+o,HY0-o; lg=0.55 if i%2 else 0.3
    box("pave",cx-lg/2+0.06,cy,za+0.01,zb-0.01,lg/2,0.05)
    box("pave",cx,cy+(0.3 if i%2 else 0.55)/2-0.06,za+0.01,zb-0.01,0.05,(0.3 if i%2 else 0.55)/2)
for k in range(12):                                           # the stone stair up to the honmaru
    box("stone",(SX0+SX1)/2,HY0-2.3+0.2*k,-0.05,HM*(k+1)/12,(SX1-SX0)/2,0.1)
box("pave",0.6,-7.0,-0.04,0.03,5.4,2.4)

def rr(hx,hy,z,ox,oy,ch=0.6):
    return [(ox-hx+ch,oy-hy,z),(ox+hx-ch,oy-hy,z),(ox+hx,oy-hy+ch,z),(ox+hx,oy+hy-ch,z),
            (ox+hx-ch,oy+hy,z),(ox-hx+ch,oy+hy,z),(ox-hx,oy+hy-ch,z),(ox-hx,oy-hy+ch,z)]
def windows(cx,cy,hx,hy,z0,z1,nf,ns,mat="white"):
    zc0,zc1=z0+(z1-z0)*0.42,z0+(z1-z0)*0.42+0.22
    for k in range(nf):
        x=cx-hx+2*hx*(k+0.5)/nf; box(mat,x,cy-hy-0.02,zc0,zc1,0.1,0.03)
    for k in range(ns):
        y=cy-hy+2*hy*(k+0.5)/ns; box(mat,cx+hx+0.02,y,zc0,zc1,0.03,0.1)
def gable(cx,cy,zb,rot,w,h,depth):
    T=dict(cx=cx,cy=cy,cz=zb,rot=rot)
    extrude_y("white",[(-w,0),(w,0),(0,h)],0.1,-depth,T)
    extrude_y("tile",[(-w-0.14,-0.04),(0,h+0.13),(w+0.14,-0.04),(w-0.04,-0.04),(0,h-0.03),(-w+0.04,-0.04)],0.12,-(depth+0.1),T)
def skirt(hx,hy,z1,nhx,nhy,nz0,cx,cy,o=0.38):
    flared_roof([(hx+o,hy+o,z1,0.28),(hx+o,hy+o,z1+0.1,0.28),(hx+o*0.45,hy+o*0.45,z1+0.22,0.08),(nhx+0.05,nhy+0.05,nz0+0.02,0.0)],"tile",cx,cy)
    for sy in (-1,1): box("white",cx,cy+sy*(hy+o),z1+0.08,z1+0.13,hx+o-0.1,0.03)       # the white-mortared eaves
    for sx in (-1,1): box("white",cx+sx*(hx+o),cy,z1+0.08,z1+0.13,0.03,hy+o-0.1)
def keep(KX,KY,BASE,TIERS,top):
    bh,bw,bd=BASE
    solid([rr(bw+0.75,bd+0.75,HM-0.05,KX,KY,0.9),rr(bw+0.3,bd+0.3,HM+0.7,KX,KY,0.75),rr(bw+0.08,bd+0.08,HM+1.15,KX,KY,0.7),rr(bw,bd,HM+bh,KX,KY,0.68)],"stone")
    for i,(hx,hy,z0,z1) in enumerate(TIERS):
        box("black",KX,KY,z0-0.05,z1,hx,hy)
        box("white",KX,KY,z1-0.18,z1,hx+0.01,hy+0.01)
        windows(KX,KY,hx,hy,z0,z1-0.18,max(2,5-i),max(2,4-i))
        if i<len(TIERS)-1:
            nhx,nhy,nz0,_=TIERS[i+1]; skirt(hx,hy,z1,nhx,nhy,nz0,KX,KY)
    hx,hy,z0,z1=TIERS[-1]
    flared_roof([(hx+0.5,hy+0.45,z1,0.28),(hx+0.5,hy+0.45,z1+0.12,0.28),(hx+0.2,hy+0.15,z1+0.3,0.09),(hx*0.7,0.12,z1+0.75,0.0)],"tile",KX,KY)
    box("white",KX,KY,z1+0.7,z1+0.82,hx*0.72,0.13)
    for sx in (-1,1): extrude_y("black",[(KX+sx*hx*0.7+sx*px,z1+0.78+pz) for px,pz in [(-0.1,0.0),(0.12,0.0),(0.16,0.22),(0.05,0.42),(0.0,0.24),(-0.12,0.35)]],KY-0.06,KY+0.06)

# ---- the great keep (daitenshu) and the small keep (kotenshu) beside it, black-boarded with white gables
KX,KY=-1.4,3.4; BT=HM+1.3
keep(KX,KY,(1.3,2.5,2.2),[(2.25,1.95,BT,BT+1.9),(1.85,1.55,BT+2.2,BT+3.5),(1.3,1.1,BT+3.8,BT+4.8)],True)
for sx in (-1,1): gable(KX+sx*1.0,KY-1.95,BT+1.95,0,0.8,0.7,0.6)
gable(KX+2.25,KY,BT+1.95,math.pi/2,1.1,0.85,0.6)
gable(KX,KY-1.55,BT+3.55,0,0.9,0.7,0.55); gable(KX+1.85,KY,BT+3.55,math.pi/2,0.7,0.6,0.5)
QX,QY=2.6,2.6; BQ=HM+1.1
keep(QX,QY,(1.1,1.5,1.3),[(1.35,1.15,BQ,BQ+1.5),(1.0,0.85,BQ+1.8,BQ+2.8)],True)
gable(QX,QY-1.15,BQ+1.55,0,0.75,0.6,0.5); gable(QX+1.35,QY,BQ+1.55,math.pi/2,0.6,0.5,0.5)
box("black",(KX+QX)/2+0.6,(KY+QY)/2,HM,HM+1.6,1.0,0.6)          # the passage between them
for k in range(3): box("glow_keep_%d"%k,KX-0.8+0.8*k,KY-1.11,BT+4.15,BT+4.4,0.15,0.01)

# ---- Uto turret at the honmaru's west corner, three black storeys of its own
UX,UY=-4.8,0.2
keep(UX,UY,(0.0,1.2,1.0),[(1.2,1.0,HM,HM+1.3),(0.95,0.8,HM+1.55,HM+2.6),(0.72,0.6,HM+2.85,HM+3.7)],False)
gable(UX,UY-1.0,HM+1.35,0,0.6,0.5,0.45)

# ---- ginkgo and camphor trees below the walls and on the honmaru
def tree(x,y,s,m,z0=0.0):
    T=dict(cx=x,cy=y,cz=z0,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.17,-0.3,5),ngon(0.11,2.0,5)],"bark",T)
    ico(m,0,0,2.6,1.25,1.15,1.15,T); ico(m,0.6,0.35,2.1,0.8,0.75,0.7,T)
for x,y,s,m in [(-8.4,-4.0,1.0,"ginkgo"),(-4.0,-6.6,1.0,"leaf"),(8.9,-4.4,1.05,"ginkgo"),(8.0,-1.0,1.0,"leaf"),(8.2,4.0,1.0,"leaf"),(6.8,8.6,0.95,"leaf"),
                (-8.6,2.4,1.0,"leaf"),(-8.8,7.4,0.95,"leaf"),(-3.4,9.4,0.9,"leaf"),(1.6,9.4,0.95,"ginkgo"),(-8.2,-8.6,0.9,"leaf"),(4.4,-8.8,0.85,"leaf")]:
    tree(x,y,s,m)
for x,y,s in [(-5.6,5.6,0.8),(3.8,6.0,0.8),(4.0,-1.4,0.75)]:
    tree(x,y,s,"leaf",HM)

def ground_at(x,y):
    if HX0-0.05<=x<=HX1+0.05 and HY0-0.05<=y<=HY1+0.05: return HM
    if SX0<=x<=SX1 and HY0-2.45<=y<HY0: return HM*(y-(HY0-2.4))/2.4
    return 0.0
def terrain_at(x,y):
    # the game samples the terrain on 1-unit tiles: on the honmaru it sits under the paving, low enough that the
    # slope from its edge down to the lawn runs inside the curving wall instead of out through its face
    if HX0-0.05<=x<=HX1+0.05 and HY0-0.05<=y<=HY1+0.05: return HM-0.6
    return ground_at(x,y)
INTERACT=(2.4,-1.5)   # at the head of the stair, the keeps above
STAND=(2.4,-5.8)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/kumamoto-castle.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/kumamoto-castle.json"
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
    objname=key if key.startswith("glow_") else "kumamoto_"+key
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
