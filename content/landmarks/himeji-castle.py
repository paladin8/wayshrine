# Himeji Castle (the White Heron) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python himeji-castle.py
# Rebuilds content/landmarks/himeji-castle.blend and public/models/landmarks/himeji-castle.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/himeji-castle.glb"
BLEND=ROOT+"/content/landmarks/himeji-castle.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"snow":"f1f4f6","tile":"737881","stone":"a39e98","darkstone":"7f7a74","gold":"e2b34c","roof":"2a2424","cream":"e8dcb0","foliage":"5f9a52","blossom":"f2b6c4","wood":"d1ab80","glow_cream":"e8dcb0"}
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
rng=random.Random(5)
H=lambda x,y: 0.0   # flat grounds; the game's terrain draws the grass (terrainSurface)
EXTRA_SOLIDS=[]

def rr(hx,hy,z,ox,oy,ch=0.8):
    return [(ox-hx+ch,oy-hy,z),(ox+hx-ch,oy-hy,z),(ox+hx,oy-hy+ch,z),(ox+hx,oy+hy-ch,z),
            (ox+hx-ch,oy+hy,z),(ox-hx+ch,oy+hy,z),(ox-hx,oy+hy-ch,z),(ox-hx,oy-hy+ch,z)]
def windows(cx,cy,hx,hy,z0,z1,nf,ns):
    # small dark windows on the faces the game camera sees (front -y, right +x)
    zc0,zc1=z0+(z1-z0)*0.38,z0+(z1-z0)*0.38+0.24
    for k in range(nf):
        x=cx-hx+2*hx*(k+0.5)/nf; box("roof",x,cy-hy-0.02,zc0,zc1,0.1,0.03)
    for k in range(ns):
        y=cy-hy+2*hy*(k+0.5)/ns; box("roof",cx+hx+0.02,y,zc0,zc1,0.03,0.1)
def gable(cx,cy,zb,rot,w,h,depth):
    # triangular "plover" gable (chidori-hafu): white plaster face under a grey bargeboard
    T=dict(cx=cx,cy=cy,cz=zb,rot=rot)
    extrude_y("snow",[(-w,0),(w,0),(0,h)],0.1,-depth,T)
    extrude_y("tile",[(-w-0.14,-0.04),(0,h+0.13),(w+0.14,-0.04),(w-0.04,-0.04),(0,h-0.03),(-w+0.04,-0.04)],0.12,-(depth+0.1),T)
def kara(cx,cy,zb,rot,w,h,depth):
    # undulating curved gable (kara-hafu)
    T=dict(cx=cx,cy=cy,cz=zb,rot=rot)
    lo=[(-w,0),(-0.6*w,0.25*h),(-0.25*w,0.75*h),(0,0.85*h),(0.25*w,0.75*h),(0.6*w,0.25*h),(w,0)]
    extrude_y("snow",lo,0.1,-depth,T)
    hi=[(w+0.16,-0.06),(0.62*w,0.25*h+0.14),(0.25*w,0.75*h+0.14),(0,0.85*h+0.15),(-0.25*w,0.75*h+0.14),(-0.62*w,0.25*h+0.14),(-w-0.16,-0.06)]
    extrude_y("tile",[(x,z) for x,z in lo]+hi,0.12,-(depth+0.1),T)
def shachi(cx,cy,z,axis_x=True):
    prof=[(-0.1,0.0),(0.12,0.0),(0.16,0.2),(0.05,0.4),(0.0,0.22),(-0.12,0.33)]
    if axis_x:
        for sx in (-1,1): extrude_y("gold",[(cx+sx*(0.0)+sx*0+px*sx,z+pz) for px,pz in prof],cy-0.06,cy+0.06)
def ridge_shachi(cx,cy,hx,z):
    for sx in (-1,1):
        extrude_y("gold",[(cx+sx*hx+sx*px,z+pz) for px,pz in [(-0.1,0.0),(0.12,0.0),(0.16,0.2),(0.05,0.4),(0.0,0.22),(-0.12,0.33)]],cy-0.06,cy+0.06)
def skirt(hx,hy,z1,nhx,nhy,nz0,cx,cy,o=0.45):
    # shallow eaves, so the white walls show from the game camera
    flared_roof([(hx+o,hy+o,z1,0.25),(hx+o,hy+o,z1+0.1,0.25),(hx+o*0.45,hy+o*0.45,z1+0.22,0.08),(nhx+0.05,nhy+0.05,nz0+0.02,0.0)],"tile",cx,cy)

# ---- curved stone base (ishigaki), its slope steepening toward the top
BX,BY=-0.5,2.0; BASE_TOP=1.85
BASE_RINGS=[(5.8,5.2,-0.05,1.2),(5.35,4.75,0.75,1.0),(5.0,4.4,1.4,0.85),(4.8,4.2,BASE_TOP,0.8)]
solid([rr(hx,hy,z,BX,BY,ch) for hx,hy,z,ch in BASE_RINGS],"darkstone")   # core: shows as mortar between the blocks
def base_ring(z):
    for (hx0,hy0,z0,c0),(hx1,hy1,z1,c1) in zip(BASE_RINGS,BASE_RINGS[1:]):
        if z0<=z<=z1+1e-9:
            t=(z-z0)/(z1-z0)
            return rr(hx0+(hx1-hx0)*t,hy0+(hy1-hy0)*t,z,BX,BY,c0+(c1-c0)*t)
# dressed stone blocks laid in staggered courses over the core, each standing slightly proud of it
COURSES=[0.0,0.36,0.72,1.04,1.34,1.6,BASE_TOP]
GAP=0.045
def lerp(a,b,t): return tuple(a[i]+(b[i]-a[i])*t for i in range(3))
for ci,(za,zb) in enumerate(zip(COURSES,COURSES[1:])):
    lo,hi=base_ring(za+GAP/2),base_ring(zb-GAP/2)
    for e in range(8):
        P0,P1=lo[e],lo[(e+1)%8]; Q0,Q1=hi[e],hi[(e+1)%8]
        ex,ey=P1[0]-P0[0],P1[1]-P0[1]; L=math.hypot(ex,ey); nx,ny=ey/L,-ex/L
        cuts=[0.0]; s=(rng.uniform(0.3,0.9) if ci%2 else 0.0)   # stagger the joints course to course
        while True:
            s+=rng.uniform(0.9,1.6)
            if s>=L-0.4: break
            cuts.append(s)
        cuts.append(L)
        for s0,s1 in zip(cuts,cuts[1:]):
            t0,t1=(s0+GAP/2)/L,(s1-GAP/2)/L
            if t1<=t0: continue
            A0,A1,B1,B0=lerp(P0,P1,t0),lerp(P0,P1,t1),lerp(Q0,Q1,t1),lerp(Q0,Q1,t0)
            dd=rng.uniform(0.03,0.08)
            inner=[A0,A1,B1,B0]; outer=[(p[0]+nx*dd,p[1]+ny*dd,p[2]) for p in inner]
            solid([inner,outer],"stone")

# ---- main keep (daitenshu): five tiers of white walls under grey roofs, gables layered up the front
KX,KY=1.2,0.4
TIERS=[(2.2,1.8,1.85,3.1),(1.95,1.6,3.4,4.4),(1.7,1.4,4.7,5.6),(1.48,1.2,5.9,6.7),(1.28,1.02,7.0,7.7)]
for i,(hx,hy,z0,z1) in enumerate(TIERS):
    box("snow",KX,KY,z0-0.05,z1,hx,hy)
    windows(KX,KY,hx,hy,z0,z1,max(2,5-i),max(2,4-i))
    if i<4:
        nhx,nhy,nz0,_=TIERS[i+1]; skirt(hx,hy,z1,nhx,nhy,nz0,KX,KY)
flared_roof([(1.72,1.46,7.7,0.28),(1.72,1.46,7.82,0.28),(1.42,1.16,8.0,0.09),(1.0,0.12,8.4,0.0)],"tile",KX,KY)
box("tile",KX,KY,8.36,8.5,1.06,0.14)
ridge_shachi(KX,KY,1.04,8.45)
T1,T2,T3,T4=TIERS[0],TIERS[1],TIERS[2],TIERS[3]
gable(KX,KY-T1[1],T1[3]+0.05,0,0.95,0.8,0.55); gable(KX+T1[0],KY,T1[3]+0.05,math.pi/2,0.85,0.75,0.55)
for sx in (-1,1): gable(KX+sx*0.85,KY-T2[1],T2[3]+0.05,0,0.48,0.5,0.52)
gable(KX+T2[0],KY,T2[3]+0.05,math.pi/2,0.55,0.55,0.52)
kara(KX,KY-T3[1],T3[3]+0.05,0,0.7,0.5,0.5); kara(KX+T3[0],KY,T3[3]+0.05,math.pi/2,0.55,0.45,0.5)
gable(KX,KY-T4[1],T4[3]+0.05,0,0.5,0.45,0.48)

# ---- the three small keeps (west, northwest, east) and the roofed passages linking them
def small_keep(cx,cy):
    tiers=[(1.3,1.1,1.85,2.85),(1.1,0.95,3.15,3.95),(0.9,0.78,4.25,4.85)]
    for i,(hx,hy,z0,z1) in enumerate(tiers):
        box("snow",cx,cy,z0-0.05,z1,hx,hy)
        windows(cx,cy,hx,hy,z0,z1,3-i//2,2)
        if i<2:
            nhx,nhy,nz0,_=tiers[i+1]; skirt(hx,hy,z1,nhx,nhy,nz0,cx,cy,0.38)
    flared_roof([(1.3,1.16,4.85,0.22),(1.3,1.16,4.96,0.22),(1.02,0.9,5.12,0.08),(0.72,0.1,5.5,0.0)],"tile",cx,cy)
    box("tile",cx,cy,5.45,5.57,0.78,0.12)
    ridge_shachi(cx,cy,0.76,5.52)
    gable(cx,cy-1.1,2.9,0,0.6,0.5,0.45); gable(cx+1.3,cy,2.9,math.pi/2,0.55,0.48,0.45)
small_keep(-3.4,1.4); small_keep(-3.2,4.6); small_keep(2.4,4.4)
def watari(x0,y0,x1,y1):
    cx,cy=(x0+x1)/2,(y0+y1)/2
    if abs(y1-y0)<1e-6:
        L=abs(x1-x0)/2; box("snow",cx,cy,1.8,2.9,L,0.5); windows(cx,cy,L,0.5,1.8,2.9,max(1,round(L)),0)
        flared_roof([(L+0.3,0.85,2.9,0.12),(L+0.3,0.85,3.0,0.12),(L+0.1,0.55,3.15,0.04),(max(0.1,L-0.25),0.08,3.45,0.0)],"tile",cx,cy)
    else:
        L=abs(y1-y0)/2; box("snow",cx,cy,1.8,2.9,0.5,L); windows(cx,cy,0.5,L,1.8,2.9,0,max(1,round(L)))
        flared_roof([(0.85,L+0.3,2.9,0.12),(0.85,L+0.3,3.0,0.12),(0.55,L+0.1,3.15,0.04),(0.08,max(0.1,L-0.25),3.45,0.0)],"tile",cx,cy)
watari(-2.1,1.0,-1.0,1.0); watari(-3.3,2.5,-3.3,3.5); watari(-1.9,4.6,1.1,4.6); watari(2.4,2.2,2.4,3.3)

# ---- the approach: a gatehouse with hanging lanterns, plastered walls, and a gravel path
GX,GY=-5.2,-6.4
for sx in (-1,1): box("snow",GX+sx*1.05,GY,0.0,1.6,0.35,0.6)
box("wood",GX,GY,1.45,1.6,1.1,0.55)
box("snow",GX,GY,1.6,2.5,1.5,0.75); windows(GX,GY,1.5,0.75,1.6,2.5,3,1)
flared_roof([(1.95,1.15,2.5,0.18),(1.95,1.15,2.62,0.18),(1.65,0.85,2.78,0.06),(1.2,0.1,3.15,0.0)],"tile",GX,GY)
for sx in (-1,1):
    box("glow_lantern_%d"%(1 if sx<0 else 2),GX+sx*0.62,GY-0.75,1.1,1.42,0.11,0.11)
    box("roof",GX+sx*0.62,GY-0.75,1.42,1.6,0.04,0.04)
def dobei(x0,x1,y):
    L=abs(x1-x0)/2; cx=(x0+x1)/2
    box("snow",cx,y,0.0,1.05,L,0.17)
    extrude_x("tile",[(y-0.32,1.0),(y+0.32,1.0),(y+0.32,1.08),(y,1.3),(y-0.32,1.08)],cx-L-0.05,cx+L+0.05)
dobei(-8.6,-6.6,GY); dobei(-3.8,-1.6,GY)
box("cream",GX,-8.0,-0.02,0.03,0.85,1.6)
box("cream",GX,GY,-0.02,0.03,0.85,0.75)
for k in range(6):
    t=k/5; x=GX+0.9+(-1.8-GX-0.9)*t; y=GY+0.9+(-3.6-GY-0.9)*t
    box("cream",x,y,-0.02,0.03,0.75,0.6,dict(rot=-0.75))

# ---- grounds: cherry trees in blossom on the lawn, pines behind
def conifer(cx,cy,s,ph=0):
    g=H(cx,cy); T=dict(cx=cx,cy=cy,cz=g,s=s)
    prism("wood",0,0,-0.3,0.9,0.2,0.18,6,ph,T)
    cone("foliage",ngon(1.15,0.7,7,ph),(0,0,2.3),T)
    cone("foliage",ngon(0.9,1.6,7,ph+0.4),(0,0,3.1),T)
    cone("foliage",ngon(0.62,2.4,7,ph+0.8),(0,0,3.85),T)
def roundtree(cx,cy,s):
    g=H(cx,cy); T=dict(cx=cx,cy=cy,cz=g,s=s)
    prism("wood",0,0,-0.3,1.3,0.22,0.18,6,0,T)
    ico("foliage",0,0,2.15,1.25,1.25,1.05,T)
    ico("foliage",0.55,-0.35,1.6,0.8,0.8,0.65,T)
def bush(cx,cy,s):
    ico("foliage",0,0,0.3,0.75,0.75,0.55,dict(cx=cx,cy=cy,cz=H(cx,cy),s=s))
def sakura(cx,cy,s):
    T=dict(cx=cx,cy=cy,s=s)
    solid([ngon(0.17,-0.3,6),ngon(0.13,1.0,6,0,0.15,0),ngon(0.09,1.5,6,0,0.05,0.1)],"wood",T)
    ico("blossom",0,0,1.95,1.25,1.15,0.85,T)
    ico("blossom",0.65,0.35,1.55,0.75,0.7,0.55,T)
    ico("blossom",-0.6,-0.3,1.6,0.7,0.65,0.5,T)
for a in [(4.8,-5.6,1.0),(7.4,-1.0,0.95),(-1.8,-7.4,0.9),(-7.8,-3.0,1.0),(-7.4,2.6,0.9),(6.8,6.4,0.95),(-6.6,7.6,0.9)]: sakura(*a)
for a in [(0.4,8.6,0.95,0.2),(3.6,8.4,0.9,0.6),(-3.0,8.4,0.95,0.4)]: conifer(*a)
for a in [(8.4,3.4,0.85)]: roundtree(*a)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/himeji-castle.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=9.6; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y): return 0.0     # flat grounds; the stone base is solid, not walkable
ground=[[0.0 for ix in range(GN)] for iz in range(GN)]
CELL=0.3
solid_cells=set()
BAND0,BAND1=0.35,1.6
for key,(bv,bf) in B.items():
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
                    if z<BAND0 or z>BAND1: continue
                    if nz>0.92 and z<0.6: continue
                    solid_cells.add((int((x+HALF)/CELL),int((y+HALF)/CELL)))
solids=[[round(-HALF+CELL*(cx+0.5),2), round(-(-HALF+CELL*(cy+0.5)),2), 0.22] for cx,cy in sorted(solid_cells)]
solids+=[[round(x,2),round(-y,2),r] for x,y,r in EXTRA_SOLIDS]
INTERACT=(0.5,-5.0)   # the lawn in front of the keep
STAND=(2.0,-8.6)      # the front edge of the lawn
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]],"terrainSurface":True}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/himeji-castle.json"
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
    objname=key if key.startswith("glow_") else "himeji_"+key
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
res={"tris":sum(stats.values()),"per_obj":stats,"materials":len(bpy.data.materials),"min":[round(v,3) for v in mn],"max":[round(v,3) for v in mx],"glb_bytes":os.path.getsize(GLB)}
json.dump(res,open("/tmp/lm_build.json","w"))
