# Kenroku-en in winter (pines in snow ropes, the Kotoji lantern and Kasumiga-ike pond) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python kenroku-en.py
# Rebuilds content/landmarks/kenroku-en.blend and public/models/landmarks/kenroku-en.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/kenroku-en.glb"
BLEND=ROOT+"/content/landmarks/kenroku-en.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"snow":"f1f4f6","packed":"cfd7de","water":"3fb2bd","stone":"a39e98","darkstone":"7f7a74","bark":"4e3a30","pine":"3f6b47","straw":"e2cf9c","darkwood":"4a3426","tile":"6a6e74","glow_cream":"e8dcb0"}
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
rng=random.Random(13)
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




# ---- the grounds: snow all round, Kasumiga-ike pond (with an inlet for the Kotoji lantern and an island)
# inside a snow rim; the outer ring of the ground grid is exactly 0
FH=11.2   # footprint half-width (the sidecar's half): the garden needs the room
WATER_Z=-0.25; BED_Z=-0.7
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
def sup(x,y,c,rx,ry,p=2.6,ph=0.0,k=1.0):
    dx=abs((x-c[0])/rx); dy=abs((y-c[1])/ry); th=math.atan2(y-c[1],x-c[0])
    return (dx**p+dy**p)**(1/p)/(1+k*(0.07*math.sin(3*th+ph)+0.05*math.sin(5*th+1.3+ph)))
PC=(-1.2,1.0); LC=(3.3,-1.9); IC=(-3.0,1.9)
def pond_m(x,y): return min(sup(x,y,PC,5.6,3.7,2.4,0.4),sup(x,y,LC,1.7,1.05,2.2,1.9,0.5))
def isle_m(x,y): return sup(x,y,IC,1.35,1.05,2.2,2.6)
def in_pond(x,y): return pond_m(x,y)<1.0 and isle_m(x,y)>1.0
def H(x,y):
    p=pond_m(x,y); i=isle_m(x,y)
    if i<1.0: return 0.22*smooth(1.0,0.5,i)                       # the island, a little above the water
    return BED_Z+(0.0-BED_Z)*smooth(0.9,1.04,p)                   # banks down into the pond
GS=0.8; NG=int(round(2*FH/GS))
gv={}
for j in range(NG+1):
    for i in range(NG+1):
        x=-FH+i*GS; y=-FH+j*GS
        if 0<i<NG and 0<j<NG:
            x+=rng.uniform(-0.18,0.18); y+=rng.uniform(-0.18,0.18)
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
            zc=sum(p[2] for p in P)/3
            gf.append([gid[k] for k in t3]); gm.append("darkstone" if zc<-0.05 else "snow")
emit(gverts,gf,gm,orient=False)
solid([[(-FH,-FH,-1.0),(FH,-FH,-1.0),(FH,FH,-1.0),(-FH,FH,-1.0)],[(-FH,-FH,0.0),(FH,-FH,0.0),(FH,FH,0.0),(-FH,FH,0.0)]],"stone",mb=None,mt=None)
# the water: a polygon round the pond's outline, just above the bed, under the banks
def outline(m,c,n=48,lev=0.985):
    pts=[]
    for k in range(n):
        a=2*math.pi*k/n; lo,hi=0.0,12.0
        for _ in range(30):
            mid=(lo+hi)/2
            if m(c[0]+mid*math.cos(a),c[1]+mid*math.sin(a))<lev: lo=mid
            else: hi=mid
        pts.append((c[0]+lo*math.cos(a),c[1]+lo*math.sin(a),WATER_Z))
    return pts
wp=outline(pond_m,(0.0,0.4),64,1.02)
emit(wp,[list(range(len(wp)))],["water"],orient=False)
# rocks along the shore
def rock(cx,cy,r,z=0.0):
    ico("darkstone",0,0,0,r*rng.uniform(0.95,1.3),r*rng.uniform(0.8,1.05),r*0.62,dict(cx=cx,cy=cy,cz=z,rot=rng.uniform(0,6.28)))
for k,(x,y,_) in enumerate(outline(pond_m,(0.0,0.4),40,1.0)):
    if k%3==0 and not (2.2<x<5.2 and -3.4<y<-0.6): rock(x,y,rng.uniform(0.28,0.45),-0.05)
for (x,y,_) in outline(isle_m,IC,10,1.0): rock(x,y,0.26,0.0)

# ---- pines in snow ropes (yukitsuri): a tall pole above the tree, straw ropes fanning down to the branch tips
def tube(p,q,r,mat,n=4):
    a=Vector(p); b=Vector(q); t=(b-a).normalized(); u=t.cross(Vector((0,0,1))).normalized(); v=u.cross(t).normalized()
    ring=lambda c:[tuple(c+r*(math.cos(2*math.pi*k/n+0.785)*u+math.sin(2*math.pi*k/n+0.785)*v)) for k in range(n)]
    solid([ring(a),ring(b)],mat)
def pine(cx,cy,s,z=0.0,poles=1,ropes=16,spread=1.0):
    T=dict(cx=cx,cy=cy,cz=z,s=s)
    solid([ngon(0.17,-0.2,6),ngon(0.14,1.3,6,0,0.18,0),ngon(0.1,2.3,6,0,0.05,0.1)],"bark",T)
    pads=[(0.0,0.05,2.45,1.15*spread),(0.75*spread,-0.2,1.75,0.95*spread),(-0.7*spread,0.3,1.55,0.85*spread),(0.2,-0.6*spread,1.95,0.75)]
    for (x,y,zz,r) in pads:
        ico("pine",x,y,zz,r,r*0.9,0.34,T)
        ico("snow",x,y,zz+0.2,r*0.82,r*0.74,0.16,T)
    R=1.55*spread*s; top=z+(3.9+0.3*poles)*s
    for k in range(poles):
        ox=(k-(poles-1)/2)*1.1*s
        prism("darkwood",cx+ox,cy,z+0.3*s,top,0.045,0.035,6,0)
        nr=ropes//poles if poles>1 else ropes
        for i in range(nr):
            a=2*math.pi*(i+0.5*k)/nr
            tube((cx+ox,cy,top-0.05),(cx+ox+R*math.cos(a)*(0.9 if poles>1 else 1.0),cy+R*math.sin(a),z+1.25*s),0.014,"straw",3)
# the Karasaki pine: low and spreading, propped on three poles
pine(-6.0,4.4,1.15,0.0,3,18,1.45)
for a in [(-7.4,-4.6,0.95),(6.2,2.8,1.0),(1.8,6.0,0.95),(-2.6,7.4,0.9),(-4.6,-7.8,0.85),(8.4,-1.4,0.8)]: pine(a[0],a[1],a[2])
pine(IC[0],IC[1],0.6,0.22,1,12)

# ---- the Kotoji lantern: two legs, the long one standing in the water, the short one on a rock, under a wide cap;
# and the Niji-bashi, a slab of stone bridging the inlet beside it
KX,KY=3.1,-2.55
rock(KX+0.55,KY-0.35,0.42,0.0)
prism("stone",KX-0.42,KY+0.2,BED_Z,0.95,0.11,0.09,6,0)                      # the long leg, in the pond
prism("stone",KX+0.5,KY-0.32,0.15,0.95,0.11,0.09,6,0)                       # the short leg, on the rock
box("stone",KX,KY,0.95,1.08,0.62,0.2,dict(rot=-0.6))
box("stone",KX,KY,1.08,1.2,0.26,0.26)
box("glow_lantern_1",KX,KY,1.2,1.48,0.19,0.19)
solid([ngon(0.6,1.48,8,math.pi/8,KX,KY),ngon(0.62,1.6,8,math.pi/8,KX,KY),ngon(0.18,1.9,8,math.pi/8,KX,KY)],"stone")
solid([ngon(0.54,1.63,8,math.pi/8,KX,KY),ngon(0.16,1.94,8,math.pi/8,KX,KY)],"snow")
bipyr("stone",KX,KY,2.0,0.1,1.92,2.14,6)
NB0,NB1=(4.55,-3.15),(4.75,-0.75)
nbx,nby=NB1[0]-NB0[0],NB1[1]-NB0[1]; nbh=math.atan2(nby,nbx); nbl=math.hypot(nbx,nby)
for k in range(6):
    t0,t1=k/6,(k+1)/6; z0=0.08+0.18*math.sin(math.pi*t0); z1=0.08+0.18*math.sin(math.pi*t1)
    T=dict(cx=NB0[0],cy=NB0[1],rot=nbh)
    extrude_y("stone",[(nbl*t0,z0-0.12),(nbl*t1,z1-0.12),(nbl*t1,z1),(nbl*t0,z0)],-0.36,0.36,T)
    extrude_y("snow",[(nbl*t0,z0),(nbl*t1,z1),(nbl*t1,z1+0.04),(nbl*t0,z0+0.04)],-0.3,0.3,T)

# ---- a teahouse at the back right, snow on its roof and a lit window
TX,TY=6.6,6.4
box("stone",TX,TY,-0.05,0.25,1.6,1.15)
box("darkwood",TX,TY,0.25,1.25,1.35,0.9)
box("glow_window_1",TX,TY-0.92,0.5,0.95,0.8,0.02)
box("glow_window_1",TX+1.37,TY,0.5,0.95,0.02,0.5)
flared_roof([(1.85,1.35,1.25,0.18),(1.85,1.35,1.35,0.18),(1.2,0.75,1.75,0.05),(0.9,0.12,2.2,0.0)],"tile",TX,TY)
flared_roof([(1.22,0.78,1.78,0.05),(0.93,0.15,2.24,0.0)],"snow",TX,TY)

# ---- the path round the pond, packed snow; snow-capped clipped shrubs along it
PATH=[(9.2,-10.0),(6.4,-6.0),(3.0,-4.3),(-1.4,-4.0),(-5.6,-3.2),(-8.2,0.6),(-8.6,4.4),(-6.4,8.0),(-1.6,9.6),(3.4,8.8),(4.4,5.0),(8.8,3.0)]
for p,q in zip(PATH,PATH[1:]):
    mx,my=(p[0]+q[0])/2,(p[1]+q[1])/2; h=math.atan2(q[1]-p[1],q[0]-p[0]); L=math.hypot(q[0]-p[0],q[1]-p[1])
    box("packed",0,0,-0.02,0.02,L/2+0.5,0.55,dict(cx=mx,cy=my,rot=h))
def shrub(cx,cy,r):
    ico("pine",0,0,0.22,r,r*0.9,r*0.55,dict(cx=cx,cy=cy,rot=rng.uniform(0,6.28)))
    ico("snow",0,0,0.22+r*0.32,r*0.86,r*0.78,r*0.34,dict(cx=cx,cy=cy,rot=rng.uniform(0,6.28)))
for (x,y,r) in [(1.2,-5.4,0.55),(-0.4,-5.6,0.45),(-3.4,-5.2,0.6),(5.4,-4.0,0.5),(-6.6,-1.6,0.5),(-9.6,2.2,0.55),(7.2,-3.0,0.45),
                (4.6,3.6,0.5),(2.8,4.2,0.6),(-4.4,6.4,0.55),(0.2,7.8,0.5),(9.2,5.4,0.55),(-9.0,-6.6,0.6),(3.4,-7.4,0.55),(-1.6,-8.4,0.5)]:
    shrub(x,y,r)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/kenroku-en.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=FH; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y): return WATER_Z if in_pond(x,y) else H(x,y)   # the game's terrain sits under the water
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
# the pond is not walkable: cover it with coarser discs
PSTEP=0.6; PR=0.43
for iy in range(int(2*HALF/PSTEP)):
    for ix in range(int(2*HALF/PSTEP)):
        x=-HALF+PSTEP*(ix+0.5); y=-HALF+PSTEP*(iy+0.5)
        if in_pond(x,y) and pond_m(x,y)<0.97: solids.append([round(x,2),round(-y,2),PR])
solids+=[[round(x,2),round(-y,2),r] for x,y,r in EXTRA_SOLIDS]
INTERACT=(3.0,-4.2)             # the path by the Kotoji lantern
STAND=(7.0,-7.6)                # where the path enters the garden
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[round(INTERACT[0],2),round(-INTERACT[1],2)],"reach":3.6,"stand":[STAND[0],-STAND[1]]}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/kenroku-en.json"
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
    objname=key if key.startswith("glow_") else "kenroku_"+key
    me=bpy.data.meshes.new(objname); me.from_pydata(vs,[],fs); me.validate(); me.update()
    for p in me.polygons: p.use_smooth=False
    me.materials.append(getmat(matname))
    ob=bpy.data.objects.new(objname,me); col.objects.link(ob)
    stats[objname]=sum(len(p.vertices)-2 for p in me.polygons)
    allv+= [v.co.copy() for v in me.vertices]
mn=[min(v[i] for v in allv) for i in range(3)]; mx=[max(v[i] for v in allv) for i in range(3)]
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', export_yup=True, export_apply=True,
    export_cameras=False, export_lights=False, export_extras=True, export_materials='EXPORT')
res={"tris":sum(stats.values()),"per_obj":stats,"materials":len(bpy.data.materials),"min":[round(v,3) for v in mn],"max":[round(v,3) for v in mx],"glb_bytes":os.path.getsize(GLB)}
json.dump(res,open("/tmp/lm_build.json","w"))
