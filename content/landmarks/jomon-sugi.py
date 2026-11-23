# Jomon Sugi (the ancient cedar of Yakushima, its knotted trunk and few limbs, the viewing deck, mossy forest) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python jomon-sugi.py
# Rebuilds content/landmarks/jomon-sugi.blend and public/models/landmarks/jomon-sugi.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/jomon-sugi.glb"
BLEND=ROOT+"/content/landmarks/jomon-sugi.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"barkpale":"8f8476","barkdk":"5e5348","bark":"6b4a3a","cedar":"2f5a3a","leaf":"4a7a42","fern":"7aa856","moss":"6b8f3e","stone":"8d8a82","wood":"8a6446"}
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
rng=random.Random(31)
EXTRA_SOLIDS=[]; NOSOLID={"cedar","fern","leaf","moss"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=9.6   # footprint half-width (the sidecar's half): a single feature, the old cedar and the deck that looks at it
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0
def water_disc(x,y): return False

def tube(mat,pts,rs,n=6):
    rings=[]
    for k,p in enumerate(pts):
        a=pts[max(k-1,0)]; b=pts[min(k+1,len(pts)-1)]
        d=Vector(b)-Vector(a); d.normalize()
        u=d.cross(Vector((0,0,1))) if abs(d.z)<0.95 else d.cross(Vector((1,0,0)))
        u.normalize(); w=d.cross(u)
        rings.append([tuple(Vector(p)+rs[k]*(math.cos(2*math.pi*i/n)*u+math.sin(2*math.pi*i/n)*w)) for i in range(n)])
    solid(rings,mat)

# ---- Jomon Sugi: a squat, monstrous trunk, knobbed and ridged and pale with age, splitting at the top into a few
# twisted limbs that hold up dark clumps of needles
TX,TY=0.4,2.6
ZR=[0.0,0.6,1.4,2.4,3.4,4.4,5.3,6.2]; RR=[2.35,2.02,1.86,1.8,1.76,1.66,1.5,1.25]
LEAN=[(0,0),(0.02,0.0),(0.05,0.03),(0.1,0.08),(0.14,0.15),(0.12,0.24),(0.06,0.3),(0.0,0.34)]
N=16; PH=[rng.uniform(0,6.28) for _ in range(3)]
def rad(k,i):
    a=2*math.pi*i/N; z=ZR[k]
    return RR[k]*(1+0.18*math.sin(3*a+PH[0]+0.5*z)+0.11*math.sin(5*a+PH[1]-0.7*z)+0.06*math.sin(7*a+PH[2]))
solid([[(TX+LEAN[k][0]+rad(k,i)*math.cos(2*math.pi*i/N),TY+LEAN[k][1]+rad(k,i)*math.sin(2*math.pi*i/N),ZR[k]-(0.3 if k==0 else 0)) for i in range(N)] for k in range(len(ZR))],"barkpale")
# the deep twisting ridges of its bark
for j in range(9):
    a0=2*math.pi*j/9+0.2; pts=[]; rs=[]
    for k in range(1,len(ZR)-1):
        a=a0+0.12*k; i=a/(2*math.pi)*N
        r=RR[k]*(1+0.18*math.sin(3*a+PH[0]+0.5*ZR[k])+0.11*math.sin(5*a+PH[1]-0.7*ZR[k])+0.06*math.sin(7*a+PH[2]))
        pts.append((TX+LEAN[k][0]+(r-0.03)*math.cos(a),TY+LEAN[k][1]+(r-0.03)*math.sin(a),ZR[k])); rs.append(0.1)
    tube("barkdk",pts,rs,5)
# burls
for k in range(16):
    a=rng.uniform(0,6.28); z=rng.uniform(0.6,5.6); kk=min(range(len(ZR)),key=lambda q:abs(ZR[q]-z)); r=RR[kk]
    ico("barkpale",TX+LEAN[kk][0]+r*math.cos(a),TY+LEAN[kk][1]+r*math.sin(a),z,rng.uniform(0.3,0.5),rng.uniform(0.3,0.5),rng.uniform(0.35,0.6))
# root buttresses fanning into the moss
for j in range(7):
    a=2*math.pi*j/7+0.4
    tube("barkpale",[(TX+1.5*math.cos(a),TY+1.5*math.sin(a),0.9),(TX+2.3*math.cos(a),TY+2.3*math.sin(a),0.3),(TX+3.1*math.cos(a+0.1),TY+3.1*math.sin(a+0.1),-0.15)],[0.45,0.32,0.14],5)
# the limbs and their needle clumps
TOP=(TX+LEAN[-1][0],TY+LEAN[-1][1],ZR[-1])
LIMBS=[((-2.4,0.5,8.6),(-1.3,0.3,7.2)),((2.3,-0.6,9.0),(1.2,-0.1,7.4)),((0.2,2.3,9.5),(0.3,1.1,7.7)),((1.1,1.0,10.0),(0.5,0.4,8.3)),((-0.9,-1.9,8.2),(-0.4,-0.9,7.0)),((-1.4,1.6,9.2),(-0.7,0.8,7.6))]
for (ex,ey,ez),(mx,my,mz) in LIMBS:
    P=[(TOP[0]+0.25*ex,TOP[1]+0.25*ey,TOP[2]-0.3),(TOP[0]+mx,TOP[1]+my,mz),(TOP[0]+ex,TOP[1]+ey,ez)]
    tube("barkpale",P,[0.62,0.4,0.18],6)
    ex2,ey2=TOP[0]+ex,TOP[1]+ey
    ico("cedar",ex2,ey2,ez+0.35,1.35,1.2,0.6); ico("cedar",ex2+0.6*ex/abs(ex+1e-3)*0.5,ey2+0.3,ez-0.2,0.9,0.85,0.45)
    ico("cedar",TOP[0]+mx*1.2,TOP[1]+my*1.2,mz+0.6,0.8,0.75,0.42)
ico("barkpale",TOP[0],TOP[1],TOP[2],1.3,1.25,0.7)
for k in range(6):                                              # moss and ferns lodged on the trunk
    a=rng.uniform(0,6.28); z=rng.uniform(1.5,5.0); kk=min(range(len(ZR)),key=lambda q:abs(ZR[q]-z))
    ico("moss",TX+LEAN[kk][0]+(RR[kk]+0.1)*math.cos(a),TY+LEAN[kk][1]+(RR[kk]+0.1)*math.sin(a),z,0.4,0.4,0.22)

# ---- the viewing deck before it, railed on three sides, and the boardwalk climbing to it from the trail
DZ=0.36
DX0,DX1,DY0,DY1=-2.6,2.6,-3.6,-1.6
box("wood",(DX0+DX1)/2,(DY0+DY1)/2,DZ-0.1,DZ,(DX1-DX0)/2,(DY1-DY0)/2)
for x in (DX0+0.15,0,DX1-0.15):
    for y in (DY0+0.15,DY1-0.15): box("wood",x,y,-0.2,DZ-0.1,0.07,0.07)
def rail(p0,p1):
    L=math.hypot(p1[0]-p0[0],p1[1]-p0[1]); n=max(1,int(L/0.9))
    for k in range(n+1):
        t=k/n; box("wood",p0[0]+(p1[0]-p0[0])*t,p0[1]+(p1[1]-p0[1])*t,DZ,DZ+0.75,0.04,0.04)
    mx,my=(p0[0]+p1[0])/2,(p0[1]+p1[1])/2
    if abs(p1[0]-p0[0])>abs(p1[1]-p0[1]): box("wood",mx,my,DZ+0.7,DZ+0.78,L/2,0.04); box("wood",mx,my,DZ+0.36,DZ+0.41,L/2,0.03)
    else: box("wood",mx,my,DZ+0.7,DZ+0.78,0.04,L/2); box("wood",mx,my,DZ+0.36,DZ+0.41,0.03,L/2)
rail((DX0+0.05,DY1-0.05),(DX1-0.05,DY1-0.05)); rail((DX1-0.05,DY0+0.05),(DX1-0.05,DY1-0.05)); rail((DX0+0.05,DY0+0.05),(DX0+0.05,DY1-0.05))
rail((DX0+1.3,DY0+0.05),(DX1-0.05,DY0+0.05))
BWX0,BWX1,BWY0=DX0,DX0+1.2,-9.0
solid([[(BWX0,BWY0,-0.12),(BWX1,BWY0,-0.12),(BWX1,BWY0,0.02),(BWX0,BWY0,0.02)],[(BWX0,DY0,DZ-0.22),(BWX1,DY0,DZ-0.22),(BWX1,DY0,DZ),(BWX0,DY0,DZ)]],"wood")
for k in range(1,6):
    y=BWY0+(DY0-BWY0)*k/6
    for x in (BWX0+0.06,BWX1-0.06): box("wood",x,y,-0.2,DZ*k/6,0.05,0.05)

# ---- the mossy cloud forest round it: younger cedars, broadleaf evergreens, ferns, boulders furred with moss
def cedar(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.32,-0.3,6),ngon(0.2,5.0,6)],"bark",T)
    for zc,r,h in ((3.2,1.35,2.2),(4.6,1.1,1.9),(5.9,0.8,1.6),(7.0,0.5,1.2)):
        cone("cedar",ngon(r,zc,7,rng.uniform(0,1)),(rng.uniform(-0.1,0.1),rng.uniform(-0.1,0.1),zc+h),T)
def shrub(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    ico("leaf",0,0,0.55,0.9,0.8,0.6,T); ico("leaf",0.5,0.2,0.4,0.6,0.55,0.4,T)
def fern(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    for k in range(5):
        a=2*math.pi*k/5; cone("fern",[(0.05*math.cos(a+1.6),0.05*math.sin(a+1.6),0.05),(-0.05*math.cos(a+1.6),-0.05*math.sin(a+1.6),0.05),(0.45*math.cos(a)-0.08*math.sin(a),0.45*math.sin(a)+0.08*math.cos(a),0.38)],(0.85*math.cos(a),0.85*math.sin(a),0.15),T)
def boulder(x,y,s):
    ico("stone",x,y,0.1*s,0.9*s,0.75*s,0.55*s); ico("moss",x+0.05,y+0.05,0.32*s,0.8*s,0.66*s,0.32*s)
for x,y,s in [(-7.4,-6.6,1.0),(-8.0,-2.2,1.05),(-7.8,2.6,1.1),(-6.2,6.9,1.0),(-2.4,8.2,1.1),(2.9,8.3,1.0),(6.6,7.0,1.1),
              (8.1,2.6,1.0),(-5.0,-8.4,0.9),(-8.1,-5.6,0.9),(0.2,8.2,1.0),(-4.6,8.3,0.95),(8.3,5.8,0.9)]:
    cedar(x,y,s)
for x,y,s in [(-4.6,4.8,1.0),(4.8,5.2,1.1),(5.4,-1.0,0.9),(-5.0,-0.4,1.0),(3.6,-6.0,0.9),(-6.0,-4.8,0.8)]:
    boulder(x,y,s)
for x,y,s in [(-3.4,7.0,1.1),(1.2,6.6,1.0),(5.8,3.0,1.0),(6.2,-4.0,1.1),(-6.6,0.8,1.0),(-4.2,-6.8,0.9),(4.4,1.6,0.9),
              (-3.8,2.0,1.0),(6.4,-8.0,0.9),(-8.4,4.6,0.9),(0.6,-6.6,0.9),(-3.0,-4.6,0.8),(4.2,-8.0,1.0),(7.4,-6.6,1.1),(8.2,-2.4,1.0),(6.0,-6.0,0.8)]:
    shrub(x,y,s)
for k in range(26):
    while True:
        x,y=rng.uniform(-8.6,8.6),rng.uniform(-8.6,8.6)
        if math.hypot(x-TX,y-TY)<3.3: continue
        if DX0-0.6<x<DX1+0.6 and DY0-0.6<y<DY1+0.6: continue
        if BWX0-0.6<x<BWX1+0.6 and y<DY0: continue
        break
    fern(x,y,rng.uniform(0.7,1.1))

def ground_at(x,y):
    if DX0<=x<=DX1 and DY0<=y<=DY1: return DZ
    if BWX0<=x<=BWX1 and BWY0<=y<=DY0: return DZ*max(0.0,(y-BWY0)/(DY0-BWY0))
    return 0.0
INTERACT=(-0.2,-2.5)   # on the deck, facing the tree
STAND=(1.0,-2.5)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/jomon-sugi.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/jomon-sugi.json"
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
    objname=key if key.startswith("glow_") else "jomon_"+key
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
