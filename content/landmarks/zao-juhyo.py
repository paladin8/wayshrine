# Zao's snow monsters (juhyo: firs encased in rime on the slopes below the summit, with the ropeway) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python zao-juhyo.py
# Rebuilds content/landmarks/zao-juhyo.blend and public/models/landmarks/zao-juhyo.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/zao-juhyo.glb"
BLEND=ROOT+"/content/landmarks/zao-juhyo.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"terrain":"dbe5eb","snow":"f1f4f6","rime":"dde6ee","packed":"cfd7de","fir":"3f5f4a","steel":"c4c9ce","red":"d96b59","roof":"2a2424","stone":"a39e98","glow_cream":"e8dcb0"}
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
rng=random.Random(12)
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



# ---- the slope: snow rising from the front to a rounded summit at the back, falling back to the base height at
# every edge (the outer ring of the ground grid is exactly 0)
HILL=3.4
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
def edge_d(x,y): return min(9.6-abs(x),9.6-abs(y),(18.0-abs(x)-abs(y))/math.sqrt(2))
def H(x,y):
    rise=HILL*smooth(-7.0,4.5,y)*(1.0-0.25*smooth(2.0,8.0,abs(x+1.0)))
    dome=0.9*math.exp(-((x+1.6)**2+(y-4.6)**2)/6.0)
    swell=0.35*math.sin(0.7*x+0.3*y)*smooth(-6.0,2.0,y)
    return max(0.0,(rise+dome+swell))*smooth(0.0,2.4,edge_d(x,y))
GS=0.8; NG=24
gv={}
for j in range(NG+1):
    for i in range(NG+1):
        x=-9.6+i*GS; y=-9.6+j*GS
        if 0<i<NG and 0<j<NG:
            x+=rng.uniform(-0.2,0.2); y+=rng.uniform(-0.2,0.2)
        gv[(i,j)]=(x,y,H(x,y))
gverts=[]; gid={}
for k,v in gv.items(): gid[k]=len(gverts); gverts.append(v)
def area2(a,b,c): return (b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1])
gf=[]; gm=[]
for j in range(NG):
    for i in range(NG):
        a,b,c,d4=(i,j),(i+1,j),(i+1,j+1),(i,j+1)
        tr=[(a,b,c),(a,c,d4)] if (i+j)%2==0 else [(a,b,d4),(b,c,d4)]
        for t3 in tr:
            P=[gv[k] for k in t3]
            if area2(*P)<=1e-4: continue
            gf.append([gid[k] for k in t3]); gm.append("terrain")
emit(gverts,gf,gm,orient=False)
def octo(z,h=9.6,ch=1.2):
    # the full square footprint: no cut corners, so the model's ground meets the game's terrain all round
    return [(-h,-h,z),(h,-h,z),(h,h,z),(-h,h,z)]
solid([octo(-1.0),octo(0.0)],"stone",mb=None,mt=None)

# ---- the ropeway: a lower station at the foot, two steel towers, the cables and a red gondola up to the summit
LS=(5.4,-6.4); US=(-1.6,4.6)
def station(cx,cy,rot,idx,hx=1.1,hy=0.75,h=1.25):
    T=dict(cx=cx,cy=cy,cz=H(cx,cy),rot=rot)
    box("stone",0,0,-0.4,0.15,hx+0.1,hy+0.1,T)
    box("steel",0,0,0.15,h,hx,hy,T)
    box("glow_window_%d"%idx,0,-hy-0.02,0.55,0.95,hx*0.75,0.02,T)
    box("glow_window_%d"%idx,hx+0.02,0,0.55,0.95,0.02,hy*0.6,T)
    extrude_x("roof",[(-hy-0.25,h),(hy+0.25,h),(hy+0.25,h+0.1),(0,h+0.55),(-hy-0.25,h+0.1)],-hx-0.2,hx+0.2,T)
    extrude_x("snow",[(-hy-0.18,h+0.12),(0,h+0.6),(hy+0.18,h+0.12),(hy+0.1,h+0.1),(0,h+0.5),(-hy-0.1,h+0.1)],-hx-0.12,hx+0.12,T)
rh=math.atan2(US[1]-LS[1],US[0]-LS[0])
station(LS[0],LS[1],rh,1); station(US[0],US[1],rh,2,1.3,0.9,1.4)
def tower(t,h):
    x=LS[0]+(US[0]-LS[0])*t; y=LS[1]+(US[1]-LS[1])*t; g=H(x,y)
    T=dict(cx=x,cy=y,cz=g,rot=rh)
    for sy in (-1,1):
        solid([rect(0.09,0.09,-0.3,0,sy*0.42),rect(0.05,0.05,h,0,sy*0.22)],"steel",T)
    for z in (h*0.35,h*0.7): box("steel",0,0,z,z+0.07,0.05,0.4-0.18*z/h,T)
    box("steel",0,0,h,h+0.12,0.12,0.62,T)
    return (x,y,g+h+0.12)
T1=tower(0.34,2.6); T2=tower(0.67,2.5)
P0=(LS[0],LS[1],H(*LS)+1.4); P3=(US[0],US[1],H(*US)+1.55)
def tube(p,q,r,mat,n=4):
    a=Vector(p); b=Vector(q); t=(b-a).normalized(); u=t.cross(Vector((0,0,1))).normalized(); v=u.cross(t).normalized()
    ring=lambda c:[tuple(c+r*(math.cos(2*math.pi*k/n+0.785)*u+math.sin(2*math.pi*k/n+0.785)*v)) for k in range(n)]
    solid([ring(a),ring(b)],mat)
px,py=-math.sin(rh),math.cos(rh)
for sy in (-1,1):
    pts=[P0,T1,T2,P3]
    for a,b in zip(pts,pts[1:]):
        tube((a[0]+px*sy*0.5,a[1]+py*sy*0.5,a[2]-0.04),(b[0]+px*sy*0.5,b[1]+py*sy*0.5,b[2]-0.04),0.025,"roof")
CABINS=[]
def cable_point(t,side):
    pts=[P0,T1,T2,P3]; lengths=[math.dist(a,b) for a,b in zip(pts,pts[1:])]
    distance=t*sum(lengths)
    for k,length in enumerate(lengths):
        if distance<=length or k==len(lengths)-1: break
        distance-=length
    a,b=pts[k],pts[k+1]; u=min(1.0,distance/length)
    return (a[0]+(b[0]-a[0])*u+px*side*0.5,
            a[1]+(b[1]-a[1])*u+py*side*0.5,
            a[2]+(b[2]-a[2])*u-0.04)

def gondola(t,side,idx):
    # Keep each cabin's hanger, painted body and lit windows on one animation parent.
    global B
    scenery=B; B={}
    T=dict(rot=rh)
    box("roof",0,0,-0.45,0.0,0.02,0.02,T)
    box("red",0,0,-1.05,-0.45,0.32,0.28,T)
    box("glow_gondola_%d"%idx,0,0,-0.82,-0.58,0.33,0.29,T)
    box("red",0,0,-1.12,-1.05,0.28,0.24,T)
    CABINS.append((idx,side,t,B))
    B=scenery
gondola(0.48,1,1); gondola(0.22,-1,2)

# ---- the ski trail, packed snow draped over the slope from the summit station down past the monsters
TRAIL=[(-0.2,3.4),(1.8,1.6),(0.4,-0.8),(2.4,-2.8),(1.2,-5.0),(2.8,-7.2)]
def ribbon(pts,w,mat,step=0.45):
    seq=[]
    for p,q in zip(pts,pts[1:]):
        n=max(1,int(math.dist(p,q)/step))
        for k in range(n): seq.append((p[0]+(q[0]-p[0])*k/n,p[1]+(q[1]-p[1])*k/n))
    seq.append(pts[-1])
    verts=[]; faces=[]
    for i,(x,y) in enumerate(seq):
        a=seq[max(0,i-1)]; b=seq[min(len(seq)-1,i+1)]; h=math.atan2(b[1]-a[1],b[0]-a[0]); nx,ny=-math.sin(h),math.cos(h)
        for s in (-1,1):
            X=x+nx*s*w/2; Y=y+ny*s*w/2; verts.append((X,Y,H(X,Y)+0.03))
        if i: faces.append([2*i-2,2*i-1,2*i+1,2*i])
    emit(verts,faces,[mat]*len(faces),orient=False)
ribbon(TRAIL,1.1,"packed")

# ---- the snow monsters: firs buried in rime, built from stacked lumps that lean downwind (+x), with the
# feathery "shrimp tails" on the windward side and a few dark patches where the fir shows through
def seg_d(x,y,pts):
    best=9e9
    for (x0,y0),(x1,y1) in zip(pts,pts[1:]):
        dx,dy=x1-x0,y1-y0; t=max(0.0,min(1.0,((x-x0)*dx+(y-y0)*dy)/(dx*dx+dy*dy)))
        best=min(best,math.hypot(x-x0-dx*t,y-y0-dy*t))
    return best
def juhyo(cx,cy,h):
    # one continuous lumpy body: jittered rings stacked up a leaning axis, bulging at the shoulders and narrowing
    # to a hooded head; then a few lumps and the windward shrimp tails, all overlapping the body
    g=H(cx,cy); s=0.55+0.17*h; lean=rng.uniform(0.16,0.3)*h; ph=rng.uniform(0,6.28); n=6
    prof=[(-0.25,0.62),(0.12,0.7),(0.35,0.78),(0.58,0.64),(0.8,0.48),(0.95,0.22),(1.0,0.04)]
    rings=[]
    for t,r in prof:
        ox=lean*max(0.0,t)**1.4
        ring=[]
        for k in range(n):
            a=ph+2*math.pi*k/n
            rr=r*s*rng.uniform(0.82,1.14)*(1.0+0.12*math.cos(a))        # a little fuller downwind
            ring.append((cx+ox+rr*math.cos(a),cy+rr*math.sin(a)*0.92,g+max(-0.25,t*h)+rng.uniform(-0.06,0.06)))
        rings.append(ring)
    solid(rings,"rime")
    for t,side in [(0.38,1),(0.62,-1),(0.5,1)][:2 if h<2.6 else 3]:                    # lumps
        r=0.32*s*rng.uniform(0.8,1.2); a=ph+side*1.4+rng.uniform(-0.4,0.4)
        ico("rime",lean*t**1.4+0.55*s*math.cos(a),0.5*s*math.sin(a),0,r,r,r*0.85,dict(cx=cx,cy=cy,cz=g+t*h))
    for t in (0.35,0.7):                                                                # shrimp tails, windward (-x)
        ico("snow",lean*t**1.4-0.6*s*(1.0-0.5*t),0,0,0.32*s,0.26*s,0.13*s,dict(cx=cx,cy=cy,cz=g+t*h,rot=rng.uniform(-0.3,0.3)))
    if rng.random()<0.45:
        ico("fir",lean*0.45+0.62*s*0.9,rng.uniform(-0.2,0.2),0,0.14,0.12,0.18,dict(cx=cx,cy=cy,cz=g+0.42*h))
placed=[]
tries=0
while len(placed)<30 and tries<4000:
    tries+=1
    x=rng.uniform(-8.6,8.6); y=rng.uniform(-6.6,8.0)
    if edge_d(x,y)<1.3 or seg_d(x,y,TRAIL)<1.0 or seg_d(x,y,[LS,US])<1.0: continue
    if math.dist((x,y),LS)<2.0 or math.dist((x,y),US)<2.3: continue
    if any(math.dist((x,y),p)<1.15+0.12*s for p,s in placed): continue
    h=rng.uniform(1.7,3.9)*(0.8+0.2*smooth(-6.0,3.0,y))
    placed.append(((x,y),h))
for (x,y),h in placed: juhyo(x,y,h)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/zao-juhyo.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=9.6; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y): return H(x,y)
ground=[[round(ground_at(-HALF+GSTEP*ix, -(-HALF+GSTEP*iz)),3) for ix in range(GN)] for iz in range(GN)]
for i in range(GN): ground[0][i]=ground[GN-1][i]=ground[i][0]=ground[i][GN-1]=0.0    # the edge ring is the base height
CELL=0.3
cellg={}
def cg(cx,cy):
    k=(cx,cy)
    if k not in cellg: cellg[k]=ground_at(-HALF+CELL*(cx+0.5), -HALF+CELL*(cy+0.5))
    return cellg[k]
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
                    cx=int((x+HALF)/CELL); cy=int((y+HALF)/CELL)
                    g=cg(cx,cy)
                    if z<g+BAND0 or z>g+BAND1: continue
                    if nz>0.92 and z<g+0.6: continue
                    solid_cells.add((cx,cy))
solids=[[round(-HALF+CELL*(cx+0.5),2), round(-(-HALF+CELL*(cy+0.5)),2), 0.22] for cx,cy in sorted(solid_cells)]
solids+=[[round(x,2),round(-y,2),r] for x,y,r in EXTRA_SOLIDS]
INTERACT=(1.6,-4.4)             # among the first snow monsters, by the trail
STAND=(3.4,-7.6)                # at the foot of the slope, by the lower station
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[round(INTERACT[0],2),round(-INTERACT[1],2)],"reach":3.6,"stand":[STAND[0],-STAND[1]]}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/zao-juhyo.json"
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
def add_piece(objname,matname,vs,fs,parent=None):
    me=bpy.data.meshes.new(objname); me.from_pydata(vs,[],fs); me.validate(); me.update()
    for p in me.polygons: p.use_smooth=False
    me.materials.append(getmat(matname))
    ob=bpy.data.objects.new(objname,me); col.objects.link(ob)
    ob.parent=parent
    stats[objname]=sum(len(p.vertices)-2 for p in me.polygons)
    allv.extend(v.co.copy()+(parent.location if parent else Vector()) for v in me.vertices)

for key,(vs,fs) in sorted(B.items()):
    glow=key.startswith("glow_")
    add_piece(key if glow else "zao_"+key,"glow_cream" if glow else key,vs,fs)

scene=bpy.context.scene
scene.render.fps=24
scene.frame_start=0
scene.frame_end=576
for idx,side,start,pieces in CABINS:
    cabin=bpy.data.objects.new("zao_gondola_%d"%idx,None); col.objects.link(cabin)
    phase=math.acos(1-2*start)*side
    for frame in range(scene.frame_start,scene.frame_end+1,4):
        cycle=frame/scene.frame_end
        # Slow into the stations, then return on the same rope without a loop jump.
        t=(1-math.cos(cycle*2*math.pi+phase))/2
        cabin.location=cable_point(t,side)
        cabin.keyframe_insert(data_path="location",frame=frame)
    cabin.location=cable_point(start,side)
    for key,(vs,fs) in sorted(pieces.items()):
        glow=key.startswith("glow_")
        add_piece(key if glow else "zao_cabin_%d_%s"%(idx,key),"glow_cream" if glow else key,vs,fs,cabin)
scene.frame_set(scene.frame_start)
mn=[min(v[i] for v in allv) for i in range(3)]; mx=[max(v[i] for v in allv) for i in range(3)]
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', export_yup=True, export_apply=True,
    export_cameras=False, export_lights=False, export_extras=True, export_animations=True, export_animation_mode='SCENE', export_materials='EXPORT')
res={"tris":sum(stats.values()),"per_obj":stats,"materials":len(bpy.data.materials),"min":[round(v,3) for v in mn],"max":[round(v,3) for v in mx],"glb_bytes":os.path.getsize(GLB)}
json.dump(res,open("/tmp/lm_build.json","w"))
