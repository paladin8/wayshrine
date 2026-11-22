# Itsukushima, the floating torii landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python itsukushima-torii.py
# Rebuilds content/landmarks/itsukushima-torii.blend and public/models/landmarks/itsukushima-torii.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/itsukushima-torii.glb"
BLEND=ROOT+"/content/landmarks/itsukushima-torii.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"vermilion":"d96b59","roof":"2a2424","stone":"a39e98","cream":"e8dcb0","wood":"d1ab80","snow":"f1f4f6","foliage":"5f9a52","water":"3fb2bd","gold":"e2b34c","glow_cream":"e8dcb0"}
def lin(h):
    o=[]
    for i in (0,2,4):
        c=int(h[i:i+2],16)/255
        o.append(c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4)
    return o+[1.0]

# geometry buckets: material key -> (verts, faces). Every piece is a closed solid; winding is
# made outward by checking the signed volume.
B={}
DY=0.0   # the shrine group is authored on a slightly different footprint; shift it in y while DY is set
def emit(verts,faces,mats,orient=True):
    V=[Vector((v[0],v[1]+DY,v[2])) for v in verts]
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
rng=random.Random(4)
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
EXTRA_SOLIDS=[]   # [x, y, r] in Blender coordinates

# ---- the footprint: an islet in open water. The sea runs out to the edge all round at the region's
# water level (landmarkWaterLevel in terrain-grid.ts), so the model slots into the game's water. The
# land is an imperfect round back arc of forest with a sand beach, and the shrine's front stands out
# over an inlet of the sea.
LV=-0.6; FLOOR=LV-0.5
FH=11.2   # footprint half-width (the sidecar's half): larger than the usual 9.6, for a roomier islet
IC=(0.0,0.8); IRX,IRY,IP=10.0,9.8,3.2
def ell_m(x,y):
    # a rounded square, so the islet fills the footprint, with a little irregularity in the shoreline
    dx=abs((x-IC[0])/IRX); dy=abs((y-IC[1])/IRY); th=math.atan2(y-IC[1],x-IC[0])
    return (dx**IP+dy**IP)**(1/IP)/(1+0.4*(0.06*math.sin(3*th+0.5)+0.04*math.sin(5*th+1.7)+0.025*math.sin(8*th)))
BC=(-0.9,-2.4); BRX,BRY,BP=5.9,5.6,3.0
def bay_m(x,y):
    dx=abs((x-BC[0])/BRX); dy=abs((y-BC[1])/BRY); th=math.atan2(y-BC[1],x-BC[0])
    return (dx**BP+dy**BP)**(1/BP)/(1+0.04*math.sin(3*th+0.7)+0.03*math.sin(5*th+2.1))
def front_m(y): return 0.8-(y+4.8)*0.28   # the two arms end level with the torii, so the bay stays open to the sea
def isl_m(x,y): return max(ell_m(x,y),2.0-bay_m(x,y),front_m(y))   # 1 at the shore, below 1 on land
def H(x,y):
    m=isl_m(x,y)
    band=1.4*smooth(6.4,8.2,y)
    bump=1.6*math.exp(-((x-4.7)**2+(y-5.5)**2)/4.0)
    land=max(0.0,band,bump)
    land=(LV+0.1)+(land-(LV+0.1))*smooth(0.98,0.86,m)   # a short beach from the shore up to the level ground, where the deer roam
    k=smooth(0.98,1.05,m); return land*(1-k)+FLOOR*k

GS=0.8; NG=int(round(2*FH/GS))
gv={}
for j in range(NG+1):
    for i in range(NG+1):
        x=-FH+i*GS; y=-FH+j*GS
        if 0<i<NG and 0<j<NG:
            x+=rng.uniform(-0.22,0.22); y+=rng.uniform(-0.22,0.22)
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
            cx=sum(p[0] for p in P)/3; cy=sum(p[1] for p in P)/3
            sand=isl_m(cx,cy)>0.9 or (cx>5.0 and cy<1.5 and isl_m(cx,cy)>0.8)
            gf.append([gid[k] for k in t3]); gm.append("cream" if sand else "foliage")
emit(gverts,gf,gm,orient=False)
# the sea, just under the game's own water tiles: it fills any tile the game keeps as land along the shore
emit([(-FH,-FH,LV-0.04),(FH,-FH,LV-0.04),(FH,FH,LV-0.04),(-FH,FH,LV-0.04)],[[0,1,2,3]],["water"],orient=False)

# the landing: a short wooden jetty off the beach, where the boat comes in
J0=(7.31,-5.4); J1=(7.13,-7.8); JD=LV+0.28   # off the tip of the right arm
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

# ---- the great torii (O-torii), ryobu style, standing in the bay on the shrine's axis
T=dict(cx=0.0,cy=-5.4,s=0.9)
for sx in (-1,1):
    solid([ngon(0.5,-1.3,8,math.pi/8,sx*2.45,0),ngon(0.42,6.3,8,math.pi/8,sx*2.33,0)],"vermilion",T)   # main pillars, leaning in
    for sy in (-1,1):
        x,y=sx*2.45,sy*2.05
        solid([rect(0.2,0.2,-1.3,x,y),rect(0.17,0.17,4.25,x,y-sy*0.12)],"vermilion",T)                  # supporting legs
        solid([rect(0.33,0.3,4.25,x,y-sy*0.12),rect(0.33,0.3,4.35,x,y-sy*0.12),rect(0.06,0.3,4.62,x,y-sy*0.12)],"roof",T)  # their little roofs
        for zt in (2.0,3.65): box("vermilion",x,sy*1.02,zt,zt+0.22,0.11,1.02,T)                         # ties
box("vermilion",0,0,4.75,5.1,3.65,0.17,T)                    # nuki
box("vermilion",0,0,5.1,6.2,0.14,0.12,T)                     # centre strut
box("gold",0,0,5.25,6.1,0.42,0.1,T)                          # plaque, dark face with gilded frame
for sy in (-1,1): box("roof",0,sy*0.11,5.35,6.0,0.32,0.02,T)
box("vermilion",0,0,6.2,6.5,4.75,0.22,T)                     # shimaki
extrude_y("roof",[(-4.9,6.5),(4.9,6.5),(5.45,7.05),(5.35,7.25),(3.0,7.0),(0,6.98),(-3.0,7.0),(-5.35,7.25),(-5.45,7.05)],-0.34,0.34,T)  # kasagi

# ---- the shrine on stilts over the water: hall, open stage running out to the front lantern, corridors
DECK=0.45
BED_Z=FLOOR   # the stilts and the torii stand on the seabed
def stilts(pts):
    for x,y in pts: box("vermilion",x,y,BED_Z-0.05,DECK-0.1,0.08,0.08)
def gable_x(x0,x1,yc,hw,eave,ridge,th=0.12):   # ridge along x
    extrude_x("roof",[(yc-hw,eave),(yc+hw,eave),(yc+hw,eave+th),(yc,ridge),(yc-hw,eave+th)],x0,x1)
def gable_y(y0,y1,xc,hw,eave,ridge,th=0.12):   # ridge along y
    extrude_y("roof",[(xc-hw,eave),(xc+hw,eave),(xc+hw,eave+th),(xc,ridge),(xc-hw,eave+th)],y0,y1)
GLOWS=[]
def corridor(x0,y0,x1,y1):
    # covered walkway: plank deck, vermilion posts, gabled roof, bronze lanterns hung down the middle
    horiz=abs(y1-y0)<1e-6
    if horiz:
        xa,xb=sorted((x0,x1)); L=xb-xa; n=max(1,round(L/1.0))
        box("wood",(xa+xb)/2,y0,DECK-0.12,DECK,L/2+0.65,0.65)
        for k in range(n+1):
            x=xa+L*k/n
            for sy in (-1,1): box("vermilion",x,y0+sy*0.55,DECK,1.75,0.07,0.07)
            box("vermilion",x,y0,BED_Z-0.05,DECK-0.1,0.08,0.08)
            if k<n: GLOWS.append((x+L/(2*n),y0))
        for sy in (-1,1): box("vermilion",(xa+xb)/2,y0+sy*0.55,1.6,1.75,L/2,0.07)
        gable_x(xa-0.2,xb+0.2,y0,0.85,1.72,2.2)
    else:
        ya,yb=sorted((y0,y1)); L=yb-ya; n=max(1,round(L/1.0))
        box("wood",x0,(ya+yb)/2,DECK-0.12,DECK,0.65,L/2+0.65)
        for k in range(n+1):
            y=ya+L*k/n
            for sx in (-1,1): box("vermilion",x0+sx*0.55,y,DECK,1.75,0.07,0.07)
            box("vermilion",x0,y,BED_Z-0.05,DECK-0.1,0.08,0.08)
            if k<n: GLOWS.append((x0,y+L/(2*n)))
        for sx in (-1,1): box("vermilion",x0+sx*0.55,(ya+yb)/2,1.6,1.75,0.07,L/2)
        gable_y(ya-0.2,yb+0.2,x0,0.85,1.72,2.2)
DY=-0.9
# worship hall (haiden) and main hall (honden) behind it
box("wood",0,4.9,DECK-0.12,DECK,2.8,1.3); stilts([(x,y) for x in (-2.2,-0.7,0.7,2.2) for y in (4.0,5.8)])
box("snow",0,4.95,DECK,1.8,2.35,0.85)
for x in [-2.4+0.8*k for k in range(7)]:
    for y in (3.75,6.05): box("vermilion",x,y,DECK,1.95,0.08,0.08)
box("vermilion",0,4.9,1.8,1.98,2.55,1.25)
gable_x(-3.1,3.1,4.9,1.75,1.95,3.15,0.14)
box("wood",0,7.3,DECK-0.12,DECK,2.2,0.85)
box("snow",0,7.3,DECK,1.9,1.8,0.6)
for x in (-1.9,-0.95,0,0.95,1.9):
    for y in (6.6,8.0): box("vermilion",x,y,DECK,2.05,0.08,0.08)
box("vermilion",0,7.3,1.9,2.08,2.0,0.82)
gable_x(-2.55,2.55,7.3,1.3,2.05,3.4,0.14)
# open stage (hirabutai) with the raised dance stage, and the Hitasaki jutting out to sea with its lantern
box("wood",0,2.6,DECK-0.12,DECK,2.4,1.0); stilts([(x,y) for x in (-2.0,-0.7,0.7,2.0) for y in (1.9,3.2)])
for sx in (-1,1): box("vermilion",sx*1.55,1.62,DECK,0.8,0.85,0.04)
box("vermilion",0,2.7,DECK,0.85,0.75,0.5); box("roof",0,2.7,0.85,0.9,0.78,0.53)
box("wood",0,0.7,DECK-0.12,DECK,0.55,0.9); stilts([(sx*0.35,y) for sx in (-1,1) for y in (0.1,1.1)])
for sx in (-1,1): box("vermilion",sx*0.52,0.75,DECK,0.8,0.03,0.85)
box("vermilion",0,0.05,DECK,1.2,0.07,0.07)
box("glow_hitasaki",0,0.05,1.2,1.55,0.17,0.17)
solid([rect(0.3,0.3,1.55,0,0.05),rect(0.3,0.3,1.62,0,0.05),rect(0.05,0.05,1.85,0,0.05)],"roof")
# corridors (kairo) enclosing the water square, ending at the Marodo shrine (left) and the Noh stage (right)
corridor(-2.8,4.6,-6.4,4.6); corridor(-6.4,4.6,-6.4,1.0)
corridor(2.8,4.6,5.2,4.6); corridor(5.2,4.6,5.2,1.4)
box("wood",-6.4,0.2,DECK-0.12,DECK,1.0,0.8); stilts([(-6.4+sx*0.6,0.2+sy*0.5) for sx in (-1,1) for sy in (-1,1)])
box("snow",-6.4,0.25,DECK,1.5,0.7,0.45)
for sx in (-1,1):
    for sy in (-1,1): box("vermilion",-6.4+sx*0.78,0.25+sy*0.55,DECK,1.6,0.07,0.07)
gable_y(-0.75,1.15,-6.4,1.15,1.55,2.25)
box("wood",5.2,0.4,DECK-0.12,DECK+0.05,0.9,0.9); stilts([(5.2+sx*0.6,0.4+sy*0.6) for sx in (-1,1) for sy in (-1,1)])
for sx in (-1,1):
    for sy in (-1,1): box("wood",5.2+sx*0.8,0.4+sy*0.8,DECK,1.75,0.07,0.07)
box("wood",5.2,1.28,DECK,1.65,0.85,0.04)
flared_roof([(1.2,1.2,1.72,0.15),(1.2,1.2,1.84,0.15),(0.9,0.9,2.0,0.05),(0.3,0.3,2.45,0.0)],"roof",5.2,0.4)
for i,(x,y) in enumerate(GLOWS): box("glow_kairo",x,y,1.3,1.48,0.08,0.08)   # hanging lanterns, one glow object
DY=0.0

# ---- five-storey pagoda on the rise at the back right
PX,PY=4.7,5.5; PS=0.62; PG=H(PX,PY)
def pz(z): return PG+PS*z
box("stone",PX,PY,PG-0.4,pz(0.35),1.2*PS,1.2*PS)
for i in range(5):
    zb=0.35+i*1.05; w=0.82-0.07*i
    box("vermilion",PX,PY,pz(zb),pz(zb+0.74),w*PS,w*PS)
    r0=(w+0.62)*PS; r1=(w+0.3)*PS; r2=(w-0.05)*PS
    flared_roof([(r0,r0,pz(zb+0.72),0.16),(r0,r0,pz(zb+0.8),0.16),(r1,r1,pz(zb+0.93),0.06),(r2,r2,pz(zb+1.05),0.0)],"roof",PX,PY)
prism("roof",PX,PY,pz(5.6),pz(7.2),0.08,0.06,6)
for zz in (6.0,6.3,6.6): prism("roof",PX,PY,pz(zz),pz(zz+0.08),0.2,0.2,8)

# ---- stone lanterns (fire boxes are separate glow_ objects)
def lantern(cx,cy,idx):
    T=dict(cx=cx,cy=cy)
    box("stone",0,0,-0.05,0.22,0.4,0.4,T)
    prism("stone",0,0,0.22,1.3,0.17,0.15,6,0,T)
    box("stone",0,0,1.3,1.48,0.38,0.38,T)
    box("glow_lantern_%d"%idx,0,0,1.48,1.92,0.27,0.27,T)
    solid([rect(0.62,0.62,1.92),rect(0.62,0.62,2.0),rect(0.14,0.14,2.3)],"stone",T)
    bipyr("stone",0,0,2.38,0.11,2.28,2.56,6,T)
lantern(7.3,2.4,1); lantern(3.2,6.9,2)

# ---- trees on the slopes of Mt Misen, with a couple of autumn maples
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
def maple(cx,cy,s):
    g=H(cx,cy); T=dict(cx=cx,cy=cy,cz=g,s=s)
    prism("wood",0,0,-0.3,1.1,0.18,0.15,6,0,T)
    ico("vermilion",0,0,1.85,1.05,1.05,0.85,T)
    ico("vermilion",0.45,-0.3,1.4,0.65,0.65,0.5,T)
TREES=[("c",-5.6,6.2,1.0,0),("c",-3.6,7.4,0.95,0.3),("c",-6.6,4.0,0.9,0.6),("c",0.9,8.1,0.85,0.5),("c",7.0,4.4,0.8,0.2),("c",2.6,8.0,0.8,0.9),
       ("r",-5.0,7.4,0.85),("r",7.0,1.0,0.75),("m",-4.2,5.6,0.8),("m",3.6,6.8,0.75)]
for t in TREES:
    x,y=t[1],t[2]
    for _ in range(80):
        if isl_m(x,y)<=0.76: break
        x+=(0.2-x)*0.05; y+=(5.6-y)*0.05   # keep the trees on the level ground, off the beach
    else: raise SystemExit('tree %s cannot reach level ground'%(t,))
    t=(t[0],x,y)+t[3:]
    {"c":lambda *a:conifer(*a),"r":lambda *a:roundtree(*a),"m":lambda *a:maple(*a)}[t[0]](*t[1:])

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/itsukushima-torii.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=FH; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y):
    d,t=jetty_d(x,y)
    if d<0.45 and t>0.0: return JD
    return max(LV,H(x,y))   # open water at the region's level; the game draws it
ground=[[round(ground_at(-HALF+GSTEP*ix, -(-HALF+GSTEP*iz)),3) for ix in range(GN)] for iz in range(GN)]
for i in range(GN): ground[0][i]=ground[GN-1][i]=ground[i][0]=ground[i][GN-1]=LV     # the edge ring is open water
CELL=0.3
cellg={}
def cg(cx,cy):
    k=(cx,cy)
    if k not in cellg: cellg[k]=ground_at(-HALF+CELL*(cx+0.5), -HALF+CELL*(cy+0.5))
    return cellg[k]
# Solids baked from the geometry: anything in a band 0.35..1.6 above the local ground (cells over Blender x, y).
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
                    if nz>0.92 and z<g+0.6: continue   # ground-level surfaces
                    solid_cells.add((cx,cy))
solids=[[round(-HALF+CELL*(cx+0.5),2), round(-(-HALF+CELL*(cy+0.5)),2), 0.22] for cx,cy in sorted(solid_cells)]
solids+=[[round(x,2),round(-y,2),r] for x,y,r in EXTRA_SOLIDS]
INTERACT=(7.0,0.6)   # the beach by the landing, facing the torii
STAND=(7.5,-4.0)     # the level ground at the head of the landing
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]]}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/itsukushima-torii.json"
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
    objname=key if key.startswith("glow_") else "itsukushima_"+key
    me=bpy.data.meshes.new(objname); me.from_pydata(vs,[],fs); me.validate(); me.update()
    for p in me.polygons: p.use_smooth=False
    me.materials.append(getmat(matname))
    ob=bpy.data.objects.new(objname,me); col.objects.link(ob)
    stats[objname]=sum(len(p.vertices)-2 for p in me.polygons)
    allv+= [v.co.copy() for v in me.vertices]
# ---- Miyajima deer, with separate pivots for the neck, legs and tail
FPS=24
DEER_END=38*FPS+1
HOOF_HEIGHT=0.023
LEG_LENGTH=0.44
def empty(name, parent=None, location=(0,0,0)):
    obj=bpy.data.objects.new(name,None)
    col.objects.link(obj)
    obj.parent=parent
    obj.location=location
    return obj

def deer_part(pivot, draw):
    # Keep moving geometry out of the static mesh buckets and the solid sidecar.
    global B
    landmark=B
    B={}
    draw()
    for material,(vs,fs) in B.items():
        name=pivot.name+"_"+material
        me=bpy.data.meshes.new(name)
        me.from_pydata(vs,[],fs)
        me.materials.append(getmat(material))
        obj=bpy.data.objects.new(name,me)
        col.objects.link(obj)
        obj.parent=pivot
        stats[name]=sum(len(face)-2 for face in fs)
    B=landmark

def tilt(obj,axis,angle,frame):
    obj.rotation_euler[axis]=math.radians(angle)
    obj.keyframe_insert(data_path="rotation_euler",index=axis,frame=frame)

def idle_pose(obj,axis,frames,offsets):
    for offset in offsets:
        for frame,angle in frames:
            tilt(obj,axis,angle,frame+offset)
    tilt(obj,axis,0,1)
    tilt(obj,axis,0,DEER_END)

def walk(body,legs,start,origin,destination,yaw):
    # Turn, then stroll for less than three seconds. The diagonal legs move
    # out of phase, and the stance portion of each step keeps the hoof down.
    heading=math.atan2(destination[1]-origin[1],destination[0]-origin[0])
    heading=yaw+math.remainder(heading-yaw,math.tau)
    first=start+16
    duration=64
    body.rotation_euler.z=yaw
    body.keyframe_insert(data_path="rotation_euler",index=2,frame=start)
    body.rotation_euler.z=heading
    body.keyframe_insert(data_path="rotation_euler",index=2,frame=first)

    distance=math.dist(origin,destination)
    strides=round(distance/0.50)
    stance_distance=0.6*distance/(strides*body.scale.x)
    for elapsed in range(0,duration+1,2):
        t=elapsed/duration
        ease=t*t*(3-2*t)
        frame=first+elapsed
        body.location.x=origin[0]+(destination[0]-origin[0])*ease
        body.location.y=origin[1]+(destination[1]-origin[1])*ease
        body.keyframe_insert(data_path="location",frame=frame)
        ramp=min(1,ease*12,(1-ease)*12)
        for leg,height,offset in legs:
            phase=(strides*ease+offset)%1
            # Through stance the foot travels backward relative to the body.
            # Return it forward through a lifted swing over the last 40%.
            swing=max(0,(phase-0.6)/0.4)
            stride=(0.5-phase/0.6) if phase<0.6 else (-0.5+swing)
            angle=-math.asin(stride*ramp*stance_distance/LEG_LENGTH)
            lift=0.09*math.sin(math.pi*swing)*ramp
            tilt(leg,1,math.degrees(angle),frame)
            leg.location.z=height+lift-LEG_LENGTH*(1-math.cos(angle))
            leg.keyframe_insert(data_path="location",index=2,frame=frame)
    return heading

def deer(index,home,rot,scale,offset,stop,outbound,returning):
    body=empty(f"deer_{index}",location=(*home,HOOF_HEIGHT))
    body.rotation_euler.z=rot
    body.scale=(scale,)*3
    body["collisionRadius"]=0.26
    body["collisionHalfLength"]=0.28

    def draw_body():
        box("wood",0,0,0.42,0.74,0.38,0.15)

    def draw_head():
        solid([rect(0.08,0.08,0),rect(0.06,0.06,0.33,0.18,0)],"wood")
        box("wood",0.28,0,0.30,0.44,0.14,0.07)
        for sy in (-1,1):
            cone("wood",rect(0.03,0.025,0.43,0.22,sy*0.05),(0.18,sy*0.17,0.55))

    deer_part(body,draw_body)
    neck=empty(body.name+"_neck",body,(0.32,0,0.62))
    tail=empty(body.name+"_tail",body,(-0.36,0,0.68))
    deer_part(neck,draw_head)
    deer_part(tail,lambda: box("cream",-0.06,0,-0.08,0.04,0.08,0.06))
    legs=[]
    for name,x,y,phase in [("front_left",0.27,-0.09,0),("front_right",0.27,0.09,0.5),
                           ("hind_left",-0.27,-0.09,0.75),("hind_right",-0.27,0.09,0.25)]:
        leg=empty(body.name+"_"+name,body,(x,y,LEG_LENGTH))
        deer_part(leg,lambda: box("wood",0,0,-LEG_LENGTH,0.02,0.045,0.045))
        legs.append((leg,LEG_LENGTH,phase))

    pauses=(outbound*FPS+90,) if offset is None else (offset,outbound*FPS+90)
    idle_pose(neck,1,[(20,0),(38,12),(58,65),(70,59),(82,66),(108,0),(140,-7),(164,0)],pauses)
    idle_pose(legs[0][0],1,[(36,0),(50,-22),(67,-12),(89,0)],pauses)
    idle_pose(tail,2,[(15,0),(26,24),(35,-20),(46,0),(120,0),(132,-25),(144,22),(156,0)],pauses)
    for frame in (1,DEER_END):
        body.keyframe_insert(data_path="location",frame=frame)
        body.keyframe_insert(data_path="rotation_euler",index=2,frame=frame)
        for leg,_,_ in legs:
            tilt(leg,1,0,frame)
            leg.keyframe_insert(data_path="location",index=2,frame=frame)

    heading=walk(body,legs,outbound*FPS,home,stop,rot)
    heading=walk(body,legs,returning*FPS,stop,home,heading)
    body.keyframe_insert(data_path="rotation_euler",index=2,frame=returning*FPS+80)
    body.rotation_euler.z=heading+math.remainder(rot-heading,math.tau)
    body.keyframe_insert(data_path="rotation_euler",index=2,frame=returning*FPS+100)
    body.keyframe_insert(data_path="rotation_euler",index=2,frame=DEER_END)

scene=bpy.context.scene
scene.render.fps=FPS
scene.frame_end=DEER_END
# The deer walk along the shore of each arm, on the level ground just above the beach, in view of the camera
# and clear of the trees, the lanterns and the buildings.
routes=[
    ((8.3,-0.2),1.4,1,None,(8.3,-3.0),4,24),
    ((-8.0,-2.2),-0.6,0.92,20,(-8.0,-4.2),10,29),   # the front of the left arm, clear of the torii from the camera
]
for index,args in enumerate(routes,1):
    deer(index,*args)
scene.frame_set(1)
mn=[min(v[i] for v in allv) for i in range(3)]; mx=[max(v[i] for v in allv) for i in range(3)]
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', export_yup=True, export_apply=True,
    export_cameras=False, export_lights=False, export_extras=True, export_animations=True, export_animation_mode='SCENE', export_materials='EXPORT')
res={"tris":sum(stats.values()),"per_obj":stats,"materials":len(bpy.data.materials),"min":[round(v,3) for v in mn],"max":[round(v,3) for v in mx],"glb_bytes":os.path.getsize(GLB)}
json.dump(res,open("/tmp/lm_build.json","w"))
