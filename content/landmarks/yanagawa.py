# Yanagawa (a moat-canal round the Tachibana villa, punts poled under low bridges, willows, storehouses) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python yanagawa.py
# Rebuilds content/landmarks/yanagawa.blend and public/models/landmarks/yanagawa.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/yanagawa.glb"
BLEND=ROOT+"/content/landmarks/yanagawa.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"water":"4f6e66","stone":"8f8b84","pave":"c2bcb0","plaster":"eceae4","roof":"4e3628","wood":"8a6446","willow":"8fb35a","leaf":"4f6e3c","bark":"4e3a30","black":"2b2b2e","vermilion":"c8473a","glow_cream":"e8dcb0"}
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
rng=random.Random(23)
EXTRA_SOLIDS=[]
FH=11.2   # footprint half-width (the sidecar's half): the middle size, a block of canal town
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
S2=math.sqrt(0.5)
def to_xy(u,v): return (S2*(u+v),S2*(v-u))
def to_uv(x,y): return (S2*(x-y),S2*(x+y))
ROT=math.pi/4

# ---- the canal: a moat-canal (horiwari) running right round a block, between low stone banks, so the water never
# meets the footprint edge. Centreline: a rounded rectangle in (u, v).
CA,CB,CR=5.4,6.2,2.4; CW=0.95
def ring_pts(step=0.45):
    pts=[]; segs=[]
    corners=[(CA-CR,CB-CR,0.0),(-(CA-CR),CB-CR,90.0),(-(CA-CR),-(CB-CR),180.0),(CA-CR,-(CB-CR),270.0)]
    # walk: +u side going +v, corner, +v side going -u, ... (counter-clockwise in u,v)
    edges=[((CA,-(CB-CR)),(CA,CB-CR)),((CA-CR,CB),(-(CA-CR),CB)),((-CA,CB-CR),(-CA,-(CB-CR))),((-(CA-CR),-CB),(CA-CR,-CB))]
    for (e0,e1),(cu,cv,a0) in zip(edges,corners):
        L=math.dist(e0,e1); n=max(1,int(L/step))
        for k in range(n): t=k/n; pts.append((e0[0]+(e1[0]-e0[0])*t,e0[1]+(e1[1]-e0[1])*t))
        n=10
        for k in range(n): a=math.radians(a0+90*k/n); pts.append((cu+CR*math.cos(a),cv+CR*math.sin(a)))
    return pts
RP=ring_pts()
NR=len(RP)
def normals():
    out=[]
    for i in range(NR):
        a=RP[i-1]; b=RP[(i+1)%NR]; du,dv=b[0]-a[0],b[1]-a[1]; L=math.hypot(du,dv)
        out.append((dv/L,-du/L))          # outward (the loop runs counter-clockwise)
    return out
RN=normals()
if sum(RP[i][0]*RP[(i+1)%NR][1]-RP[(i+1)%NR][0]*RP[i][1] for i in range(NR))<0: RN=[(-a,-b) for a,b in RN]
def closed_band(mat,o0,o1,z0,z1):
    verts=[]; faces=[]
    for (u,v),(nu,nv) in zip(RP,RN):
        for o,z in ((o0,z0),(o1,z0),(o1,z1),(o0,z1)):
            verts.append((*to_xy(u+nu*o,v+nv*o),z))
    for i in range(NR):
        j=(i+1)%NR
        for k in range(4):
            l=(k+1)%4; faces.append([i*4+k,j*4+k,j*4+l,i*4+l])
    emit(verts,faces,[mat]*len(faces),orient=False)
    return verts
closed_band("water",-CW,CW,-0.05,0.04)
closed_band("stone",-CW-0.28,-CW,-0.05,0.3)              # the stone banks
closed_band("stone",CW,CW+0.28,-0.05,0.3)
closed_band("pave",CW+0.28,CW+1.6,-0.04,0.03)           # the promenade along the outer bank
def ring_dist(u,v):
    best=1e9; bi=0
    for i,(pu,pv) in enumerate(RP):
        d=math.hypot(u-pu,v-pv)
        if d<best: best,bi=d,i
    nu,nv=RN[bi]; side=(u-RP[bi][0])*nu+(v-RP[bi][1])*nv
    return best,side,bi
def in_water(x,y,pad=0.0):
    u,v=to_uv(x,y); d,side,_=ring_dist(u,v)
    return abs(side)<CW+pad and d<CW+pad+0.3

# ---- bridges: two low stone-and-timber bridges over the canal, so low the boat passengers must duck
BRIDGES=[]; ARCH=0.5
def bridge(i,red=False):
    (u,v),(nu,nv)=RP[i],RN[i]; x,y=to_xy(u,v)
    nx,ny=to_xy(nu,nv); a=math.atan2(ny,nx)
    T=dict(cx=x,cy=y,rot=a)
    if red:                                               # the traditional vermilion bridge, arched over the canal
        N=12; ks=[k/N for k in range(N+1)]
        def zt(t): return 0.42+ARCH*math.sin(math.pi*t)
        solid([[(-1.55+3.1*t,-0.8,zt(t)-0.12),(-1.55+3.1*t,0.8,zt(t)-0.12),(-1.55+3.1*t,0.8,zt(t)),(-1.55+3.1*t,-0.8,zt(t))] for t in ks],"vermilion",T)
        for sy in (-1,1):
            box("stone",-1.4,sy*0.62,-0.05,0.3,0.18,0.18,T); box("stone",1.4,sy*0.62,-0.05,0.3,0.18,0.18,T)
            for zz,h in ((0.26,0.06),(0.12,0.03)):           # top rail and mid rail following the arch
                solid([[(-1.5+3.0*t,sy*0.76-h*0.6,zt(t)+zz),(-1.5+3.0*t,sy*0.76+h*0.6,zt(t)+zz),(-1.5+3.0*t,sy*0.76+h*0.6,zt(t)+zz+h),(-1.5+3.0*t,sy*0.76-h*0.6,zt(t)+zz+h)] for t in ks],"vermilion",T)
            for k in range(1,N,2):
                t=k/N; box("vermilion",-1.55+3.1*t,sy*0.76,zt(t)-0.02,zt(t)+0.32,0.035,0.035,T)
            for ex,t in ((-1.5,0.0),(1.5,1.0)):
                box("vermilion",ex,sy*0.76,zt(t)-0.02,0.86,0.06,0.06,T); box("black",ex,sy*0.76,0.86,0.92,0.08,0.08,T)
    else:                                                 # a plain timber bridge
        box("wood",0,0,0.3,0.42,1.55,0.8,T)
        for sy in (-1,1):
            box("stone",-1.4,sy*0.62,-0.05,0.5,0.18,0.18,T); box("stone",1.4,sy*0.62,-0.05,0.5,0.18,0.18,T)   # posts stand proud of the deck (no coplanar tops)
            box("wood",0,sy*0.76,0.62,0.7,1.55,0.05,T)
            box("wood",0,sy*0.76,0.48,0.52,1.5,0.03,T)
            for k in range(5): box("wood",-1.2+0.6*k,sy*0.76,0.42,0.7,0.04,0.04,T)
    BRIDGES.append((u,v,nu,nv,red))
I_FRONT=min(range(NR),key=lambda i: math.hypot(RP[i][0]-CA,RP[i][1]-(-1.0)))
I_RIGHT=min(range(NR),key=lambda i: math.hypot(RP[i][0]-(-1.2),RP[i][1]-CB))
bridge(I_FRONT); bridge(I_RIGHT,red=True)
def on_bridge(x,y):
    u,v=to_uv(x,y)
    for bu,bv,nu,nv,red in BRIDGES:
        du,dv=u-bu,v-bv; along=du*nu+dv*nv; across=-du*nv+dv*nu
        if abs(along)<=1.55 and abs(across)<=0.6:
            return 0.42+(ARCH*math.sin(math.pi*(along+1.55)/3.1) if red else 0.0)
    return None

# ---- donko-bune: long flat punts, a boatman poling at the stern under a sedge hat
def punt(i,flip=False):
    (u,v),(nu,nv)=RP[i],RN[i]; x,y=to_xy(u,v)
    tu,tv=-nv,nu
    if flip: tu,tv=-tu,-tv
    tx,ty=to_xy(tu,tv); a=math.atan2(ty,tx); T=dict(cx=x,cy=y,rot=a)
    rings=[]
    for lx,hw,zt in [(-1.35,0.22,0.3),(-1.15,0.3,0.26),(0.8,0.3,0.26),(1.2,0.18,0.3),(1.45,0.04,0.38)]:
        rings.append([(lx,-hw*0.8,-0.02),(lx,hw*0.8,-0.02),(lx,hw,zt),(lx,-hw,zt)])
    solid(rings,"wood",T)
    for lx in (-0.6,0.0,0.6): box("pave",lx,0,0.18,0.24,0.06,0.27,T)            # seats
    box("black",-1.05,0,0.26,0.86,0.08,0.08,T)                                 # the boatman
    ico("pave",-1.05,0,0.93,0.07,0.07,0.08,T)
    cone("pave",ngon(0.2,0.97,8,0,-1.05,0),(-1.05,0,1.12),T)
    solid([rect(0.02,0.02,0.3,-1.3,0.12),rect(0.02,0.02,1.7,-0.75,0.2)],"wood",T)   # the pole
    box("glow_lamp_%d"%i,1.25,0,0.38,0.52,0.06,0.06,T)
for i,f in [(int(NR*0.12),False),(int(NR*0.45),True),(int(NR*0.78),False)]:
    if any(math.hypot(RP[i][0]-b[0],RP[i][1]-b[1])<2.6 for b in BRIDGES): i=(i+6)%NR
    punt(i,f)

# ---- weeping willows along the promenade, their crowns hanging over the water
def willow(u,v,s):
    x,y=to_xy(u,v); T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.13,-0.3,5),ngon(0.1,1.4,5,0,0.15,0),ngon(0.07,1.9,5,0,0.25,0.1)],"bark",T)
    ico("willow",0.2,0.05,2.15,0.75,0.75,0.4,T)
    for k in range(6):
        a=2*math.pi*k/6+rng.uniform(-0.2,0.2); r=rng.uniform(0.5,0.75)
        cx,cy=0.2+r*math.cos(a),0.05+r*math.sin(a)
        solid([ngon(0.22,2.1,4,a,cx,cy),ngon(0.05,rng.uniform(0.55,0.85),4,a,cx*1.12,cy*1.12)],"willow",T)    # hanging tresses
placed=[]
for k in range(13):
    i=int(NR*(k+0.5)/13); (u,v),(nu,nv)=RP[i],RN[i]
    if any(math.hypot(u-b[0],v-b[1])<2.2 for b in BRIDGES): continue
    wu,wv=u+nu*(CW+0.75),v+nv*(CW+0.75); willow(wu,wv,rng.uniform(0.9,1.1)); placed.append((*to_xy(wu,wv),0.6))

# ---- storehouses (kura) along the outside of the canal: white plaster over black-and-white namako lower walls,
# heavy brown roofs
def kura(u,v,w,d,h,face):
    x,y=to_xy(u,v); T=dict(cx=x,cy=y,rot=face)
    box("plaster",0,0,-0.05,h,w,d,T)
    box("black",0,0,-0.05,0.75,w+0.02,d+0.02,T)
    for k in range(int(2*w/0.36)):                                 # the white grid of the namako tiles
        box("pave",-w+0.18+0.36*k,-d-0.03,0.08,0.68,0.02,0.01,T)
    for z in (0.3,0.55): box("pave",0,-d-0.03,z,z+0.03,w,0.01,T)
    box("black",w*0.35,-d-0.02,1.1,1.45,0.22,0.02,T)               # shuttered window
    extrude_x("roof",[(-d-0.3,h-0.05),(d+0.3,h-0.05),(d+0.3,h+0.08),(0,h+0.75),(-d-0.3,h+0.08)],-w-0.25,w+0.25,T)
    box("roof",0,0,h+0.68,h+0.82,w+0.3,0.12,T)
KURA=[(9.0,-3.2,1.5,1.0,2.0,ROT),(9.0,1.8,1.2,1.0,1.8,ROT),(1.6,9.8,1.4,1.0,2.1,ROT-math.pi/2),(-2.0,9.6,1.2,0.95,1.9,ROT-math.pi/2),(-9.0,-3.0,1.4,1.0,2.0,ROT+math.pi),(2.8,-9.6,1.3,0.95,1.9,ROT+math.pi/2)]
for k in KURA:
    kura(*k); placed.append((*to_xy(k[0],k[1]),max(k[2],k[3])+0.4))

# ---- inside the canal: the Tachibana villa (Ohana): the Western-style hall (Seiyokan) and a Japanese
# house, with garden pines and lanterns
SX,SY=to_xy(-0.6,-1.4); TS=dict(cx=SX,cy=SY,rot=ROT)
box("stone",0,0,-0.05,0.25,1.75,1.25,TS)
box("plaster",0,0,0.25,2.55,1.55,1.05,TS)
box("roof",0,0,1.35,1.42,1.6,1.1,TS)
for k in range(5):
    for z0 in (0.55,1.65): box("black",-1.2+0.6*k,-1.06,z0,z0+0.55,0.12,0.02,TS)
box("plaster",0,-1.3,0.25,1.35,0.55,0.3,TS); box("roof",0,-1.3,1.35,1.45,0.65,0.4,TS)       # the porch
def roof_T(spec,T):
    """flared_roof() in a rotated frame: build it at the origin, then move its new vertices into place."""
    before=len(B.get("roof",([],[]))[0])
    flared_roof(spec,"roof",0.0,0.0)
    bv=B["roof"][0]
    for i in range(before,len(bv)): bv[i]=xf([bv[i]],**T)[0]
roof_T([(1.85,1.35,2.55,0.0),(1.85,1.35,2.65,0.0),(0.9,0.4,3.35,0.0)],TS)
JX,JY=to_xy(-2.0,2.4); TJ=dict(cx=JX,cy=JY,rot=ROT)
box("wood",0,0,-0.05,1.2,1.4,1.0,TJ)
box("plaster",0,-1.01,0.35,1.0,1.15,0.02,TJ)
roof_T([(1.9,1.45,1.2,0.18),(1.9,1.45,1.3,0.18),(1.05,0.5,1.8,0.04),(0.85,0.1,2.2,0.0)],TJ)
def pine(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.12,-0.2,5),ngon(0.1,1.0,5,0,0.25,0),ngon(0.07,1.7,5,0,0.05,0.1)],"bark",T)
    for (px,py,pz,r) in [(0.05,0.1,1.8,0.8),(0.5,-0.1,1.3,0.6),(-0.3,0.25,1.15,0.5)]: ico("leaf",px,py,pz,r,r*0.9,0.28,T)
for u,v in [(2.2,2.0),(2.6,-3.0),(-3.0,-3.6),(1.4,4.2)]:
    x,y=to_xy(u,v); pine(x,y,rng.uniform(0.85,1.05)); placed.append((x,y,0.6))
for u,v in [(2.4,-0.6),(2.4,0.9)]:
    x,y=to_xy(u,v); prism("stone",x,y,-0.05,0.15,0.22,0.22,4,math.pi/4); prism("stone",x,y,0.15,0.7,0.07,0.07,4,math.pi/4)
    prism("glow_lantern_%d"%(1 if v<0 else 2),x,y,0.7,0.92,0.14,0.14,4,math.pi/4); cone("roof",ngon(0.3,0.92,4,math.pi/4,x,y),(x,y,1.12))
# outer grounds: a few trees in the corners
for u,v in [(9.4,6.8),(-8.8,4.4),(-6.6,-8.4),(6.4,-9.6),(-9.0,-7.0),(9.6,8.8)]:
    x,y=to_xy(u,v)
    if abs(x)<FH-1.2 and abs(y)<FH-1.2 and all(math.hypot(x-px,y-py)>pr+0.9 for px,py,pr in placed): pine(x,y,1.0)

def floor_at(x,y):
    h=on_bridge(x,y); return h if h is not None else 0.0
STAND=to_xy(CA+2.3,-1.0)   # just off the front bridge, on the promenade

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/yanagawa.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=FH; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y): return floor_at(x,y)   # the bridges; the game draws the ground beneath
ground=[[round(ground_at(-HALF+GSTEP*ix, -(-HALF+GSTEP*iz)),3) for ix in range(GN)] for iz in range(GN)]
CELL=0.3
solid_cells=set(); cellg={}
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
INTERACT=to_xy(*RP[I_FRONT])   # the front bridge
# STAND (set above): the promenade by the front bridge
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]],"terrainSurface":True}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/yanagawa.json"
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
    objname=key if key.startswith("glow_") else "yanagawa_"+key
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
