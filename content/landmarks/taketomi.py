# Taketomi Island (the red-tiled village, its coral-stone walls and white-sand lanes, shisa on the roofs, the water-buffalo cart, the Nagomi lookout) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python taketomi.py
# Rebuilds content/landmarks/taketomi.blend and public/models/landmarks/taketomi.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/taketomi.glb"
BLEND=ROOT+"/content/landmarks/taketomi.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"tile":"c8553a","white":"f2efe6","coral":"9e9a90","sand":"ece4cc","grass":"6f9a4a","dark":"3a3430","leaf":"3f7a42","tile2":"a8503c","buffalo":"4a4440","wood":"8a6a4a","water":"2a6a8a","bark":"5a4a3a"}
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
rng=random.Random(53)
EXTRA_SOLIDS=[]; NOSOLID={"leaf","flower"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the island village
B.setdefault("tile",([],[]))
# ---- shared by the open-sea landmarks: the region's water level, the sea floor, the drawn sea, and helpers to lay
# out geometry in the rotated (u toward the camera, v screen-right) frame and to draw a ground mesh of its own
LV=-0.75; FLOOR=LV-0.5; TERRAIN_SURFACE=False; EDGE_LEVEL=LV
S2=math.sqrt(0.5)
def to_xy(u,v): return (S2*(u+v),S2*(v-u))
def to_uv(x,y): return (S2*(x-y),S2*(x+y))
def F(u,v,rot=0.0,cz=0.0): x,y=to_xy(u,v); return dict(cx=x,cy=y,cz=cz,rot=math.pi/4+rot)   # local x along v, local -y toward the camera
def ubox(mat,u,v,z0,z1,hu,hv,rot=0.0): box(mat,0,0,z0,z1,hv,hu,F(u,v,rot))
def tube(mat,pts,rs,n=6):
    rings=[]
    for k,p in enumerate(pts):
        a=pts[max(k-1,0)]; b=pts[min(k+1,len(pts)-1)]
        d=Vector(b)-Vector(a); d.normalize()
        w0=d.cross(Vector((0,0,1))) if abs(d.z)<0.95 else d.cross(Vector((1,0,0)))
        w0.normalize(); w1=d.cross(w0)
        rings.append([tuple(Vector(p)+rs[k]*(math.cos(2*math.pi*i/n)*w0+math.sin(2*math.pi*i/n)*w1)) for i in range(n)])
    solid(rings,mat)
def draw_sea(mat="water"):
    emit([(-FH,-FH,LV-0.04),(FH,-FH,LV-0.04),(FH,FH,LV-0.04),(-FH,FH,LV-0.04)],[[0,1,2,3]],[mat],orient=False)   # fills shore tiles the game keeps as land
def draw_ground(H,mat,step=0.7,jit=0.18,skip=None):
    """A ground mesh of the model's own over the footprint, triangles coloured by mat(x,y,h,slope); triangles wholly
    below the drawn sea are left out."""
    N=int(round(2*FH/step)); step=2*FH/N; g={}
    for j in range(N+1):
        for i in range(N+1):
            x,y=-FH+i*step,-FH+j*step
            if 0<i<N and 0<j<N: x+=rng.uniform(-jit,jit); y+=rng.uniform(-jit,jit)
            g[(i,j)]=(x,y,H(x,y))
    vs=[];ix={}
    for k,v in g.items(): ix[k]=len(vs); vs.append(v)
    fs=[];ms=[]
    for j in range(N):
        for i in range(N):
            a,b,c,d=(i,j),(i+1,j),(i+1,j+1),(i,j+1)
            for t in ([(a,b,c),(a,c,d)] if (i+j)%2==0 else [(a,b,d),(b,c,d)]):
                ps=[g[k] for k in t]; hs=[p[2] for p in ps]
                if max(hs)<LV-0.06: continue
                cx,cy=sum(p[0] for p in ps)/3,sum(p[1] for p in ps)/3
                if skip and skip(cx,cy): continue
                fs.append([ix[k] for k in t]); ms.append(mat(cx,cy,sum(hs)/3,(max(hs)-min(hs))/step))
    emit(vs,fs,ms)
def shore(h_land,m,edge=0.9,fall=1.08):
    """Height across a shoreline: h_land inside (m<edge), the water's edge at m=1, the sea floor beyond m=fall."""
    if m<edge: return h_land
    if m<1.0: return h_land+((LV+0.08)-h_land)*smooth(edge,1.0,m)
    return (LV+0.08)+(FLOOR-(LV+0.08))*smooth(1.0,fall,m)
# ---- Taketomi: a flat coral island, its village of low houses under red tile, each in its plot walled with grey coral
# stones along lanes of white sand; a water-buffalo cart in the lanes, the Nagomi lookout, a beach and pier
TOP=0.15
def isl_m(u,v): return ((abs(u)/9.2)**2.4+(abs(v)/9.0)**2.4)**(1/2.4)*(1+0.04*math.sin(4*math.atan2(v,u)+0.3))
def H(x,y):
    u,v=to_uv(x,y); return shore(TOP,isl_m(u,v),0.87,1.08)
def water_disc(x,y): return False
LANES_U=[-4.4,-0.8,2.8]; LANES_V=[-4.4,-1.0,2.4,5.8]       # lane centre lines, 1.0 wide
APPROACH=[(7.9,1.2),(6.6,1.2),(6.0,2.0),(5.4,2.4)]       # the lane in from the beach, bending round the corner lot
def seg_d(u,v,a,b):
    du,dv=b[0]-a[0],b[1]-a[1]; t=max(0.0,min(1.0,((u-a[0])*du+(v-a[1])*dv)/(du*du+dv*dv)))
    return math.hypot(u-a[0]-t*du,v-a[1]-t*dv)
def app_d(u,v): return min(seg_d(u,v,a,b) for a,b in zip(APPROACH,APPROACH[1:]))
def in_lane(u,v): return any(abs(u-a)<0.6 for a in LANES_U) or any(abs(v-b)<0.6 for b in LANES_V) or app_d(u,v)<0.6
def gmat(x,y,h,sl):
    u,v=to_uv(x,y); m=isl_m(u,v)
    if m>0.86 or h<TOP-0.05: return "sand"
    if m<0.83 and in_lane(u,v): return "sand"
    return "grass"
draw_ground(H,gmat,0.55,0.1)
draw_sea()
# the plots: coral-stone walls, a house with its red hip roof and white-mortared ridges, a shisa on top, a hibiscus
def tree(u,v,s):
    x,y=to_xy(u,v); T3=dict(cx=x,cy=y,cz=TOP,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.13,-0.3,5),ngon(0.09,1.4,5)],"bark",T3)
    ico("leaf",0,0,1.9,0.8,0.75,1.0,T3)
def hip(cu_,cv_,w,d,z0,rp,rm):
    T=F(cu_,cv_); nb=len(B[rm][0]) if rm in B else 0
    flared_roof([(w+0.35,d+0.35,z0,0.04),(w+0.35,d+0.35,z0+0.07,0.04),(w*0.35,d*0.12,z0+rp,0.0)],rm,0,0)
    bv=B[rm][0]
    for i in range(nb,len(bv)):
        x,y,z=bv[i]; bv[i]=(*xf([(x,y,z)],**T)[0][:2],z)
    box("white",0,0,z0+rp-0.05,z0+rp+0.05,w*0.38,0.06,T)
    return T
def plot(u0,v0,su,sv,k):
    hu,hv=su/2,sv/2; cu,cv=u0+hu,v0+hv
    gap=0.45
    walls=[((cu-hu,cv-hv),(cu-hu,cv+hv)),((cu-hu,cv+hv),(cu+hu,cv+hv)),((cu+hu,cv-hv),(cu-hu,cv-hv))]
    # the front (toward the camera, +u) wall has the gate gap
    walls+=[((cu+hu,cv-hv),(cu+hu,cv-gap)),((cu+hu,cv+gap),(cu+hu,cv+hv))]
    front=cu+hu>3.0                                      # the plots facing the approach get taller, bolder walls
    for (ua,va),(ub,vb) in walls:
        L=math.hypot(ub-ua,vb-va); n=max(1,int(L/(0.72 if front else 0.8)))
        for j in range(n):
            t=(j+0.5)/n; u,v=ua+(ub-ua)*t,va+(vb-va)*t
            x,y=to_xy(u,v); hh=rng.uniform(0.62,0.8) if front else rng.uniform(0.42,0.56)
            prism("coral",x,y,TOP-0.05,TOP+hh,0.42 if front else 0.38,0.32 if front else 0.28,5,rng.uniform(0,1))
    if k%6==4:                                           # a lot kept as a garden: no house, a fukugi and a hibiscus
        tree(cu-0.3,cv-0.4,0.8); x,y=to_xy(cu+0.4,cv+0.5); ico("leaf",x,y,TOP+0.4,0.5,0.45,0.4); ico("tile",x+0.15,y-0.1,TOP+0.7,0.15,0.15,0.12)
        return
    ubox("coral",cu+hu-0.75,cv,TOP,TOP+0.75,0.12,0.42)             # the hinpun screen inside the gate
    # no two houses alike: size, place in the plot and roof pitch all vary; some have a wing, many an outbuilding
    w,d=hv*rng.uniform(0.42,0.68),hu*rng.uniform(0.38,0.58); hc=cu-0.25+rng.uniform(-0.3,0.1)
    side=1 if rng.random()<0.5 else -1
    cv=cv+side*rng.uniform(0.0,0.35)*max(0.0,hv-w-0.35)
    rp=rng.uniform(0.5,0.85); rm="tile2" if rng.random()<0.4 else "tile"
    ubox("white",hc,cv,TOP,TOP+0.85,d,w)
    for j in range(3): ubox("dark",hc+d+0.01,cv-w*0.6+w*0.6*j,TOP+0.15,TOP+0.7,0.01,w*0.22)
    T=hip(hc,cv,w,d,TOP+0.85,rp,rm)
    zr=TOP+0.85+rp; sx_,sy_=xf([(0,-d*0.45,0)],**T)[0][:2]                 # the shisa on the ridge, toward the lane
    box("wood",sx_,sy_,zr-0.25,zr-0.03,0.08,0.08); ico("wood",sx_,sy_,zr+0.05,0.09,0.09,0.09)
    r=rng.random()
    if r<0.3 and hv-w>0.9:                               # a lower wing to one side
        ww=min(0.5,hv-w-0.45); wd=d*0.7; wv=cv-side*(w+ww+0.05)
        ubox("white",hc+0.15,wv,TOP,TOP+0.65,wd,ww); hip(hc+0.15,wv,ww,wd,TOP+0.65,rp*0.7,rm)
    elif r<0.75:                                         # an outbuilding in a corner, front or back
        ou=(cu-hu+0.55) if rng.random()<0.5 else (cu+hu-0.6); ov=cv-side*(hv-0.55)
        ubox("white" if r<0.5 else "coral",ou,ov,TOP,TOP+0.55,0.3,0.36); hip(ou,ov,0.36,0.3,TOP+0.55,0.38,"tile2" if rm=="tile" else "tile")
    if rng.random()<0.4:
        tree(cu-hu+0.5,cv+side*(hv-0.5),rng.uniform(0.6,0.8))
PLOTS=[]
for i in range(len(LANES_U)+1):
    ua=[-8.0]+[a+0.6 for a in LANES_U]; ub=[a-0.6 for a in LANES_U]+[5.8]
    for j in range(len(LANES_V)+1):
        va=[-7.8]+[b+0.6 for b in LANES_V]; vb=[b-0.6 for b in LANES_V]+[7.8]
        u0,u1,v0,v1=ua[i],ub[i],va[j],vb[j]
        nu=max(1,int((u1-u0)/2.3)); nv=max(1,int((v1-v0)/2.3))
        for a in range(nu):
            for b in range(nv):
                pu0=u0+(u1-u0)*a/nu; pv0=v0+(v1-v0)*b/nv; su=(u1-u0)/nu; sv=(v1-v0)/nv
                cu,cv=pu0+su/2,pv0+sv/2
                if isl_m(cu,cv)>0.72 or max(isl_m(cu+a2*su/2,cv+b2*sv/2) for a2 in (-1,1) for b2 in (-1,1))>0.86: continue
                if app_d(cu,cv)<1.0: continue
                k_=len(PLOTS)
                if k_%5==2: pu0+=0.35*(1 if k_%2 else -1); su-=0.35      # a few lots sit off the grid
                if k_%7==3: pv0+=0.3; sv-=0.3
                PLOTS.append((pu0,pv0,su,sv))
for k,(u0,v0,su,sv) in enumerate(PLOTS):
    if k==len(PLOTS)//2-1: continue                      # leave one plot open: the Nagomi tower stands there
    plot(u0+0.1,v0+0.1,su-0.2,sv-0.2,k)
u0,v0,su,sv=PLOTS[len(PLOTS)//2-1]; NU,NV=u0+su/2,v0+sv/2
ubox("coral",NU,NV,TOP,TOP+1.1,0.75,0.75)
for k in range(5): ubox("coral",NU+0.9+0.2*k,NV,TOP,TOP+1.1-0.22*k,0.1,0.35)
for su_ in (-0.5,0.5):
    for sv_ in (-0.5,0.5): ubox("dark",NU+su_,NV+sv_,TOP+1.1,TOP+1.75,0.04,0.04)
T=F(NU,NV); nb=len(B["tile"][0])
flared_roof([(0.85,0.85,TOP+1.75,0.06),(0.85,0.85,TOP+1.82,0.06),(0.08,0.08,TOP+2.35,0.0)],"tile",0,0)
bv=B["tile"][0]
for i in range(nb,len(bv)):
    x,y,z=bv[i]; bv[i]=(*xf([(x,y,z)],**T)[0][:2],z)
# the water-buffalo cart in the lane before the camera
ANIMALS=[]
def cart(u,v,ang):
    T2=F(u,v,ang,TOP)
    bx,by,_=xf([(1.2,0,0)],**T2)[0]; ANIMALS.append(("buffalo",bx,by,TOP,T2["rot"],0.8,{}))   # in the shafts
    for sy in (-1,1): tube("white",[(*xf([(1.42,sy*0.1,0.68)],**T2)[0][:2],TOP+0.68),(*xf([(1.5,sy*0.3,0.82)],**T2)[0][:2],TOP+0.82)],[0.03,0.015],4)
    box("wood",-0.3,0,0.3,0.42,0.75,0.42,T2)
    for sy in (-1,1):
        x,y,_=xf([(-0.3,sy*0.47,0)],**T2)[0]; prism("dark",x,y,TOP,TOP+0.56,0.06,0.06,6)
    for sx in (-0.95,0.35):
        for sy in (-0.38,0.38): box("wood",sx,sy,0.42,1.05,0.03,0.03,T2)
    box("tile",-0.3,0,1.05,1.12,0.8,0.48,T2)
    box("wood",0.4,0,0.36,0.42,0.6,0.05,T2)
cart(LANES_U[2]+0.0,0.3,math.pi/2)
# fukugi windbreak trees and hibiscus along the shore, a pier to the beach
a=0.0; tp=[]
while a<2*math.pi-0.1 and len(tp)<26:                    # fukugi in clumps and gaps, not a ring of evenly set posts
    a+=rng.choice((0.12,0.16,0.2,0.24,0.5,0.7)); r=rng.uniform(0.76,0.86)
    u=9.4*r*math.cos(a); v=9.0*r*math.sin(a)
    if u>5.0 and abs(v-1.2)<3.2: continue
    if isl_m(u,v)>0.86 or app_d(u,v)<1.0: continue
    tp.append((u,v)); tree(u,v,rng.uniform(0.7,1.05))
JD=LV+0.3; JU0,JU1,JV=8.0,9.8,1.2
def on_jetty(u,v): return JU0<=u<=JU1 and abs(v-JV)<=0.5
ubox("coral",(JU0+JU1)/2,JV,FLOOR,JD,(JU1-JU0)/2,0.5)
def ground_at(x,y):
    u,v=to_uv(x,y)
    if on_jetty(u,v): return max(JD,H(x,y))
    return H(x,y)
INTERACT=to_xy(6.4,1.2)   # where the lane meets the beach path
STAND=to_xy(7.0,2.0)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/taketomi.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/taketomi.json"
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
    objname=key if key.startswith("glow_") else "taketomi_"+key
    me=bpy.data.meshes.new(objname); me.from_pydata(vs,[],fs); me.validate(); me.update()
    for p in me.polygons: p.use_smooth=False
    me.materials.append(getmat(matname))
    ob=bpy.data.objects.new(objname,me); col.objects.link(ob)
    stats[objname]=sum(len(p.vertices)-2 for p in me.polygons)
    allv+= [v.co.copy() for v in me.vertices]
# ---- the animals are anchors (name_N, a collider and a heading): the game draws them with its shared animal models, the ones
# the wild animals use, so they match the world. Anything on an anchor is replaced, so only the position matters here.
_counts={}
for _sp,_x,_y,_z,_rot,_sc,_props in ANIMALS:
    _counts[_sp]=_counts.get(_sp,0)+1
    _ob=bpy.data.objects.new(f"{_sp}_{_counts[_sp]}",None); col.objects.link(_ob)
    _ob.location=(_x,_y,_z); _ob.rotation_euler.z=_rot; _ob.scale=(_sc,_sc,_sc)
    _ob["collisionRadius"]=0.3; _ob["collisionHalfLength"]=0.0
    for _k,_v in _props.items(): _ob[_k]=_v
mn=[min(v[i] for v in allv) for i in range(3)]; mx=[max(v[i] for v in allv) for i in range(3)]
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', export_yup=True, export_apply=True,
    export_cameras=False, export_lights=False, export_extras=True, export_animations=False, export_materials='EXPORT')
clr=min(math.hypot(s[0]-STAND[0],s[1]+STAND[1])-s[2] for s in solids)
res={"stand_clear":round(clr,3),"tris":sum(stats.values()),"per_obj":stats,"materials":len(bpy.data.materials),"min":[round(v,3) for v in mn],"max":[round(v,3) for v in mx],"glb_bytes":os.path.getsize(GLB)}
json.dump(res,open("/tmp/lm_build.json","w"))
