# Fushimi Inari Taisha landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python fushimi-inari.py
# Rebuilds content/landmarks/fushimi-inari.blend and public/models/landmarks/fushimi-inari.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
HOME=os.path.expanduser("~")
ROOT=HOME+"/coding/wayshrine"
GLB=ROOT+"/public/models/landmarks/fushimi-inari.glb"
BLEND=ROOT+"/content/landmarks/fushimi-inari.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"vermilion":"d96b59","roof":"2a2424","stone":"a39e98","cream":"e8dcb0","wood":"d1ab80","snow":"f1f4f6","foliage":"5f9a52","glow_cream":"e8dcb0"}
def lin(h):
    o=[]
    for i in (0,2,4):
        c=int(h[i:i+2],16)/255
        o.append(c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4)
    return o+[1.0]

# geometry buckets: material key -> (verts, faces). Every piece is a closed solid; winding is
# made outward by checking the signed volume.
B={}
def emit(verts,faces,mats):
    V=[Vector(v) for v in verts]
    vol=0.0
    for f in faces:
        a=V[f[0]]
        for i in range(1,len(f)-1):
            vol+=a.dot(V[f[i]].cross(V[f[i+1]]))
    if vol<0: faces=[list(reversed(f)) for f in faces]
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

import random
rng=random.Random(8)
FLOORS=[]   # (x0,x1,y0,y1,top): flat surfaces the player can walk on, for the game sidecar
FH=11.2     # footprint half-width (the sidecar's half): the middle size, for the long climb of torii
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
def edge_k(x,y,w):
    # 0 on the footprint's edge (square with chamfered corners), easing to 1 over w units inward,
    # so the sidecar's outer ring is exactly the base height and the game terrain blends from one level
    d=min(FH-abs(x),FH-abs(y),(2*FH-1.2-abs(x)-abs(y))/math.sqrt(2))
    return smooth(0.0,w,d)

# ---- tunnel centreline: straight up the gate platform from the top of the steps, bend right, run up the slope,
# bend left to the summit
SEGS=[(5.3,0.0),(3.4*math.radians(65),-1/3.4),(2.4,0.0),(3.4*math.radians(55),1/3.4)]
PATH_L=sum(l for l,k in SEGS)
def P(s):
    x,y,h=0.0,-5.6,math.pi/2
    for l,k in SEGS:
        u=min(s,l)
        if k==0: x+=u*math.cos(h); y+=u*math.sin(h)
        else:
            x+=(math.sin(h+k*u)-math.sin(h))/k; y-=(math.cos(h+k*u)-math.cos(h))/k; h+=k*u
        s-=u
        if s<=0: break
    return x,y,h
EX,EY,EH=P(PATH_L)
SHX,SHY=EX+2.2*math.cos(EH),EY+2.2*math.sin(EH)   # main shrine on the summit, facing down the path
SHROT=EH-math.pi/2

# ---- hill: low-poly heightfield peaking at the main shrine
def Ha(x,y):
    dd=math.hypot(x-SHX,y-SHY)
    ramp=0.97+0.8*smooth(-1.0,6.5,y)       # meets the gate platform (z=1), rises gently toward the back
    cone=3.37-0.319*max(0.0,dd-2.4)        # even-grade mound up to a flat summit for the main shrine
    return (0.03+max(ramp,cone))*edge_k(x,y,2.2)
NX,NY=19,13
GX=[-FH+2*FH*i/(NX-1) for i in range(NX)]; GYS=[-1.0+(FH+1.0)*j/(NY-1) for j in range(NY)]
gv={}
for j in range(NY):
    for i in range(NX):
        x,y=GX[i],GYS[j]
        if 0<i<NX-1 and 0<j<NY-1:
            x+=rng.uniform(-0.25,0.25); y+=rng.uniform(-0.22,0.22)
            jz=rng.uniform(-0.12,0.12)
        else: jz=0.0
        gv[(i,j)]=(x,y,Ha(x,y)+(jz if math.hypot(x-SHX,y-SHY)>2.8 else 0.0))
verts=[]; vid={}
for key,v in gv.items(): vid[key]=len(verts); verts.append(v)
faces=[]; TRIS=[]
for j in range(NY-1):
    for i in range(NX-1):
        a,b,c,dq=(i,j),(i+1,j),(i+1,j+1),(i,j+1)
        tr=[(a,b,c),(a,c,dq)] if (i+j)%2==0 else [(a,b,dq),(b,c,dq)]
        for t3 in tr:
            faces.append([vid[k] for k in t3]); TRIS.append(tuple(gv[k] for k in t3))
loop=[(i,0) for i in range(NX)]+[(NX-1,j) for j in range(1,NY)]+[(i,NY-1) for i in range(NX-2,-1,-1)]+[(0,j) for j in range(NY-2,0,-1)]
bot={}
for k in loop:
    x,y,_=gv[k]; bot[k]=len(verts); verts.append((x,y,-0.02))
for n in range(len(loop)):
    a,b=loop[n],loop[(n+1)%len(loop)]
    faces.append([bot[a],bot[b],vid[b],vid[a]])
faces.append([bot[k] for k in reversed(loop)])
ntop=len(TRIS)
emit(verts,faces,["foliage"]*ntop+["stone"]*len(loop)+[None])   # stone retaining walls at the slab edge
def Hm(x,y):
    for (a,b,c) in TRIS:
        dd=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(dd)<1e-12: continue
        l1=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/dd
        l2=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/dd
        l3=1-l1-l2
        if l1>=-1e-6 and l2>=-1e-6 and l3>=-1e-6: return l1*a[2]+l2*b[2]+l3*c[2]
    return 0.0
H=Hm

# base slab: top at z=0, sides 1 unit below ground
def octo(z,h=FH,ch=1.2):
    # the full square footprint: no cut corners, so the model's ground meets the game's terrain all round
    return [(-h,-h,z),(h,-h,z),(h,h,z),(-h,h,z)]
solid([octo(-1.0),octo(0.0)],"stone",mb=None,mt="foliage")

# forecourt, steps, gate platform
box("cream",0,-10.275,-0.05,0.04,1.5,0.675)
box("stone",0,-4.3,-0.05,1.0,5.0,3.3)
FLOORS+=[(-1.5,1.5,-10.95,-9.6,0.04),(-5.0,5.0,-7.6,-1.0,1.0)]
for i in range(5):
    y0=-9.6+0.4*i
    box("stone",0,(y0-7.6)/2,-0.05,0.2*(i+1),1.75,(-7.6-y0)/2,mt="cream")
    FLOORS.append((-1.75,1.75,y0,-7.6,0.2*(i+1)))
box("cream",0,-4.3,0.95,1.04,1.35,3.3)

# ---- Romon gate (two storeys, dark hip roofs), drawn at full size and then scaled down and set to the left of the
# platform, off the approach: the opening of the torii tunnel is what the player sees first
GMARK={m:len(B[m][0]) for m in B}
GY=-4.4
box("cream",0,GY,0.98,1.2,3.6,1.95)
for x in (-3.0,-1.1,1.1,3.0):
    for dy in (-1.35,0,1.35):
        box("vermilion",x,GY+dy,1.2,4.35,0.18,0.18)
for sx in (-1,1):
    box("snow",sx*2.05,GY,1.2,3.75,0.78,0.07)
    box("snow",sx*3.0,GY,1.2,3.75,0.07,1.2)
for dy in (-1.35,1.35): box("vermilion",0,GY+dy,3.7,3.95,3.2,0.12)
for sx in (-1,1): box("vermilion",sx*3.0,GY,3.7,3.95,0.12,1.5)
box("vermilion",0,GY,4.25,4.55,3.35,1.65)
solid([rect(4.05,2.25,4.55,0,GY),rect(4.05,2.25,4.75,0,GY),rect(3.55,1.75,4.98,0,GY),rect(3.1,1.35,5.25,0,GY)],"roof")
box("vermilion",0,GY,5.2,5.42,3.3,1.6)
box("vermilion",0,GY,5.42,7.0,2.85,1.15)
for x in (-1.85,0,1.85): box("snow",x,GY-1.15,5.75,6.7,0.55,0.05)
for sx in (-1,1): box("snow",sx*2.85,GY,5.75,6.7,0.05,0.6)
solid([rect(3.95,2.25,6.95,0,GY),rect(3.95,2.25,7.17,0,GY),rect(3.25,1.5,7.5,0,GY),rect(2.35,0.16,8.4,0,GY)],"roof")
box("roof",0,GY,8.32,8.58,2.6,0.22)
for sx in (-1,1): frus("roof",sx*2.6,GY,8.32,8.85,0.2,0.28,0.26,0.32)
GS_,GXo,GYo=0.55,-3.7,-4.6          # turned to face the tunnel across the platform
for m,(bv,bf) in B.items():
    for i in range(GMARK.get(m,0),len(bv)):
        x,y,z=bv[i]; bv[i]=(GXo-(y-GY)*GS_,GYo+x*GS_,1.0+(z-1.0)*GS_)

# ---- torii: vermilion posts and nuki, dark kasagi, shimaki and post feet
def torii(cx,cy,cz,s,rot=0,down=0.15):
    T=dict(cx=cx,cy=cy,cz=cz,rot=rot,s=s); d=down/s
    for sx in (-1,1):
        x=sx*0.95
        prism("vermilion",x,0,-d,2.38,0.12,0.115,6,0,T)
        prism("roof",x,0,-d,0.32,0.145,0.145,6,0,T)
    box("vermilion",0,0,1.92,2.08,1.18,0.07,T)
    box("roof",0,0,2.34,2.50,1.24,0.11,T)
    extrude_y("roof",[(-1.36,2.50),(1.36,2.50),(1.56,2.75),(0.7,2.66),(-0.7,2.66),(-1.56,2.75)],-0.15,0.15,T)
# tunnel: a close-set run of torii straight up the platform framing the opening, then the line turns uphill,
# shrinking and closing up toward the summit, with slight donor-to-donor variation in size and spacing
def TG(x,y):
    h=Hm(x,y) if y>=-1.0 else 0.0
    if abs(x)<=5.0 and -7.6<=y<=-1.0: h=max(h,1.0)
    return h
NA=10; pos=[0.25+(5.0-0.25)*i/(NA-1) for i in range(NA)]
N2=15; s0=5.5; s1=PATH_L-0.35
w=[(1-0.3*i/(N2-2))*(1+rng.uniform(-0.08,0.08)) for i in range(N2-1)]
p2=[s0]
for wi in w: p2.append(p2[-1]+(s1-s0)*wi/sum(w))
pos+=p2; N=len(pos)
tun=[]
for i,s in enumerate(pos):
    x,y,h=P(s); t=i/(N-1)
    sc=(1.0-0.2*t)*(1+rng.uniform(-0.025,0.025)); rot=h-math.pi/2
    ca,sa=math.cos(rot),math.sin(rot)
    hc=TG(x,y); hp=[TG(x+sx*0.95*sc*ca,y+sx*0.95*sc*sa) for sx in (-1,1)]
    torii(x,y,hc,sc,rot,down=max(0.15,hc-min(hp)+0.15))
    tun.append((round(x,2),round(y,2),round(hc,2),round(sc,2)))
# stone steps under the tunnel
s=4.8
while s<PATH_L-0.2:
    x,y,h=P(s); rot=h-math.pi/2; ca,sa=math.cos(rot),math.sin(rot)
    hs=[TG(x+ca*dx-sa*dy,y+sa*dx+ca*dy) for dx in (-0.62,0.62) for dy in (-0.2,0.2)]+[TG(x,y)]
    box("stone",0,0,min(hs)-0.12,max(hs)+0.04,0.62,0.2,dict(cx=x,cy=y,rot=rot),mt="cream")
    s+=0.42

# ---- main shrine (honden) on the summit, nagare-style roof sweeping out over the steps
T=dict(cx=SHX,cy=SHY,rot=SHROT)
cs,sn=math.cos(SHROT),math.sin(SHROT)
hb=[Hm(SHX+cs*lx-sn*ly,SHY+sn*lx+cs*ly) for lx in (-2.0,2.0) for ly in (-2.6,1.55)]
zb=min(hb)-0.25; Z=max(hb)+0.3
box("stone",0,0,zb,Z,2.0,1.55,T)
box("stone",0,-1.8,zb,Z-0.15,1.15,0.25,T,mt="cream")
box("stone",0,-2.25,zb,Z-0.3,1.15,0.22,T,mt="cream")
box("snow",0,0,Z,Z+1.75,1.4,1.0,T)
for x in (-1.5,-0.5,0.5,1.5):
    for y in (-1.1,1.1): box("vermilion",x,y,Z,Z+1.85,0.13,0.13,T)
box("roof",0,-1.02,Z+0.1,Z+1.5,0.36,0.04,T)
for sx in (-1,1): box("vermilion",sx*1.0,-1.02,Z+0.1,Z+1.5,0.36,0.04,T)
box("vermilion",0,0,Z+1.75,Z+2.05,1.75,1.3,T)
for sx in (-1,1): box("vermilion",sx*1.0,-2.25,Z-0.3,Z+1.62,0.1,0.1,T)
extrude_x("roof",[(-2.6,Z+1.55),(1.8,Z+1.95),(1.8,Z+2.15),(-0.1,Z+3.45),(-2.6,Z+1.75)],-2.25,2.25,T)
box("roof",0,-0.1,Z+3.38,Z+3.58,2.35,0.13,T)

# ---- kitsune pair (left holds the jewel, right holds the key)
def fox(cx,cy,cz,rot,s,item):
    T=dict(cx=cx,cy=cy,cz=cz,rot=rot,s=s)
    box("cream",0,0.08,0,0.42,0.36,0.42,T)
    for sx in (-1,1): box("cream",sx*0.16,-0.36,0,0.72,0.07,0.07,T)
    frus("cream",0,-0.05,0.4,1.15,0.3,0.3,0.2,0.18,oy1=-0.12,T=T)
    box("cream",0,-0.16,1.1,1.42,0.2,0.19,T)
    solid([[(-.11,-.34,1.13),(.11,-.34,1.13),(.11,-.34,1.31),(-.11,-.34,1.31)],[(-.04,-.62,1.15),(.04,-.62,1.15),(.04,-.62,1.22),(-.04,-.62,1.22)]],"cream",T)
    for sx in (-1,1): cone("cream",rect(0.07,0.05,1.40,sx*0.11,-0.12),(sx*0.13,-0.10,1.74),T)
    solid([rect(0.13,0.12,0.25,0,0.5),rect(0.2,0.15,0.9,0,0.66),rect(0.05,0.05,1.55,0,0.5)],"cream",T)
    solid([[(-0.09,-0.40,0.78),(0.09,-0.40,0.78),(0.09,-0.32,0.78),(-0.09,-0.32,0.78)],[(-0.25,-0.34,1.12),(0.25,-0.34,1.12),(0.25,-0.08,1.12),(-0.25,-0.08,1.12)]],"vermilion",T)
    if item=="key":
        box("roof",0,-0.6,1.15,1.22,0.32,0.035,T)
        box("roof",0.3,-0.6,1.02,1.22,0.035,0.035,T)
        box("roof",-0.34,-0.6,1.08,1.29,0.08,0.035,T)
    else:
        bipyr("wood",0,-0.68,1.18,0.14,1.03,1.44,6,T)
for sx,item in ((-1,"jewel"),(1,"key")):
    px,py=sx*2.6,-10.1
    box("stone",px,py,-0.05,0.25,0.6,0.6)
    box("stone",px,py,0.25,1.05,0.48,0.48)
    box("stone",px,py,1.05,1.15,0.56,0.56)
    fox(px,py,1.15,-sx*0.26,1.15,item)

# ---- stone lanterns (fire boxes are separate glow_ objects)
def lantern(cx,cy,idx):
    T=dict(cx=cx,cy=cy)
    box("stone",0,0,-0.05,0.22,0.4,0.4,T)
    prism("stone",0,0,0.22,1.3,0.17,0.15,6,0,T)
    box("stone",0,0,1.3,1.48,0.38,0.38,T)
    box("glow_lantern_%d"%idx,0,0,1.48,1.92,0.27,0.27,T)
    solid([rect(0.62,0.62,1.92),rect(0.62,0.62,2.0),rect(0.14,0.14,2.3)],"stone",T)
    bipyr("stone",0,0,2.38,0.11,2.28,2.56,6,T)
lantern(-4.4,-9.8,1); lantern(4.4,-9.8,2)

# ---- subshrine on the terrace right of the tunnel, with a small torii
SX,SY=8.0,1.8
hs=[H(SX+dx,SY+dy) for dx in (-1.05,1.05) for dy in (-0.95,0.95)]
T0=max(hs)+0.2; Tb=min(hs)-0.25
box("stone",SX,SY,Tb,T0,1.05,0.95)
box("wood",SX,SY,T0,T0+1.15,0.7,0.6)
box("roof",SX,SY-0.6,T0+0.08,T0+0.95,0.36,0.04)
for sx in (-1,1): box("vermilion",SX+sx*0.76,SY-0.66,T0,T0+1.2,0.07,0.07)
box("vermilion",SX,SY-0.66,T0+1.04,T0+1.18,0.86,0.07)
e=T0+1.15; r=T0+1.95
extrude_x("roof",[(SY-1.0,e),(SY+1.0,e),(SY+1.0,e+0.14),(SY,r),(SY-1.0,e+0.14)],SX-1.05,SX+1.05)
box("roof",SX,SY,r-0.06,r+0.08,1.12,0.09)
torii(SX,SY-1.75,H(SX,SY-1.75),0.5,down=0.45)

# ---- vegetation (kept off the camera-side corner so the tunnel stays visible)
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
for a in [(-8.6,7.9,1.1,0),(-5.8,10.0,1.0,0.3),(-9.1,3.0,0.9,0.6),(-2.1,10.0,0.9,0.5),(0.9,10.0,0.85,0.2),(10.0,5.4,0.9,0.2),(10.0,8.6,0.85,0.8),(-9.4,-0.4,0.85,0.4),(4.0,10.1,0.9,0.6)]: conifer(*a)
for a in [(-8.9,-8.4,1.0),(-9.3,-3.0,0.9),(-3.5,3.3,0.8),(-5.1,6.5,0.85),(-0.7,5.8,0.8)]: roundtree(*a)
for f,sd,sc_ in [(0.62,1,0.8),(0.74,-1,0.85),(0.8,1,0.9),(0.9,-1,0.8),(0.93,1,0.85)]:   # the upper tunnel climbs away into the trees
    x,y,h=P(PATH_L*f); conifer(x+sd*1.9*math.cos(h-math.pi/2),y+sd*1.9*math.sin(h-math.pi/2),sc_,f)
for a in [(8.0,-9.6,1.0),(9.3,-7.5,0.8),(-6.8,-10.1,0.9),(7.7,-3.0,0.9),(-7.5,-4.9,0.8)]: bush(*a)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/fushimi-inari.json and read by the world layer.
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=FH; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y):
    h=Hm(x,y) if -1.0<=y<=FH else 0.0
    for x0,x1,y0,y1,top in FLOORS:
        if x0<=x<=x1 and y0<=y<=y1: h=max(h,top)
    return h
ground=[[round(ground_at(-HALF+GSTEP*ix, -(-HALF+GSTEP*iz)),3) for ix in range(GN)] for iz in range(GN)]
# Hm() is 0 outside the hill's triangles (the corners of the octagonal base); fill those holes from
# their neighbours so the game's terrain doesn't fall to 0 there. Rows iz <= 15 are the hill (z <= 1);
# the front (iz > 15) is legitimately flat at 0.
_hole=[(r,c) for r in range(1,16) for c in range(1,GN-1) if ground[r][c]==0.0]   # never the edge ring
for _ in range(400):
    for r,c in _hole:
        vs=[ground[rr][cc] for rr,cc in((r+1,c),(r-1,c),(r,c+1),(r,c-1)) if 0<=rr<GN and 0<=cc<GN and ground[rr][cc]>0]
        if vs: ground[r][c]=round(sum(vs)/len(vs),3)
CELL=0.3; CN=int(round(2*HALF/CELL))
cellg={}
def cg(cx,cy):
    k=(cx,cy)
    if k not in cellg: cellg[k]=ground_at(-HALF+CELL*(cx+0.5), HALF-CELL*(cy+0.5)) if False else ground_at(-HALF+CELL*(cx+0.5), -HALF+CELL*(cy+0.5))
    return cellg[k]
# cells indexed by (cx, cy) with cy over Blender y; converted to game z at the end
solid=set()
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
                    if nz>0.92 and z<g+0.6: continue   # the hill's own surface
                    solid.add((cx,cy))
solids=[[round(-HALF+CELL*(cx+0.5),2), round(-(-HALF+CELL*(cy+0.5)),2), 0.22] for cx,cy in sorted(solid)]
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[round(EX,2),round(-EY,2)],"reach":3.6,"stand":[0.0,10.3]}
import json as _json, os as _os
_p=ROOT+"/src/world/landmark-grounds/fushimi-inari.json"
_os.makedirs(_os.path.dirname(_p),exist_ok=True)
open(_p if not os.environ.get("FI_OUT") else os.environ["FI_OUT"],"w").write(_json.dumps(side,separators=(",",":")))

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
    objname=key if key.startswith("glow_") else "fushimi_"+key
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
res={"tris":sum(stats.values()),"per_obj":stats,"materials":len(bpy.data.materials),"min":[round(v,3) for v in mn],"max":[round(v,3) for v in mx],
     "tunnel":tun,"glb_bytes":os.path.getsize(GLB),"shrine":[round(SHX,2),round(SHY,2),round(math.degrees(SHROT),1),round(Z,2)],"path_len":round(PATH_L,2)}
json.dump(res,open("/tmp/fi_build.json","w"))
