# Osaka Castle (the keep on its tenshu-dai, the honmaru walls rising from the moat, the causeway and Sakuramon, a corner turret, cherry trees) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python osaka-castle.py
# Rebuilds content/landmarks/osaka-castle.blend and public/models/landmarks/osaka-castle.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/osaka-castle.glb"
BLEND=ROOT+"/content/landmarks/osaka-castle.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"white":"f0ede6","roof":"6f9a8a","gold":"d9b04a","black":"2a2a2e","stone":"a39e94","joint":"6e6a63","water":"4f7d86","pave":"c9c3b6","foliage":"4f7a45","blossom":"efc2cf","bark":"5a4034","glow_cream":"e8dcb0"}
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
rng=random.Random(29)
EXTRA_SOLIDS=[]; NOSOLID={"foliage","blossom"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the honmaru with its keep, moat and gate
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0

# ---- the plan, laid on the 0.8 grid so the terrain's slopes hide inside the stone walls: the honmaru, raised on its
# great battered walls, with an L of moat along its south and east sides and the causeway up to the Sakuramon
HM=1.6                                     # honmaru top
HX0,HX1,HY0,HY1=-7.2,4.0,-1.6,8.0          # honmaru, inclusive grid rect
MS=(-8.8,7.6,-5.6,-2.4); ME=(4.8,7.6,-5.6,9.6)   # south and east moats
WZ=-0.35; MZ=-0.6                          # water surface, moat floor
CX0,CX1=-2.4,0.0                           # the causeway's cells
def inr(x,y,r,e=0.05): return r[0]-e<=x<=r[1]+e and r[2]-e<=y<=r[3]+e
def in_moat(x,y): return inr(x,y,MS) or inr(x,y,ME)
def on_causeway(x,y): return CX0-0.05<=x<=CX1+0.05 and -6.45<=y<=HY0+0.05
def ramp(y): return HM*max(0.0,min(1.0,(y+6.4)/(6.4+HY0)))
def water_disc(x,y): return in_moat(x,y) and not (CX0-0.7<=x<=CX1+0.7)

# ---- moat water and the stone revetments of its outer banks
box("water",(MS[0]-0.5+MS[1]+0.45)/2,(MS[2]-0.45+MS[3]+0.45)/2,WZ-0.02,WZ,(MS[1]+0.45-MS[0]+0.5)/2,(MS[3]-MS[2]+0.9)/2)
box("water",(ME[0]-0.45+ME[1]+0.45)/2,(ME[2]-0.45+ME[3]+0.45)/2,WZ-0.02,WZ,(ME[1]-ME[0]+0.9)/2,(ME[3]-ME[2]+0.9)/2)
extrude_x("stone",[(MS[2]-1.0,MZ-0.05),(MS[2],MZ-0.05),(MS[2]-0.8,0.05),(MS[2]-1.0,0.05)],MS[0]-0.8,ME[1]+0.8)       # south bank
extrude_y("stone",[(ME[1]+1.0,MZ-0.05),(ME[1],MZ-0.05),(ME[1]+0.8,0.05),(ME[1]+1.0,0.05)],MS[2]-0.8,ME[3]+0.8)       # east bank
extrude_x("stone",[(ME[3]+1.0,MZ-0.05),(ME[3],MZ-0.05),(ME[3]+0.8,0.05),(ME[3]+1.0,0.05)],HX1,ME[1]+0.8)           # north end of the east moat
extrude_y("stone",[(MS[0]-1.0,MZ-0.05),(MS[0],MZ-0.05),(MS[0]-0.8,0.05),(MS[0]-1.0,0.05)],MS[2]-0.8,HY0)            # west end of the south moat
extrude_x("stone",[(HY0+0.2,MZ-0.05),(MS[3],MZ-0.05),(HY0,0.05),(HY0+0.2,0.05)],MS[0]-0.8,HX0-0.8)                 # its north bank, west of the honmaru

# ---- the honmaru walls: dressed stone curving up out of the moat, steepening toward the top; the top is gravel
def wring(o,z): return rect((HX1-HX0)/2+o,(HY1-HY0)/2+o,z,(HX0+HX1)/2,(HY0+HY1)/2)
solid([wring(0.8,MZ-0.05),wring(0.42,0.5),wring(0.12,1.2),wring(0.0,HM)],"stone",mt="pave")
# the great blocks: dark joints in staggered courses on the faces the camera sees (south and east)
WP=[(MZ-0.05,0.8),(0.5,0.42),(1.2,0.12),(HM,0.0)]
def wo(z):
    for (z0,o0),(z1,o1) in zip(WP,WP[1:]):
        if z0<=z<=z1: return o0+(o1-o0)*(z-z0)/(z1-z0)
    return 0.0
CZ=[WZ,0.05,0.45,0.85,1.22,HM-0.04]
for ci,(za,zb) in enumerate(zip(CZ,CZ[1:])):
    oa=wo(zb)+0.012
    box("joint",(HX0+HX1)/2+(oa)/2,HY0-oa,zb-0.025,zb+0.0,(HX1-HX0)/2+oa/2,0.012)
    box("joint",HX1+oa,(HY0+HY1)/2,zb-0.025,zb+0.0,0.012,(HY1-HY0)/2+oa)
    om=wo((za+zb)/2)+0.012
    x=HX0+rng.uniform(0.2,0.9)
    while x<HX1-0.3:
        if not (CX0-0.9<x<CX1+0.9): box("joint",x,HY0-om,za,zb,0.012,0.012)
        x+=rng.uniform(0.7,1.5)
    y=HY0+rng.uniform(0.2,0.9)
    while y<HY1-0.3:
        box("joint",HX1+om,y,za,zb,0.012,0.012); y+=rng.uniform(0.7,1.5)

# ---- the causeway (dobashi) across the south moat, rising to the gate
cx0,cx1=CX0-0.1,CX1+0.1
solid([[(cx0-0.8,-6.5,MZ-0.05),(cx1+0.8,-6.5,MZ-0.05),(cx1,-6.5,0.03),(cx0,-6.5,0.03)],
       [(cx0-0.8,HY0+0.6,MZ-0.05),(cx1+0.8,HY0+0.6,MZ-0.05),(cx1,HY0+0.6,HM+0.03),(cx0,HY0+0.6,HM+0.03)]],"stone")
solid([[(cx0+0.15,-6.5,0.03),(cx1-0.15,-6.5,0.03),(cx1-0.15,-6.5,0.07),(cx0+0.15,-6.5,0.07)],
       [(cx0+0.15,HY0,HM+0.03),(cx1-0.15,HY0,HM+0.03),(cx1-0.15,HY0,HM+0.07),(cx0+0.15,HY0,HM+0.07)]],"pave")

# ---- the Sakuramon at the head of the causeway, and white roofed walls (dobei) along the honmaru's south edge
GX,GYY=(CX0+CX1)/2,HY0+0.55
for sx in (-1,1):
    box("black",GX+sx*0.95,GYY,HM,HM+2.05,0.13,0.13); box("black",GX+sx*0.95,GYY+0.45,HM,HM+0.9,0.08,0.08)
    box("black",GX+sx*0.95,GYY-0.14,HM+0.2,HM+1.6,0.15,0.01)
    prism("stone",GX+sx*1.55,GYY-0.5,HM,HM+0.5,0.12,0.09,6); box("stone",GX+sx*1.55,GYY-0.5,HM+0.5,HM+0.55,0.18,0.18)
    box("glow_lantern_%d"%(sx+1),GX+sx*1.55,GYY-0.5,HM+0.55,HM+0.78,0.12,0.12); flared_roof([(0.24,0.24,HM+0.78,0.04),(0.24,0.24,HM+0.82,0.04),(0.03,0.03,HM+1.0,0.0)],"stone",GX+sx*1.55,GYY-0.5)
box("black",GX,GYY,HM+1.85,HM+2.0,1.25,0.1)
flared_roof([(1.5,0.45,HM+2.05,0.12),(1.5,0.45,HM+2.13,0.12),(1.1,0.08,HM+2.4,0.0)],"roof",GX,GYY)
box("gold",GX,GYY-0.12,HM+1.88,HM+1.97,0.18,0.01)
def dobei(x0,x1,y):
    box("white",(x0+x1)/2,y,HM,HM+0.75,(x1-x0)/2,0.1)
    flared_roof([((x1-x0)/2+0.12,0.26,HM+0.75,0.04),((x1-x0)/2+0.12,0.26,HM+0.8,0.04),((x1-x0)/2+0.05,0.04,HM+0.98,0.0)],"roof",(x0+x1)/2,y)
dobei(HX0+0.2,GX-1.1,HY0+0.25); dobei(GX+1.1,1.1,HY0+0.25)

# ---- the main keep: white walls, verdigris roofs, gilded gables, its top storey black with golden tigers and cranes,
# all on the tall stone tenshu-dai
def rr(hx,hy,z,ox,oy,ch=0.6):
    return [(ox-hx+ch,oy-hy,z),(ox+hx-ch,oy-hy,z),(ox+hx,oy-hy+ch,z),(ox+hx,oy+hy-ch,z),
            (ox+hx-ch,oy+hy,z),(ox-hx+ch,oy+hy,z),(ox-hx,oy+hy-ch,z),(ox-hx,oy-hy+ch,z)]
def windows(cx,cy,hx,hy,z0,z1,nf,ns,mat="black"):
    zc0,zc1=z0+(z1-z0)*0.4,z0+(z1-z0)*0.4+0.26
    for k in range(nf):
        x=cx-hx+2*hx*(k+0.5)/nf; box(mat,x,cy-hy-0.02,zc0,zc1,0.11,0.03)
    for k in range(ns):
        y=cy-hy+2*hy*(k+0.5)/ns; box(mat,cx+hx+0.02,y,zc0,zc1,0.03,0.11)
def gable(cx,cy,zb,rot,w,h,depth):
    T=dict(cx=cx,cy=cy,cz=zb,rot=rot)
    extrude_y("white",[(-w,0),(w,0),(0,h)],0.1,-depth,T)
    extrude_y("roof",[(-w-0.14,-0.04),(0,h+0.13),(w+0.14,-0.04),(w-0.04,-0.04),(0,h-0.03),(-w+0.04,-0.04)],0.12,-(depth+0.1),T)
    extrude_y("gold",[(-0.09,h-0.28),(0.09,h-0.28),(0.0,h-0.05)],-(depth+0.11),-(depth+0.14),T)   # the gilt gegyo at the apex
def kara(cx,cy,zb,rot,w,h,depth):
    T=dict(cx=cx,cy=cy,cz=zb,rot=rot)
    lo=[(-w,0),(-0.6*w,0.25*h),(-0.25*w,0.75*h),(0,0.85*h),(0.25*w,0.75*h),(0.6*w,0.25*h),(w,0)]
    extrude_y("white",lo,0.1,-depth,T)
    hi=[(w+0.16,-0.06),(0.62*w,0.25*h+0.14),(0.25*w,0.75*h+0.14),(0,0.85*h+0.15),(-0.25*w,0.75*h+0.14),(-0.62*w,0.25*h+0.14),(-w-0.16,-0.06)]
    extrude_y("roof",[(x,z) for x,z in lo]+hi,0.12,-(depth+0.1),T)
    extrude_y("gold",[(-0.5*w,0.05),(0.5*w,0.05),(0.3*w,0.45*h),(-0.3*w,0.45*h)],-(depth+0.11),-(depth+0.13),T)
def skirt(hx,hy,z1,nhx,nhy,nz0,cx,cy,o=0.45):
    flared_roof([(hx+o,hy+o,z1,0.25),(hx+o,hy+o,z1+0.1,0.25),(hx+o*0.45,hy+o*0.45,z1+0.22,0.08),(nhx+0.05,nhy+0.05,nz0+0.02,0.0)],"roof",cx,cy)

KX,KY=GX,4.2
BT=HM+1.75
solid([rr(3.1,2.75,HM-0.05,KX,KY,0.8),rr(2.78,2.43,HM+1.0,KX,KY,0.72),rr(2.62,2.28,BT,KX,KY,0.68)],"stone")
TIERS=[(2.3,1.98,BT,BT+1.3),(2.02,1.74,BT+1.6,BT+2.6),(1.76,1.5,BT+2.9,BT+3.8),(1.5,1.28,BT+4.1,BT+4.9),(1.26,1.06,BT+5.2,BT+6.0)]
for i,(hx,hy,z0,z1) in enumerate(TIERS):
    if i<4:
        box("white",KX,KY,z0-0.05,z1,hx,hy)
        windows(KX,KY,hx,hy,z0,z1,max(3,6-i),max(3,5-i))
        nhx,nhy,nz0,_=TIERS[i+1]; skirt(hx,hy,z1,nhx,nhy,nz0,KX,KY)
    else:                                   # the black top storey, gold band and gilt tigers and cranes on its walls
        box("black",KX,KY,z0-0.05,z1,hx,hy)
        box("gold",KX,KY,z1-0.14,z1-0.06,hx+0.01,hy+0.01)
        for k in range(3):
            box("gold",KX-hx+2*hx*(k+0.5)/3,KY-hy-0.02,z0+0.18,z0+0.4,0.2,0.02)
            box("gold",KX+hx+0.02,KY-hy+2*hy*(k+0.5)/3,z0+0.18,z0+0.4,0.02,0.2)
        windows(KX,KY,hx,hy,z0+0.1,z1,3,3,"glow_top")
ZR=TIERS[-1][3]
flared_roof([(1.72,1.5,ZR,0.28),(1.72,1.5,ZR+0.12,0.28),(1.42,1.2,ZR+0.3,0.09),(1.0,0.12,ZR+0.75,0.0)],"roof",KX,KY)
box("roof",KX,KY,ZR+0.7,ZR+0.84,1.06,0.14)
for sx in (-1,1):
    extrude_y("gold",[(KX+sx*1.04+sx*px,ZR+0.8+pz) for px,pz in [(-0.1,0.0),(0.12,0.0),(0.17,0.24),(0.05,0.46),(0.0,0.26),(-0.12,0.38)]],KY-0.07,KY+0.07)
T1,T2,T3,T4=TIERS[0],TIERS[1],TIERS[2],TIERS[3]
for sx in (-1,1): gable(KX+sx*1.05,KY-T1[1],T1[3]+0.05,0,0.75,0.65,0.55)
gable(KX+T1[0],KY,T1[3]+0.05,math.pi/2,0.95,0.8,0.55)
gable(KX,KY-T2[1],T2[3]+0.05,0,1.05,0.85,0.55); gable(KX+T2[0],KY,T2[3]+0.05,math.pi/2,0.6,0.55,0.52)
kara(KX,KY-T3[1],T3[3]+0.05,0,0.75,0.55,0.5); kara(KX+T3[0],KY,T3[3]+0.05,math.pi/2,0.6,0.48,0.5)
gable(KX,KY-T4[1],T4[3]+0.05,0,0.6,0.5,0.48); gable(KX+T4[0],KY,T4[3]+0.05,math.pi/2,0.5,0.45,0.48)

# ---- a two-storey corner turret (yagura) on the honmaru's south-east corner, over the moat
YX,YY=2.8,-0.55
box("white",YX,YY,HM,HM+1.0,1.0,0.75); windows(YX,YY,1.0,0.75,HM,HM+1.0,3,2)
skirt(1.0,0.75,HM+1.0,0.78,0.56,HM+1.25,YX,YY,0.35)
box("white",YX,YY,HM+1.2,HM+1.95,0.78,0.56); windows(YX,YY,0.78,0.56,HM+1.2,HM+1.95,2,2)
flared_roof([(1.15,0.92,HM+1.95,0.2),(1.15,0.92,HM+2.05,0.2),(0.9,0.62,HM+2.25,0.06),(0.6,0.08,HM+2.6,0.0)],"roof",YX,YY)
gable(YX,YY-0.75,HM+1.02,0,0.5,0.42,0.4)

# ---- pines on the honmaru, cherry trees in blossom round the moat banks
def pine(x,y,s,z0=0.0):
    T=dict(cx=x,cy=y,cz=z0,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.15,-0.3,5),ngon(0.1,1.9,5,0,0.15,0)],"bark",T)
    for zc,r,dx in ((2.1,1.0,0.15),(1.6,0.75,-0.35),(2.6,0.6,0.3)): ico("foliage",dx,0.1,zc,r,r*0.9,r*0.42,T)
def cherry(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.14,-0.3,5),ngon(0.09,1.1,5,0,0.1,0)],"bark",T)
    ico("blossom",0,0,1.75,1.05,1.0,0.75,T); ico("blossom",0.55,0.3,1.4,0.6,0.55,0.45,T)
for x,y,s in [(-5.6,0.6,0.9),(-6.0,4.4,1.0),(-5.4,7.2,0.95),(2.9,6.9,0.95),(3.1,2.4,0.85),(-3.6,-0.4,0.8)]:
    pine(x,y,s,HM)
for x,y,s in [(-8.6,-8.0,0.9),(-5.2,-7.9,0.95),(2.4,-8.0,0.9),(5.6,-8.2,0.95),(9.2,-7.8,0.85),(9.6,-3.0,0.9),(9.6,2.0,0.9),
              (9.6,6.6,0.85),(-9.8,1.6,0.9),(-9.8,5.6,0.9),(-6.4,9.8,0.9),(-2.4,9.8,0.95),(1.6,9.8,0.9),(-9.8,9.6,0.8)]:
    cherry(x,y,s)

def ground_at(x,y):
    if on_causeway(x,y): return ramp(y)
    if in_moat(x,y): return MZ
    if HX0-0.05<=x<=HX1+0.05 and HY0-0.05<=y<=HY1+0.05: return HM
    return 0.0
INTERACT=(GX,0.4)     # the honmaru court before the keep
STAND=(GX+1.9,0.5)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/osaka-castle.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/osaka-castle.json"
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
    objname=key if key.startswith("glow_") else "osaka_"+key
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
