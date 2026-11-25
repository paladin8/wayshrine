# Enoshima and the Sea Candle landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python enoshima-lighthouse.py
# Rebuilds content/landmarks/enoshima-lighthouse.blend and public/models/landmarks/enoshima-lighthouse.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/enoshima-lighthouse.glb"
BLEND=ROOT+"/content/landmarks/enoshima-lighthouse.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"terrain":"86a75e","snow":"f1f4f6","water":"3fb2bd","foliage":"5f9a52","darkstone":"7f7a74","cream":"e8dcb0","stone":"a39e98","vermilion":"d96b59","roof":"2a2424","wood":"d1ab80","blossom":"f2b6c4","glow_cream":"e8dcb0"}
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
rng=random.Random(8)
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
EXTRA_SOLIDS=[]
HILL=2.6
LV=-0.6          # the water region's level below the plateau (landmarkWaterLevel in terrain-grid.ts)
FLOOR=LV-0.5

# ---- the footprint: Enoshima in open water. The sea runs out to the edge all round at the region's water
# level, so the model slots into the game's water; wooded top, rocky cliffs and shore, a jetty to land at.
IC=(-0.7,1.1); IRX,IRY=6.0,5.6
def isl_m(x,y):
    dx=(x-IC[0])/IRX; dy=(y-IC[1])/IRY; th=math.atan2(dy,dx)
    return math.hypot(dx,dy)/(1+0.07*math.sin(3*th+0.5)+0.05*math.sin(5*th+1.7)+0.03*math.sin(8*th))
def H0(x,y):
    m=isl_m(x,y)
    land=LV+0.12+(HILL-LV-0.12)*smooth(0.98,0.45,m)
    k=smooth(0.98,1.08,m); return land*(1-k)+FLOOR*k
TERR=[(2.6,0.0,1.0)]                 # a level shelf cut into the slope for the shrine hall
TERR=[(cx,cy,r,H0(cx,cy)) for cx,cy,r in TERR]
def H(x,y):
    h=H0(x,y); m=isl_m(x,y)
    for cx,cy,r,lv in TERR:
        w=smooth(r+0.7,r,math.hypot(x-cx,y-cy))*smooth(0.95,0.8,m); h=h*(1-w)+lv*w
    return h

GS=0.8; NG=24
gv={}
for j in range(NG+1):
    for i in range(NG+1):
        x=-9.6+i*GS; y=-9.6+j*GS
        if 0<i<NG and 0<j<NG:
            x+=rng.uniform(-0.22,0.22); y+=rng.uniform(-0.22,0.22)
        z=H(x,y)
        if 0<i<NG and 0<j<NG and LV+0.4<z<HILL-0.3 and min(math.hypot(x-t[0],y-t[1])-t[2] for t in TERR)>0.3: z+=rng.uniform(-0.15,0.15)
        gv[(i,j)]=(x,y,z)
gverts=[]; gid={}
for k,v in gv.items(): gid[k]=len(gverts); gverts.append(v)
def area2(a,b,c): return (b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1])
gf=[]; gm=[]
for j in range(NG):
    for i in range(NG):
        a,b,c,d4=(i,j),(i+1,j),(i+1,j+1),(i,j+1)
        tr=[(a,b,c),(a,c,d4)] if (i+j)%2==0 else [(a,b,d4),(b,c,d4)]
        for t3 in tr:
            P=[Vector(gv[k]) for k in t3]
            if area2(*P)<=1e-4: continue
            n=(P[1]-P[0]).cross(P[2]-P[0]).normalized()
            zc=(P[0].z+P[1].z+P[2].z)/3
            gf.append([gid[k] for k in t3]); gm.append("darkstone" if (abs(n.z)<0.8 or zc<LV+0.35) else "terrain")
emit(gverts,gf,gm,orient=False)
# the sea, just under the game's own water tiles: it fills any tile the game keeps as land along the shore
emit([(-9.6,-9.6,LV-0.04),(9.6,-9.6,LV-0.04),(9.6,9.6,LV-0.04),(-9.6,9.6,LV-0.04)],[[0,1,2,3]],["water"],orient=False)

# boulders along the shore
def rock(cx,cy,cz,r):
    ico("darkstone",0,0,0,r*rng.uniform(0.95,1.25),r*rng.uniform(0.8,1.05),r*0.7,dict(cx=cx,cy=cy,cz=cz,rot=rng.uniform(0,6.28)))
for k in range(18):
    th=2*math.pi*k/18+rng.uniform(-0.1,0.1)
    if abs(math.atan2(math.sin(th+math.pi/4),math.cos(th+math.pi/4)))<0.45: continue   # keep the landing clear
    r=1.0; x=IC[0]+IRX*r*math.cos(th); y=IC[1]+IRY*r*math.sin(th)
    rock(x,y,LV,rng.uniform(0.3,0.55))

# ---- the landing: a wooden jetty out from the front shore
J0=(3.25,-2.85); J1=(4.75,-4.35); JD=LV+0.28
jx,jy=J1[0]-J0[0],J1[1]-J0[1]; JL=math.hypot(jx,jy); jh=math.atan2(jy,jx)
def jetty_d(x,y):
    t=max(0.0,min(1.0,((x-J0[0])*jx+(y-J0[1])*jy)/(JL*JL)))
    return math.hypot(x-(J0[0]+jx*t),y-(J0[1]+jy*t)), t
box("wood",0,0,JD-0.1,JD,JL/2+0.2,0.42,dict(cx=(J0[0]+J1[0])/2,cy=(J0[1]+J1[1])/2,rot=jh))
for k in range(4):
    t=k/3
    for sy in (-1,1):
        px=J0[0]+jx*t-math.sin(jh)*sy*0.36; py=J0[1]+jy*t+math.cos(jh)*sy*0.36
        prism("wood",px,py,FLOOR,JD+0.12,0.06,0.06,6,0)

# ---- the climb: a vermilion torii at the top of the shore, stone steps up the slope, a small shrine hall
def torii(cx,cy,cz,s,rot=0,down=0.15):
    T=dict(cx=cx,cy=cy,cz=cz,rot=rot,s=s); d=down/s
    for sx in (-1,1):
        x=sx*0.95
        prism("vermilion",x,0,-d,2.38,0.12,0.115,6,0,T)
        prism("roof",x,0,-d,0.32,0.145,0.145,6,0,T)
    box("vermilion",0,0,1.92,2.08,1.18,0.07,T)
    box("roof",0,0,2.34,2.50,1.24,0.11,T)
    extrude_y("roof",[(-1.36,2.50),(1.36,2.50),(1.56,2.75),(0.7,2.66),(-0.7,2.66),(-1.56,2.75)],-0.15,0.15,T)
# tunnel: 14 torii along the curve, shrinking and closing up toward the summit,
# with slight donor-to-donor variation in size and spacing
TX,TY=-1.0,1.5; TZ=H(TX,TY)
P0=(2.85,-2.45); P1=(0.24,0.24)
torii(P0[0]+0.2,P0[1]-0.2,H(P0[0]+0.2,P0[1]-0.2),0.72,math.pi/4,down=0.3)
NS=13
h=math.atan2(P1[1]-P0[1],P1[0]-P0[0])
for k in range(NS+1):
    t=k/NS; x=P0[0]+(P1[0]-P0[0])*t; y=P0[1]+(P1[1]-P0[1])*t
    hs=[H(x+math.cos(h)*dx-math.sin(h)*dy,y+math.sin(h)*dx+math.cos(h)*dy) for dx in (-0.2,0.2) for dy in (-0.45,0.45)]
    box("stone",0,0,min(hs)-0.12,max(hs)+0.04,0.2,0.45,dict(cx=x,cy=y,rot=h),mt="cream")
SHX,SHY=2.6,0.0; SZ=H(SHX,SHY)
hs=[H(SHX+dx,SHY+dy) for dx in (-0.9,0.9) for dy in (-0.75,0.75)]
box("stone",SHX,SHY,min(hs)-0.2,max(hs)+0.12,0.95,0.8); SZ=max(hs)+0.12
box("vermilion",SHX,SHY,SZ,SZ+0.95,0.65,0.5)
box("roof",SHX,SHY-0.52,SZ+0.1,SZ+0.75,0.3,0.03)
extrude_x("roof",[(SHY-0.85,SZ+0.92),(SHY+0.85,SZ+0.92),(SHY+0.85,SZ+1.02),(SHY,SZ+1.5),(SHY-0.85,SZ+1.02)],SHX-0.9,SHX+0.9)

# ---- the Sea Candle on the summit, after photos: a cone of 14 near-vertical white columns tied by rings, widening
# upward, a spiral stair round the core, a bulging glass observation drum with the outdoor deck on its roof,
# the small glass lamp room and a tall lightning rod
prism("wood",TX,TY,TZ-0.25,TZ+0.12,1.75,1.75,8,math.pi/8)          # Sunset Terrace deck
prism("snow",TX,TY,TZ+0.1,TZ+0.5,0.85,0.85,8,math.pi/8)            # entrance building
prism("water",TX,TY,TZ+0.18,TZ+0.42,0.87,0.87,8,math.pi/8)
Z0=TZ+0.5; Z1=TZ+3.9
prism("snow",TX,TY,Z0,Z1,0.2,0.2,8,0)                             # core with the lift
def tube(p,q,r,mat,n=4):
    a=Vector(p); b=Vector(q); t=(b-a).normalized(); u=t.cross(Vector((0,0,1))).normalized(); v=u.cross(t).normalized()
    ring=lambda c:[tuple(c+r*(math.cos(2*math.pi*k/n+0.785)*u+math.sin(2*math.pi*k/n+0.785)*v)) for k in range(n)]
    solid([ring(a),ring(b)],mat)
NH=54; TURNS=4.5
hp=[(TX+0.38*math.cos(2*math.pi*TURNS*k/NH),TY+0.38*math.sin(2*math.pi*TURNS*k/NH),Z0+0.1+(Z1-Z0-0.2)*k/NH) for k in range(NH+1)]
for k in range(NH): tube(hp[k],hp[k+1],0.05,"stone")                # spiral stair
def cr(t): return 0.42+0.6*t**1.25
NL=14; NSEG=5
for i in range(NL):
    a=2*math.pi*i/NL
    pts=[(TX+cr(k/NSEG)*math.cos(a),TY+cr(k/NSEG)*math.sin(a),Z0+(Z1-Z0)*k/NSEG) for k in range(NSEG+1)]
    for k in range(NSEG): tube(pts[k],pts[k+1],0.045,"snow")
for t in (1/6,2/6,3/6,4/6,5/6):                                     # rings
    z=Z0+(Z1-Z0)*t; r=cr(t)
    solid([ngon(r+0.05,z,14,0,TX,TY),ngon(r+0.05,z+0.05,14,0,TX,TY)],"snow",mb=None,mt=None)
    solid([ngon(r-0.03,z,14,0,TX,TY),ngon(r-0.03,z+0.05,14,0,TX,TY)],"snow",mb=None,mt=None)
solid([ngon(cr(1),Z1,16,0,TX,TY),ngon(1.2,Z1+0.22,16,0,TX,TY),ngon(1.18,Z1+0.32,16,0,TX,TY)],"snow")   # bulging base
prism("water",TX,TY,Z1+0.32,Z1+0.86,1.1,1.1,16,0)                   # glass observation room
prism("snow",TX,TY,Z1+0.86,Z1+0.96,1.17,1.17,16,0)                  # roof: the outdoor deck
for k in range(16):
    a=2*math.pi*k/16; box("snow",TX+1.13*math.cos(a),TY+1.13*math.sin(a),Z1+0.96,Z1+1.2,0.03,0.03)
prism("snow",TX,TY,Z1+0.96,Z1+1.06,0.5,0.5,8,0)
prism("glow_lighthouse",TX,TY,Z1+1.06,Z1+1.46,0.42,0.36,8,0)        # the glass lamp room
cone("snow",ngon(0.46,Z1+1.46,8,0,TX,TY),(TX,TY,Z1+1.62))
prism("snow",TX,TY,Z1+1.58,Z1+2.4,0.03,0.025,4,0)                   # lightning rod

# ---- Samuel Cocking Garden: palms, flower beds, hedges and the glasshouse
def palm(cx,cy,s,lean):
    g=H(cx,cy); T=dict(cx=cx,cy=cy,cz=g,rot=lean,s=s)
    solid([ngon(0.12,-0.2,6),ngon(0.1,0.8,6,0,0.12,0),ngon(0.09,1.6,6,0,0.32,0),ngon(0.08,2.2,6,0,0.55,0)],"wood",T)
    top=(0.55,0.0,2.2)
    for k in range(7):
        a=2*math.pi*k/7+0.3; ux,uy=math.cos(a),math.sin(a)
        ring=[(top[0]-uy*0.16,top[1]+ux*0.16,top[2]+0.02),(top[0]+uy*0.16,top[1]-ux*0.16,top[2]+0.02),(top[0]+uy*0.1,top[1]-ux*0.1,top[2]+0.1),(top[0]-uy*0.1,top[1]+ux*0.1,top[2]+0.1)]
        cone("foliage",ring,(top[0]+ux*1.0,top[1]+uy*1.0,top[2]-0.4),T)
for (x,y,s,l) in [(-3.1,3.2,0.9,2.4),(0.9,3.4,0.85,0.8),(-3.4,0.1,0.8,3.6),(1.4,0.6,0.75,5.5),(-1.6,4.4,0.8,1.6)]: palm(x,y,s,l)
for (x,y,rx,ry,m) in [(-2.6,1.4,0.55,0.35,"blossom"),(0.6,2.5,0.5,0.3,"blossom"),(-1.9,3.4,0.45,0.3,"cream"),(-2.4,-0.6,0.45,0.28,"cream")]:
    g=H(x,y); box(m,x,y,g-0.1,g+0.14,rx,ry); box("foliage",x,y,g-0.1,g+0.08,rx+0.12,ry+0.12)
GX,GY=-3.3,1.7; GZ=H(GX,GY)
box("snow",GX,GY,GZ-0.1,GZ+0.12,0.7,0.5)
box("water",GX,GY,GZ+0.12,GZ+0.75,0.62,0.42)
extrude_x("water",[(GY-0.45,GZ+0.75),(GY+0.45,GZ+0.75),(GY,GZ+1.05)],GX-0.62,GX+0.62)
for sx in (-1,1):
    for sy in (-1,1): box("snow",GX+sx*0.62,GY+sy*0.42,GZ+0.12,GZ+0.78,0.035,0.035)
box("snow",GX,GY,GZ+1.0,GZ+1.07,0.66,0.04)

# ---- stone lanterns (fire boxes are separate glow_ objects)
def lantern(cx,cy,idx):
    T=dict(cx=cx,cy=cy,cz=H(cx,cy))
    box("stone",0,0,-0.15,0.22,0.4,0.4,T)
    prism("stone",0,0,0.22,1.3,0.17,0.15,6,0,T)
    box("stone",0,0,1.3,1.48,0.38,0.38,T)
    box("glow_lantern_%d"%idx,0,0,1.48,1.92,0.27,0.27,T)
    solid([rect(0.62,0.62,1.92),rect(0.62,0.62,2.0),rect(0.14,0.14,2.3)],"stone",T)
    bipyr("stone",0,0,2.38,0.11,2.28,2.56,6,T)
lantern(3.75,-1.35,1); lantern(1.75,-3.35,2)

# the island is densely wooded: pines and broadleaf trees on the slopes
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
for a in [(-5.0,2.0,0.8,0.5),(-3.0,5.0,0.8,0.9),(0.6,5.4,0.75,0.3),(3.8,2.6,0.75,0.2),(-4.6,-1.3,0.8,0.7),(-2.0,-3.0,0.75,0.1),(2.6,4.2,0.7,0.6)]: conifer(*a)
for a in [(-4.0,4.2,0.75),(-3.4,-2.4,0.7),(0.9,-2.9,0.6),(4.0,-0.6,0.65)]: roundtree(*a)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/enoshima-lighthouse.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=9.6; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y):
    d,t=jetty_d(x,y)
    if d<0.45 and t>0.0: return JD
    return max(LV,H(x,y))                    # open water at the region's level; the game draws it
ground=[[round(ground_at(-HALF+GSTEP*ix, -(-HALF+GSTEP*iz)),3) for ix in range(GN)] for iz in range(GN)]
for i in range(GN): ground[0][i]=ground[GN-1][i]=ground[i][0]=ground[i][GN-1]=LV     # the edge ring is open water
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
INTERACT=(P0[0]+0.3,P0[1]-0.3)   # under the torii at the top of the shore
STAND=(4.2,-3.8)                # on the jetty
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[round(INTERACT[0],2),round(-INTERACT[1],2)],"reach":3.6,"stand":[STAND[0],-STAND[1]]}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/enoshima-lighthouse.json"
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
    objname=key if key.startswith("glow_") else "enoshima_"+key
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
