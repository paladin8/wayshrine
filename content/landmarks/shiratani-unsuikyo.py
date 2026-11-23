# Shiratani Unsuikyo (the moss forest of Yakushima: a stream falling over granite between moss-furred boulders, a plank bridge, a yakusugi and old rooted trees) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python shiratani-unsuikyo.py
# Rebuilds content/landmarks/shiratani-unsuikyo.blend and public/models/landmarks/shiratani-unsuikyo.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/shiratani-unsuikyo.glb"
BLEND=ROOT+"/content/landmarks/shiratani-unsuikyo.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"water":"4f7d76","foam":"e8eee8","granite":"9c9a92","moss":"6f9a3a","bark":"5a4632","barkpale":"8f8476","cedar":"2f5a3a","leaf":"4a7a42","fern":"86b45e","wood":"7a5a40"}
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
rng=random.Random(32)
EXTRA_SOLIDS=[]; NOSOLID={"cedar","fern","leaf","moss","foam"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, a mossy ravine with its stream and backdrop
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

# ---- the stream: born in a fall from the mossy granite at the back, running down over slabs and sills between
# moss-capped boulders, to a pool among the rocks at the front
SP=[(-4.6,6.6),(-3.4,4.2),(-2.0,2.6),(-0.6,0.9),(0.8,-0.9),(2.4,-2.4),(3.8,-4.0),(5.2,-5.6)]
SW=[0.6,0.8,0.95,0.85,0.8,1.0,0.9,0.8]
PC,PR=(5.6,-6.3),1.7
def seg_d(x,y):
    best=(1e9,0)
    for k in range(len(SP)-1):
        (ax,ay),(bx,by)=SP[k],SP[k+1]; dx,dy=bx-ax,by-ay; L2=dx*dx+dy*dy
        t=max(0.0,min(1.0,((x-ax)*dx+(y-ay)*dy)/L2)); d=math.hypot(x-ax-t*dx,y-ay-t*dy)
        w=SW[k]+(SW[k+1]-SW[k])*t
        if d-w<best[0]: best=(d-w,k+t)
    return best
def in_water(x,y,m=0.0): return seg_d(x,y)[0]<-m or math.hypot(x-PC[0],y-PC[1])<PR-m
# bridge across the stream's middle reach
BC=(0.0,0.0); BD=(0.79,0.61); BL=1.9; BW=0.55; BZ=0.42
def on_bridge(x,y,m=0.0):
    rx,ry=x-BC[0],y-BC[1]; s=rx*BD[0]+ry*BD[1]; t=-rx*BD[1]+ry*BD[0]
    return abs(s)<=BL+m and abs(t)<=BW+m, s
def water_disc(x,y): return in_water(x,y,0.1) and not on_bridge(x,y,0.3)[0]

pts=[];
for k,(x,y) in enumerate(SP):
    a=SP[max(k-1,0)]; b=SP[min(k+1,len(SP)-1)]; dx,dy=b[0]-a[0],b[1]-a[1]; L=math.hypot(dx,dy); nx,ny=-dy/L,dx/L
    pts.append(((x+nx*(SW[k]+0.15),y+ny*(SW[k]+0.15)),(x-nx*(SW[k]+0.15),y-ny*(SW[k]+0.15))))
for (l0,r0),(l1,r1) in zip(pts,pts[1:]):
    emit([(l0[0],l0[1],0.04),(r0[0],r0[1],0.04),(r1[0],r1[1],0.04),(l1[0],l1[1],0.04)],[[0,1,2,3]],["water"])
prism("water",PC[0],PC[1],0.0,0.04,PR+0.15,PR+0.15,12,0)
# the fall, and foaming sills where the stream steps down over the granite
GX,GY=-5.4,8.0
for x,y,z,r in [(GX,GY,0.8,2.2),(GX+1.7,GY+0.5,0.5,1.7),(GX-1.6,GY-1.0,0.4,1.6),(GX,GY+0.3,2.6,1.6),(GX+0.9,GY-0.2,2.3,1.0),(GX-1.0,GY+0.2,3.6,1.1)]:
    ico("granite",x,y,z,r,r*0.85,r*0.75); ico("moss",x+0.1,y+0.15,z+r*0.45,r*0.85,r*0.72,r*0.35)
emit([(-5.25,6.95,2.9),(-4.25,6.95,2.9),(-4.05,6.2,0.05),(-5.05,6.2,0.05)],[[0,1,2,3]],["foam"])
emit([(-5.25,6.97,2.9),(-4.25,6.97,2.9),(-4.25,7.3,3.0),(-5.25,7.3,3.0)],[[0,1,2,3]],["water"])
for t in (1.6,3.5,5.4):
    k=int(t); f=t-k; (ax,ay),(bx,by)=SP[k],SP[k+1]; x,y=ax+(bx-ax)*f,ay+(by-ay)*f
    dx,dy=bx-ax,by-ay; L=math.hypot(dx,dy); nx,ny=-dy/L,dx/L; w=SW[k]+0.2
    emit([(x+nx*w-dx/L*0.18,y+ny*w-dy/L*0.18,0.07),(x-nx*w-dx/L*0.18,y-ny*w-dy/L*0.18,0.07),(x-nx*w+dx/L*0.18,y-ny*w+dy/L*0.18,0.07),(x+nx*w+dx/L*0.18,y+ny*w+dy/L*0.18,0.07)],[[0,1,2,3]],["foam"])
    for j in range(4):
        q=(j-1.5)/1.5*w; ico("granite",x+nx*q+dx/L*0.3,y+ny*q+dy/L*0.3,0.0,0.32,0.28,0.18)

# ---- boulders along the banks and through the ravine, every one furred with moss
def boulder(x,y,r,cap=True):
    ico("granite",x,y,0.15*r,r,0.85*r,0.62*r)
    if cap: ico("moss",x+0.05*r,y+0.08*r,0.42*r,0.88*r,0.74*r,0.32*r)
for k,(x,y) in enumerate(SP[1:-1]):
    a=SP[k]; b=SP[k+2]; dx,dy=b[0]-a[0],b[1]-a[1]; L=math.hypot(dx,dy); nx,ny=-dy/L,dx/L
    for sd in (-1,1):
        boulder(x+sd*nx*(SW[k+1]+0.85),y+sd*ny*(SW[k+1]+0.85),rng.uniform(0.55,0.85))
for x,y,r in [(4.0,-8.0,0.9),(7.8,-5.0,0.95),(7.4,-7.8,0.7),(2.8,-6.4,0.6),(-6.6,4.4,1.0),(-2.4,7.0,0.8),(2.6,4.4,0.9),
              (6.8,1.6,0.8),(-6.0,-2.6,0.7),(-1.6,-5.4,0.7),(-7.8,6.4,0.8),(-8.0,9.0,0.9),(-2.8,9.0,0.8)]:
    boulder(x,y,r)
# moss carpet on the forest floor
for k in range(34):
    while True:
        x,y=rng.uniform(-9.6,9.6),rng.uniform(-9.6,9.6)
        if not in_water(x,y,-0.4) and not on_bridge(x,y,0.6)[0]: break
    r=rng.uniform(0.6,1.3); ico("moss",x,y,-0.12,r,r*rng.uniform(0.7,1.0),0.28)

# ---- the plank bridge across the stream, its rails of rope-bound poles
ang=math.atan2(BD[1],BD[0])
T=dict(cx=BC[0],cy=BC[1],rot=ang)
for k in range(9):
    s=-BL+2*BL*k/8; z=BZ*(1-(s/BL)**2)*0.35+BZ*0.65 if abs(s)<BL-0.3 else BZ*0.65*(BL-abs(s))/0.3
    box("wood",s,0,max(0.02,z)-0.06,max(0.06,z),BL/8+0.02,BW,T)
for sd in (-1,1):
    for s in (-BL+0.15,-BL/3,BL/3,BL-0.15): box("wood",s,sd*(BW-0.04),0.0,BZ+0.7,0.05,0.05,T)
    for s0,s1 in ((-BL+0.15,-BL/3),(-BL/3,BL/3),(BL/3,BL-0.15)):
        solid([[(s0,sd*(BW-0.04)-0.025,BZ+0.62),(s0,sd*(BW-0.04)+0.025,BZ+0.62),(s0,sd*(BW-0.04)+0.025,BZ+0.67),(s0,sd*(BW-0.04)-0.025,BZ+0.67)],
               [(s1,sd*(BW-0.04)-0.025,BZ+0.62),(s1,sd*(BW-0.04)+0.025,BZ+0.62),(s1,sd*(BW-0.04)+0.025,BZ+0.67),(s1,sd*(BW-0.04)-0.025,BZ+0.67)]],"wood",T)

# ---- trees: a great yakusugi, old trees whose roots grip the boulders, cedars, broadleaf evergreens, ferns; and a
# fallen log gone green
def yakusugi(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(1.15,-0.3,9),ngon(1.0,1.0,9,0.2),ngon(0.9,2.6,9,0.4),ngon(0.7,4.4,9,0.6),ngon(0.45,6.0,9,0.8)],"barkpale",T)
    for k in range(5): ico("moss",0.95*math.cos(k*1.3),0.95*math.sin(k*1.3),0.6+0.9*k,0.45,0.45,0.35,T)
    for zc,r,h in ((5.0,1.8,2.0),(6.4,1.4,1.7),(7.6,0.9,1.4)):
        cone("cedar",ngon(r,zc,8,rng.uniform(0,1)),(0,0,zc+h),T)
def rooted(x,y,s,bx,by):
    """a twisted broadleaf tree on a boulder, its roots draped down the rock to the ground"""
    boulder(x+bx,y+by,1.3*s)
    tube("bark",[(x,y,0.9),(x+0.1,y+0.15,2.2),(x-0.15,y+0.1,3.2),(x+0.1,y-0.1,4.0)],[0.34,0.27,0.2,0.14])
    for k in range(6):
        a=2*math.pi*k/6+0.3
        tube("bark",[(x+0.2*math.cos(a),y+0.2*math.sin(a),1.15),(x+0.85*math.cos(a),y+0.85*math.sin(a),0.95),(x+1.25*math.cos(a),y+1.25*math.sin(a),0.45),(x+1.45*math.cos(a),y+1.45*math.sin(a),-0.1)],[0.16,0.14,0.12,0.08],5)
    ico("leaf",x,y,4.3,1.6,1.4,0.9); ico("leaf",x+0.8,y+0.4,3.8,1.0,0.9,0.6); ico("moss",x+0.15,y,1.9,0.36,0.36,0.6)
def cedar(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.3,-0.3,6),ngon(0.18,4.6,6)],"bark",T)
    for zc,r,h in ((2.8,1.3,2.0),(4.1,1.05,1.8),(5.3,0.75,1.5),(6.3,0.45,1.1)):
        cone("cedar",ngon(r,zc,7,rng.uniform(0,1)),(0,0,zc+h),T)
def shrub(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    ico("leaf",0,0,0.55,0.9,0.8,0.6,T); ico("leaf",0.5,0.2,0.4,0.6,0.55,0.4,T)
def fern(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    for k in range(5):
        a=2*math.pi*k/5
        cone("fern",[(0.05*math.cos(a+1.6),0.05*math.sin(a+1.6),0.05),(-0.05*math.cos(a+1.6),-0.05*math.sin(a+1.6),0.05),(0.45*math.cos(a)-0.08*math.sin(a),0.45*math.sin(a)+0.08*math.cos(a),0.38)],(0.85*math.cos(a),0.85*math.sin(a),0.15),T)
yakusugi(5.2,4.6,1.0)
rooted(2.4,1.8,1.0,0.0,0.0); rooted(-3.4,-2.6,0.9,0.0,0.0); rooted(-6.4,2.0,0.85,0.0,0.0)
tube("bark",[(-2.0,-6.0,0.25),(-3.4,-6.4,0.3),(-5.0,-6.6,0.25)],[0.36,0.34,0.3],7)
for k in range(4): ico("moss",-2.2-0.9*k,-6.1-0.2*k,0.5,0.5,0.4,0.22)
for x,y,s in [(-9.2,8.4,1.0),(-1.0,9.4,1.05),(2.6,9.2,1.0),(6.0,9.2,1.1),(9.2,7.6,1.0),(9.4,3.0,0.95),(-9.4,4.4,1.0),(-9.2,0.0,0.95),(-9.0,-4.6,0.9),(-7.2,-8.6,0.9)]:
    cedar(x,y,s)
for x,y,s in [(5.6,0.2,1.0),(8.4,-2.4,1.1),(1.4,-8.6,1.0),(-4.4,-8.8,0.9),(8.8,-8.8,0.9),(-7.0,-6.0,1.0),(0.4,-4.0,0.8)]:
    shrub(x,y,s)
for k in range(28):
    while True:
        x,y=rng.uniform(-9.4,9.4),rng.uniform(-9.4,9.4)
        if not in_water(x,y,-0.5) and not on_bridge(x,y,0.8)[0] and math.hypot(x+1.4,y+2.2)>1.6: break
    fern(x,y,rng.uniform(0.7,1.1))

def ground_at(x,y):
    ok,s=on_bridge(x,y)
    if ok:
        return max(0.0,BZ*(1-(s/BL)**2)*0.35+BZ*0.65 if abs(s)<BL-0.3 else BZ*0.65*(BL-abs(s))/0.3)
    return 0.0
INTERACT=(-1.7,-1.6)   # the bank at the bridge's foot
STAND=(-1.1,-2.7)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/shiratani-unsuikyo.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/shiratani-unsuikyo.json"
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
    objname=key if key.startswith("glow_") else "shiratani_"+key
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
