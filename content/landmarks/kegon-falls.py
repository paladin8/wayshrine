# Kegon Falls (the plunge from Lake Chuzenji into a horseshoe of columnar cliffs, the Juni-taki seeps, the deck at its foot) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python kegon-falls.py
# Rebuilds content/landmarks/kegon-falls.blend and public/models/landmarks/kegon-falls.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/kegon-falls.glb"
BLEND=ROOT+"/content/landmarks/kegon-falls.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"rock":"6f6b6a","rockd":"55525a","scree":"8d837b","forest":"4f6a43","pine":"3d5a3f","maple":"c4683a","bark":"4e3a30","water":"4d8a86","foam":"eef3f1","concrete":"a9a39a","roof":"3a3634","glow_cream":"e8dcb0"}
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
rng=random.Random(16)
EXTRA_SOLIDS=[]
FH=16.8   # footprint half-width (the sidecar's half): the gorge, its cliffs and the forest round them
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
D2R=math.pi/180
def dirv(a): return (math.cos(a*D2R),math.sin(a*D2R))

# ---- the gorge: a horseshoe of sheer columnar cliffs opening toward the viewer (-Y/+X), forested on top and
# down its outer slopes; the falls pour from a notch at the back of the bowl. Lofted from one profile per angle.
C=(-3.2,3.2); TB=135.0; SPAN=125.0; A0,A1=TB-SPAN,TB+SPAN; NA=44
def edge_dist(a):
    dx,dy=dirv(a); B=FH-0.6; t=1e9
    if abs(dx)>1e-6: t=min(t,((B if dx>0 else -B)-C[0])/dx)
    if abs(dy)>1e-6: t=min(t,((B if dy>0 else -B)-C[1])/dy)
    return t
def r_in(a): return 5.4+2.2*((a-TB)/SPAN)**2
def notch(a): return math.exp(-((a-TB)/9.0)**2)
def prof(a,odd=False,jit=0.0):
    t=(a-TB)/SPAN
    e=smooth(0.0,0.34,1-abs(t)); s=0.08+0.92*e
    ri=r_in(a)+(0.24 if odd else 0.0)+jit
    tal=1-math.exp(-((a-TB)/26.0)**2)                     # no scree under the falls: the pool meets the cliff
    HT=(8.6-0.4*(1-e))*s-0.6*notch(a)
    W=2.2+2.4*math.exp(-((a-TB)/35.0)**2)
    Ro=min(ri+W+7.5,edge_dist(a))
    W=min(W,max(1.0,Ro-ri-3.0))
    return [(ri-0.9*tal-0.02,-0.2),(ri-0.3*tal-0.01,0.2+0.8*s*tal),
            (ri+0.02,0.33*HT),(ri-0.07,0.38*HT),(ri+0.08,0.62*HT),(ri-0.02,0.67*HT),(ri+0.12,0.97*HT),
            (ri+0.45,HT),(ri+W,HT+0.25*s),(ri+W+(Ro-ri-W)*0.45,HT*0.62),(Ro-0.9,HT*0.16),(Ro,-0.2)]
SEG=["scree","rock","rockd","rock","rockd","rock","rock","forest","forest","forest","forest","forest"]
angs=[A0+(A1-A0)*i/(NA-1) for i in range(NA)]
P=[prof(a,i%2==1,rng.uniform(-0.05,0.05)) for i,a in enumerate(angs)]
n=len(P[0]); verts=[]; faces=[]; fm=[]
for i,a in enumerate(angs):
    dx,dy=dirv(a)
    for r,z in P[i]: verts.append((C[0]+r*dx,C[1]+r*dy,z))
for k in range(NA-1):
    for i in range(n):
        j=(i+1)%n; q=[k*n+i,k*n+j,(k+1)*n+j,(k+1)*n+i]
        faces+=[[q[0],q[1],q[2]],[q[0],q[2],q[3]]]; fm+=[SEG[i],SEG[i]]
faces.append(list(range(n))); fm.append("forest")
faces.append([(NA-1)*n+i for i in range(n)]); fm.append("forest")
emit(verts,faces,fm)
def massif_z(x,y):
    """Surface height of the cliff tops and outer slopes at (x, y), or None off the massif."""
    dx,dy=x-C[0],y-C[1]; r=math.hypot(dx,dy); a=math.degrees(math.atan2(dy,dx))%360
    if not(A0+3<=a<=A1-3): return None
    pts=prof(a)[7:]
    if r<pts[0][0]+0.3 or r>pts[-1][0]-0.3: return None
    for (r0,z0),(r1,z1) in zip(pts,pts[1:]):
        if r0<=r<=r1: return z0+(z1-z0)*(r-r0)/(r1-r0)
    return None

# ---- the falls: a white plunge from the notch, falling clear of the cliff into the pool, with spray at its foot
RL=r_in(TB); HTN=prof(TB)[7][1]
bx,by=dirv(TB); tx,ty=-by,bx
rings=[]
for k in range(9):
    f=max(0.0,(k-1)/7); z=HTN+0.08 if k==0 else HTN+0.1-(HTN+0.05)*f
    r=RL+0.5 if k==0 else RL+0.1-0.75*f**0.6; w=0.32+0.2*f; d=0.12+0.06*f
    cx,cy=C[0]+r*bx,C[1]+r*by
    rings.append([(cx-tx*w-bx*d,cy-ty*w-by*d,z),(cx+tx*w-bx*d,cy+ty*w-by*d,z),(cx+tx*w+bx*d,cy+ty*w+by*d,z),(cx-tx*w+bx*d,cy-ty*w+by*d,z)])
solid(rings,"foam")
# the river over the lip, and the lake it comes from (Chuzenji, beyond the cliff top)
LX,LY=C[0]+(RL+3.1)*bx,C[1]+(RL+3.1)*by
solid([ngon(1.25,HTN-0.1,9,0.2,LX,LY),ngon(1.25,HTN+0.06,9,0.2,LX,LY)],"water")
box("water",0,0,HTN-0.1,HTN+0.07,0.42,1.3,dict(cx=C[0]+(RL+1.75)*bx,cy=C[1]+(RL+1.75)*by,rot=(TB-90)*D2R))   # the outlet, from the lake to the lip
FX,FY=C[0]+(RL-0.65)*bx,C[1]+(RL-0.65)*by
for ox,oy,oz,rx,rz in [(0,0,0.25,0.95,0.5),(0.6,-0.3,0.2,0.6,0.35),(-0.55,-0.35,0.22,0.65,0.38),(0.1,-0.7,0.15,0.55,0.28)]:
    ico("foam",FX+ox*tx-oy*bx*-1,FY+ox*ty+oy*by,oz,rx,rx,rz)

# ---- the Juni-taki: thin seeps breaking out of the strata to the right of the main fall, spilling over the ledges
def seep(a,z0,z1,w0,w1):
    ux,uy=dirv(a); vx,vy=-uy,ux; r=r_in(a)-0.1
    cx,cy=C[0]+r*ux,C[1]+r*uy
    def ring(z,w,o): return [(cx-vx*w-ux*o,cy-vy*w-uy*o,z),(cx+vx*w-ux*o,cy+vy*w-uy*o,z),(cx+vx*w-ux*(o+0.05),cy+vy*w-uy*(o+0.05),z),(cx-vx*w-ux*(o+0.05),cy-vy*w-uy*(o+0.05),z)]
    solid([ring(z1,w1,0.04),ring(z0,w0,0.0)],"foam")
HT0=8.6
for da,top,w,bot in [(-14,0.67,0.11,0.0),(-21,0.38,0.08,0.0),(-27,0.67,0.1,0.0),(-35,0.38,0.07,1.0),(-44,0.67,0.08,1.0)]:
    a=TB+da; zt=top*HT0-0.05; zb=0.15 if bot==0 else 0.95
    if top>0.5:   # over the upper ledge, then on down past the lower one
        seep(a,zt,0.38*HT0+0.1,0.025,w*0.7); seep(a,0.38*HT0-0.05,zb,w*0.6,w)
    else: seep(a,zt,zb,0.025,w)

# ---- the plunge pool and the river running out of the gorge toward the viewer
PC=(C[0]+3.0*bx,C[1]+3.0*by); PRT,PRR=2.7,2.15
def pool_pt(th,sc=1.0): return (PC[0]+sc*(PRT*math.cos(th)*tx+PRR*math.sin(th)*bx),PC[1]+sc*(PRT*math.cos(th)*ty+PRR*math.sin(th)*by))
NP=18
solid([[(*pool_pt(2*math.pi*i/NP,1.0+0.05*math.sin(5*i)),zz) for i in range(NP)] for zz in (-0.05,0.08)],"water")
def in_pool(x,y,pad=0.0):
    dx,dy=x-PC[0],y-PC[1]; u=(dx*tx+dy*ty)/(PRT+pad); v=(dx*bx+dy*by)/(PRR+pad); return u*u+v*v<=1.0
RP=[]
for k in range(16):
    f=k/15; d=-1.3-12.0*f                                    # along -b from the pool centre (toward the viewer)
    off=0.9*math.sin(f*5.2+0.4)*smooth(0.0,0.25,f)
    RP.append((PC[0]+d*bx+off*tx,PC[1]+d*by+off*ty,0.55+0.3*f))
def river_dist(x,y):
    best=1e9
    for (x0,y0,_),(x1,y1,_) in zip(RP,RP[1:]):
        ex,ey=x1-x0,y1-y0; L2=ex*ex+ey*ey; t=max(0,min(1,((x-x0)*ex+(y-y0)*ey)/L2))
        best=min(best,math.hypot(x-x0-t*ex,y-y0-t*ey))
    return best
rr=[]
for k,(x,y,w) in enumerate(RP):
    if k==0: ex,ey=RP[1][0]-x,RP[1][1]-y
    elif k==len(RP)-1: ex,ey=x-RP[k-1][0],y-RP[k-1][1]
    else: ex,ey=RP[k+1][0]-RP[k-1][0],RP[k+1][1]-RP[k-1][1]
    L=math.hypot(ex,ey); nx,ny=-ey/L,ex/L
    rr.append([(x-nx*w,y-ny*w,-0.05),(x+nx*w,y+ny*w,-0.05),(x+nx*w,y+ny*w,0.07),(x-nx*w,y-ny*w,0.07)])
solid(rr,"water")
# water is not walkable
for gx in range(-8,9):
    for gy in range(-8,9):
        x,y=PC[0]+gx*0.6,PC[1]+gy*0.6
        if in_pool(x,y,-0.15): EXTRA_SOLIDS.append((x,y,0.43))
for (x0,y0,w0),(x1,y1,w1) in zip(RP,RP[1:]):
    L=math.hypot(x1-x0,y1-y0); m=max(1,int(L/0.6))
    for q in range(m):
        f=q/m; x=x0+(x1-x0)*f; y=y0+(y1-y0)*f; w=w0+(w1-w0)*f
        nx,ny=-(y1-y0)/L,(x1-x0)/L
        for o in ([0.0] if w<0.6 else [-w*0.45,w*0.45]): EXTRA_SOLIDS.append((x+nx*o,y+ny*o,0.43))
x,y,w=RP[-1]; EXTRA_SOLIDS.append((x,y,0.43))

# boulders round the pool and along the banks; the river ends among rocks where it drops into the lower gorge
def boulder(cx,cy,s,m1="rock",m2="scree"):
    T=dict(cx=cx,cy=cy,rot=rng.uniform(0,6.28),s=s)
    ico(m1,0,0,0.22,0.7,0.52,0.42,T)
    if rng.random()<0.6: ico(m2,0.32,0.15,0.18,0.42,0.34,0.3,T)
for i in range(NP):
    th=2*math.pi*(i+0.3)/NP
    if math.sin(th)>0.55 or (math.sin(th)<-0.55 and abs(math.cos(th))<0.5): continue   # open to the cliff and to the outlet
    boulder(*pool_pt(th,1.08),rng.uniform(0.55,0.85))
for k in range(2,len(RP),2):
    x,y,w=RP[k]; x2,y2,_=RP[k-1]; ex,ey=x-x2,y-y2; L=math.hypot(ex,ey); nx,ny=-ey/L,ex/L
    for sgn in (-1,1):
        if rng.random()<0.75: boulder(x+sgn*nx*(w+0.55),y+sgn*ny*(w+0.55),rng.uniform(0.45,0.75),"scree" if rng.random()<0.5 else "rock","rock")
x,y,w=RP[-1]; ex,ey=x-RP[-2][0],y-RP[-2][1]; L=math.hypot(ex,ey); ex,ey=ex/L,ey/L
for o,f,s in [(-1.2,0.5,1.0),(0.0,1.0,1.15),(1.2,0.5,0.95),(-0.6,1.6,0.8),(0.7,1.5,0.85)]:
    boulder(x+ex*f-ey*o,y+ey*f+ex*o,s)

# ---- the observation deck at the foot of the falls, reached by a tunnel from the cliff (the elevator)
DK=(-5.7,0.7); DF=(FX-DK[0],FY-DK[1]); DROT=math.atan2(DF[1],DF[0])-math.pi/2
T=dict(cx=DK[0],cy=DK[1],rot=DROT)
box("concrete",0,0,-0.1,0.22,1.6,0.95,T)
for x in (-1.45,-0.5,0.5,1.45): box("roof",x,0.82,0.22,0.95,0.04,0.04,T)
for sx in (-1,1):
    for y in (-0.82,0.0): box("roof",sx*1.45,y,0.22,0.95,0.04,0.04,T)
    box("roof",sx*1.45,0.0,0.88,0.95,0.04,0.82,T)
box("roof",0,0.82,0.88,0.95,1.47,0.04,T)
box("concrete",-1.0,-0.62,0.22,1.7,0.45,0.28,T)          # the lift lobby
box("roof",-1.0,-0.62,1.7,1.84,0.6,0.42,T)
box("glow_lamp",-1.0,-0.33,1.15,1.45,0.12,0.04,T)
# walkway back to the tunnel portal in the cliff
TA=232.0; tu=dirv(TA); trr=r_in(TA)
PX,PY=C[0]+(trr-0.15)*tu[0],C[1]+(trr-0.15)*tu[1]
T2=dict(cx=PX,cy=PY,rot=(TA-90)*D2R)
box("concrete",-0.85,0,-0.1,1.9,0.22,0.6,T2); box("concrete",0.85,0,-0.1,1.9,0.22,0.6,T2); box("concrete",0,0,1.6,2.1,1.07,0.6,T2)
box("roof",0,0.05,-0.05,1.6,0.63,0.5,T2)                  # the dark tunnel mouth
WX0,WY0=PX-tu[0]*0.7,PY-tu[1]*0.7
lx,ly=xf([(-1.0,-0.62,0)],**T)[0][:2]
wl=math.hypot(lx-WX0,ly-WY0)
box("concrete",0,0,-0.1,0.12,0.5,wl/2,dict(cx=(lx+WX0)/2,cy=(ly+WY0)/2,rot=math.atan2(ly-WY0,lx-WX0)-math.pi/2))

# ---- low forested ridges either side of the river below the gorge
HILLS=[]
def hill(cx,cy,R,Hm,n=12):
    rings=[]
    for z,r in [(-0.2,1.0),(0.3*Hm,0.86),(0.7*Hm,0.6),(Hm,0.32)]:
        rings.append([(cx+R*r*(0.9+0.2*rng.random())*math.cos(2*math.pi*i/n),cy+R*r*(0.9+0.2*rng.random())*math.sin(2*math.pi*i/n),z) for i in range(n)])
    solid(rings,"forest"); HILLS.append((cx,cy,R,Hm))
def hill_z(x,y):
    for cx,cy,R,Hm in HILLS:
        d=math.hypot(x-cx,y-cy)/R
        if d<0.8: return Hm*(1-smooth(0.3,1.0,d))*0.95
    return None
hill(-9.0,-9.4,4.6,1.9); hill(10.4,-1.6,4.2,1.6)

# ---- forest: dark conifers over the cliff tops and the slopes the camera sees, autumn maples among them,
# and trees on the gorge floor clear of the water, the deck and the view down the river
def pine(cx,cy,cz,s):
    T=dict(cx=cx,cy=cy,cz=cz,s=s)
    prism("bark",0,0,-0.3,0.7,0.16,0.14,5,0,T)
    cone("pine",ngon(0.95,0.5,7,rng.uniform(0,1)),(0,0,1.9),T)
    cone("pine",ngon(0.72,1.25,7,rng.uniform(0,1)),(0,0,2.55),T)
    cone("pine",ngon(0.48,1.9,6,rng.uniform(0,1)),(0,0,3.1),T)
def maple(cx,cy,cz,s):
    T=dict(cx=cx,cy=cy,cz=cz,s=s)
    solid([ngon(0.15,-0.3,5),ngon(0.11,1.0,5,0,0.1,0),ngon(0.07,1.4,5,0,0.05,0.08)],"bark",T)
    ico("maple",0,0,1.75,1.05,0.95,0.75,T); ico("maple",0.55,0.3,1.4,0.6,0.55,0.45,T)
placed=[]
def free(x,y,d): return all(math.hypot(x-px,y-py)>=d for px,py in placed)
STAND=(1.2,-10.4)
tries=0
while len(placed)<46 and tries<6000:
    tries+=1
    a=rng.uniform(A0+6,A1-6); dv=dirv(a); pts=prof(a)
    r=rng.uniform(pts[7][0]+0.4,pts[-1][0]-0.9)
    x,y=C[0]+r*dv[0],C[1]+r*dv[1]
    if abs(x)>FH-0.8 or abs(y)>FH-0.8: continue
    onslope=r>pts[8][0]
    vis=math.cos((a+45)*D2R)>-0.25
    if onslope and not vis: continue
    if abs(a-TB)<10 and r<pts[8][0]+1.0: continue           # keep the lake and the lip clear
    if math.hypot(x-LX,y-LY)<1.9: continue
    z=massif_z(x,y)
    if z is None or not free(x,y,1.25): continue
    placed.append((x,y))
    if rng.random()<0.22: maple(x,y,z-0.1,rng.uniform(0.75,0.95))
    else: pine(x,y,z-0.15,rng.uniform(0.8,1.05))
for cx,cy,R,Hm in HILLS:
    for k in range(9):
        a=rng.uniform(0,6.28); d=R*rng.uniform(0.0,0.7); x,y=cx+d*math.cos(a),cy+d*math.sin(a)
        if not free(x,y,1.3) or abs(x)>FH-0.8 or abs(y)>FH-0.8: continue
        placed.append((x,y)); z=hill_z(x,y)-0.1
        if rng.random()<0.3: maple(x,y,z,rng.uniform(0.8,0.95))
        else: pine(x,y,z,rng.uniform(0.85,1.0))
def ok_floor(x,y):
    if abs(x)>FH-1.0 or abs(y)>FH-1.0: return False
    dx,dy=x-C[0],y-C[1]; r=math.hypot(dx,dy); a=math.degrees(math.atan2(dy,dx))%360
    if A0-4<=a<=A1+4:
        p=prof(a)
        if p[0][0]-1.0<r<p[-1][0]+0.8: return False
    if in_pool(x,y,1.0) or river_dist(x,y)<2.0 or hill_z(x,y) is not None: return False
    if any(math.hypot(x-cx,y-cy)<R+0.6 for cx,cy,R,Hm in HILLS): return False
    if math.hypot(x-DK[0],y-DK[1])<2.8 or math.hypot(x-PX,y-PY)<2.0 or math.hypot(x-STAND[0],y-STAND[1])<3.2: return False
    u=(dx*(-bx)+dy*(-by)); v=dx*tx+dy*ty
    if u>-2 and abs(v)<3.2: return False                      # the view down the river to the falls
    return True
for x,y,kind in [(0.6,-1.6,"m"),(-1.2,-3.8,"p"),(4.4,-1.6,"p"),(2.2,1.0,"m"),(-3.0,-6.8,"m"),(9.0,-2.6,"p"),(7.4,-0.4,"m"),
                 (-6.4,-7.0,"p"),(11.2,-6.0,"m"),(-1.4,-11.8,"p"),(12.4,-9.6,"p"),(-9.4,-12.2,"m"),(4.6,-14.2,"p"),(14.0,-13.4,"m"),
                 (-4.4,-14.6,"p"),(9.6,-13.6,"p"),(-7.6,-3.4,"m"),(6.6,-11.0,"m"),(14.4,-6.4,"p"),(-13.6,-14.0,"p"),(-2.8,-15.4,"m"),(14.6,-15.0,"p")]:
    if not ok_floor(x,y) or not free(x,y,1.4): continue
    placed.append((x,y))
    if kind=="m": maple(x,y,0.0,rng.uniform(0.85,1.0))
    else: pine(x,y,0.0,rng.uniform(0.9,1.05))
for x,y,s in [(5.0,-9.0,0.8),(-5.8,-11.0,0.9),(11.6,-12.4,0.7),(1.8,-6.0,0.6),(-2.0,-8.6,0.7),(13.0,-3.4,0.8)]:
    if ok_floor(x,y): boulder(x,y,s,"scree","rock")

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/kegon-falls.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=FH; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y): return 0.0     # the cliffs are solid, not walkable; the game draws the ground (terrainSurface)
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
INTERACT=DK          # the observation deck facing the falls
# STAND (set above, kept clear of trees): the gorge floor below the river's end
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]],"terrainSurface":True}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/kegon-falls.json"
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
    objname=key if key.startswith("glow_") else "kegon_"+key
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
