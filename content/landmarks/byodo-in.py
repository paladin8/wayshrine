# Byodo-in (the Phoenix Hall with its wings and towers, on its island in the Aji-ike pond) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python byodo-in.py
# Rebuilds content/landmarks/byodo-in.blend and public/models/landmarks/byodo-in.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/byodo-in.glb"
BLEND=ROOT+"/content/landmarks/byodo-in.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"water":"479ea3","terrain":"86a75e","pebble":"cfc8b8","stone":"9a958c","red":"c0502f","white":"efeae0","roof":"5d6662","gold":"d9b04a","foliage":"4f7a45","bark":"4e3a30","wood":"6e4c36","glow_cream":"e8dcb0"}
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
rng=random.Random(25)
EXTRA_SOLIDS=[]; NOSOLID={"foliage"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the hall and its wings on their island
LV=-0.6; FLOOR=LV-0.5; TERRAIN_SURFACE=False; EDGE_LEVEL=LV
def water_disc(x,y): return False     # the pond is the region's own open water, crossed by boat
# The garden is laid out in its own frame (front toward local -Y) and turned 45 degrees so the hall faces the game
# camera squarely: both wing corridors then read as parts of one building, spread across the view.
ROT=math.pi/4; CR,SR=math.cos(ROT),math.sin(ROT)
def L2W(x,y): return (x*CR-y*SR,x*SR+y*CR)
def W2L(x,y): return (x*CR+y*SR,-x*SR+y*CR)

# ---- the island in the Aji-ike pond: a rounded garden island holding the hall, a pebble beach (suhama) sloping
# into the water in front, and a small islet off to the side with the landing. Open water to the footprint edge.
IC=(0.0,0.9); IRX,IRY,IP=8.2,6.4,3.0
def isl_m(x,y):
    dx=abs((x-IC[0])/IRX); dy=abs((y-IC[1])/IRY); th=math.atan2(y-IC[1],x-IC[0])
    return (dx**IP+dy**IP)**(1/IP)/(1+0.05*math.sin(3*th+0.4)+0.03*math.sin(5*th+1.3))
LC=(5.4,-7.6); LR=1.5                                     # the landing islet, off the front of the island
def H_l(x,y):
    m=isl_m(x,y); ml=math.hypot(x-LC[0],y-LC[1])/LR
    land=0.0
    beach=smooth(-3.2,-5.6,y)*(1-abs(x)/9.0)              # the front of the island shelves gently into the pond
    hi=land-(0.5*beach)
    h1=(LV+0.08)+(hi-(LV+0.08))*smooth(1.0,0.72,m)        # a low garden shore, sloping gently to the water
    h1=h1 if m<1.0 else (LV+0.08)*(1-smooth(1.0,1.06,m))+FLOOR*smooth(1.0,1.06,m)
    h2=(LV+0.08)+(0.0-(LV+0.08))*smooth(1.0,0.7,ml) if ml<1.0 else (LV+0.08)*(1-smooth(1.0,1.15,ml))+FLOOR*smooth(1.0,1.15,ml)
    return max(h1,h2)
def H(x,y): return H_l(*W2L(x,y))
def is_beach(x,y): return False      # the front is a low garden shore, grass to the water
GS=0.8; NG=int(round(2*FH/GS))
gv={}
for j in range(NG+1):
    for i in range(NG+1):
        x=-FH+i*GS; y=-FH+j*GS
        if 0<i<NG and 0<j<NG: x+=rng.uniform(-0.2,0.2); y+=rng.uniform(-0.2,0.2)
        gv[(i,j)]=(x,y,H(x,y))
gverts=[]; gid={}
for k,v in gv.items(): gid[k]=len(gverts); gverts.append(v)
gf=[]; gm=[]
for j in range(NG):
    for i in range(NG):
        a,b,c,d4=(i,j),(i+1,j),(i+1,j+1),(i,j+1)
        for t3 in ([(a,b,c),(a,c,d4)] if (i+j)%2==0 else [(a,b,d4),(b,c,d4)]):
            P=[gv[k] for k in t3]; cx=sum(p[0] for p in P)/3; cy=sum(p[1] for p in P)/3; cz=sum(p[2] for p in P)/3
            if max(p[2] for p in P)<LV-0.05: continue
            gf.append([gid[k] for k in t3]); gm.append("pebble" if is_beach(*W2L(cx,cy)) else "terrain")
emit(gverts,gf,gm,orient=False)
emit([(-FH,-FH,LV-0.04),(FH,-FH,LV-0.04),(FH,FH,LV-0.04),(-FH,FH,LV-0.04)],[[0,1,2,3]],["water"],orient=False)   # fills shore tiles the game keeps as land
MARK={m:len(B[m][0]) for m in B}       # everything after this is built in the garden's frame and turned at the end

# ---- the Phoenix Hall (Hoo-do): the central hall under a double roof (pent roof and hipped roof) with the gilt
# phoenixes on the ridge, raised wing corridors to either side ending in corner towers that turn forward, and
# the tail corridor behind. Vermilion timber, white plaster, dark copper-green roofs.
HX,HY=0.0,0.6
box("stone",HX,HY,-0.3,0.28,2.6,2.05)                                   # podium
box("white",HX,HY,0.28,1.75,1.75,1.3)
for x in (-1.75,-1.05,-0.35,0.35,1.05,1.75):
    for y in (-1.3,1.3): box("red",HX+x,HY+y,0.28,1.73,0.08,0.08)
for y in (-0.65,0.0,0.65): box("red",HX-1.75,HY+y,0.28,1.73,0.08,0.08); box("red",HX+1.75,HY+y,0.28,1.73,0.08,0.08)   # posts stop short of the wall top: no shared plane
for x in (-0.7,0.0,0.7): box("red",HX+x,HY-1.31,0.35,1.45,0.24,0.02)   # the doors
box("glow_door",HX,HY-1.32,0.45,1.3,0.18,0.015)                        # the Amida within, glimpsed through the open door
box("red",HX,HY,0.95,1.05,1.85,1.4)                                    # tie beam under the pent roof
flared_roof([(2.55,2.1,1.05,0.15),(2.55,2.1,1.13,0.15),(1.95,1.5,1.32,0.03)],"roof",HX,HY)   # the pent roof (mokoshi)
box("white",HX,HY,1.32,2.25,1.4,1.0)
for x in (-1.4,-0.7,0.0,0.7,1.4): box("red",HX+x,HY-1.0,1.32,2.23,0.07,0.07)
box("red",HX,HY,2.18,2.3,1.5,1.1)
flared_roof([(2.55,2.1,2.3,0.34),(2.55,2.1,2.4,0.34),(1.7,1.25,2.78,0.1),(1.15,0.2,3.22,0.0)],"roof",HX,HY)   # broad and gently pitched
box("roof",HX,HY,3.17,3.3,1.2,0.14)
def phoenix(x,y,z,s):
    T=dict(cx=x,cy=y,cz=z,s=s)
    extrude_y("gold",[(-0.12,0.0),(0.1,0.0),(0.16,0.12),(0.08,0.3),(0.02,0.18),(-0.2,0.34),(-0.08,0.12)],-0.03,0.03,T)
    extrude_x("gold",[(-0.2,0.15),(0.2,0.15),(0.0,0.32)],-0.05,0.05,T)          # spread wings
for sx in (-1,1): phoenix(HX+sx*1.15,HY,3.28,1.5 if sx>0 else -1.5)
# the wing corridors: an open lower storey on posts, a short upper gallery, then the corner towers and the
# forward-turning ends
def gallery(x0,y0,x1,y1):
    alx=abs(y1-y0)<1e-6; L=(abs(x1-x0) if alx else abs(y1-y0))/2; cx,cy=(x0+x1)/2,(y0+y1)/2
    hx,hy=(L,0.45) if alx else (0.45,L)
    box("stone",cx,cy,-0.3,0.12,hx+0.05,hy+0.05)
    n=max(2,int(round(2*L/0.7)))
    for k in range(n+1):
        t=k/n; px=x0+(x1-x0)*t; py=y0+(y1-y0)*t
        for o in (-0.4,0.4):
            box("red",px+(0 if alx else o),py+(o if alx else 0),0.12,1.0,0.05,0.05)
    box("red",cx,cy,0.95,1.05,hx+0.05,hy+0.05)
    box("white",cx,cy,1.05,1.5,hx-0.05 if alx else 0.32,0.32 if alx else hy-0.05)
    for k in range(n+1):
        t=k/n; px=x0+(x1-x0)*t; py=y0+(y1-y0)*t; box("red",px,py-(0.33 if alx else 0),1.05,1.5,0.04,0.04) if alx else box("red",px-0.33,py,1.05,1.5,0.04,0.04)
    if alx: extrude_x("roof",[(cy-0.8,1.5),(cy+0.8,1.5),(cy+0.8,1.57),(cy,1.82),(cy-0.8,1.57)],cx-L-0.2,cx+L+0.2)
    else: extrude_y("roof",[(cx-0.8,1.5),(cx+0.8,1.5),(cx+0.8,1.57),(cx,1.82),(cx-0.8,1.57)],cy-L-0.2,cy+L+0.2)
def tower(x,y):
    box("stone",x,y,-0.3,0.12,0.75,0.75)
    for sx in (-1,1):
        for sy in (-1,1): box("red",x+sx*0.6,y+sy*0.6,0.12,1.9,0.06,0.06)
    box("white",x,y,1.05,1.9,0.55,0.55)
    flared_roof([(0.95,0.95,1.9,0.18),(0.95,0.95,1.98,0.18),(0.5,0.5,2.2,0.04)],"roof",x,y)
    box("white",x,y,2.2,2.6,0.4,0.4)
    flared_roof([(0.8,0.8,2.6,0.2),(0.8,0.8,2.68,0.2),(0.12,0.12,3.05,0.0)],"roof",x,y)
    prism("gold",x,y,3.0,3.35,0.03,0.02,6,0)
for sx in (-1,1):
    gallery(sx*2.6,HY,sx*5.0,HY); tower(sx*5.55,HY)
    gallery(sx*5.55,HY-0.75,sx*5.55,HY-2.6)
gallery(HX,HY+2.1,HX,HY+4.4)                                            # the tail corridor
# ---- before the hall: the stone lantern on the pebble beach, and the arched vermilion bridge to the landing islet
LX,LY=0.0,-3.4
box("stone",LX,LY,-0.35,0.05,0.32,0.32); prism("stone",LX,LY,0.05,0.75,0.1,0.1,8,0)
box("stone",LX,LY,0.75,0.85,0.28,0.28); box("glow_lantern",LX,LY,0.85,1.15,0.18,0.18)
solid([rect(0.38,0.38,1.15),rect(0.38,0.38,1.22),rect(0.08,0.08,1.45)],"stone",dict(cx=LX,cy=LY))
B0=(5.15,-4.55); B1=(5.45,-6.35); BZ=0.0; BARCH=0.45
ang=math.atan2(B1[1]-B0[1],B1[0]-B0[0]); BL=math.hypot(B1[0]-B0[0],B1[1]-B0[1])/2+0.55
TB=dict(cx=(B0[0]+B1[0])/2,cy=(B0[1]+B1[1])/2,rot=ang)
def bz(t): return BZ+0.05+BARCH*math.sin(math.pi*t)
ks=[k/10 for k in range(11)]
solid([[(-BL+2*BL*t,-0.55,bz(t)-0.12),(-BL+2*BL*t,0.55,bz(t)-0.12),(-BL+2*BL*t,0.55,bz(t)),(-BL+2*BL*t,-0.55,bz(t))] for t in ks],"red",TB)
for sy in (-1,1):
    solid([[(-BL+2*BL*t,sy*0.5-0.03,bz(t)+0.3),(-BL+2*BL*t,sy*0.5+0.03,bz(t)+0.3),(-BL+2*BL*t,sy*0.5+0.03,bz(t)+0.36),(-BL+2*BL*t,sy*0.5-0.03,bz(t)+0.36)] for t in ks],"red",TB)
    for k in range(1,10,2): t=k/10; box("red",-BL+2*BL*t,sy*0.5,bz(t),bz(t)+0.33,0.03,0.03,TB)
def bridge_h(x,y):
    c,s_=math.cos(-ang),math.sin(-ang); lx=(x-TB["cx"])*c-(y-TB["cy"])*s_; ly=(x-TB["cx"])*s_+(y-TB["cy"])*c
    if abs(lx)<=BL and abs(ly)<=0.45: return bz((lx+BL)/(2*BL))
    return None
# the landing: a short jetty off the islet where the boat comes in
J0=(4.3,-8.5); J1=(3.0,-9.3); JD=LV+0.3
ja=math.atan2(J1[1]-J0[1],J1[0]-J0[0]); JL=math.hypot(J1[0]-J0[0],J1[1]-J0[1])/2
TJ=dict(cx=(J0[0]+J1[0])/2,cy=(J0[1]+J1[1])/2,rot=ja)
box("wood",0,0,JD-0.08,JD,JL+0.3,0.45,TJ)
for k in range(4):
    for sy in (-1,1): box("wood",-JL+2*JL*k/3,sy*0.38,FLOOR,JD-0.08,0.05,0.05,TJ)
def jetty_d(x,y):
    c,s_=math.cos(-ja),math.sin(-ja); lx=(x-TJ["cx"])*c-(y-TJ["cy"])*s_; ly=(x-TJ["cx"])*s_+(y-TJ["cy"])*c
    return abs(lx)<=JL+0.3 and abs(ly)<=0.45

# ---- garden pines on the island and the islet
def pine(x,y,s):
    z=H_l(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.13,-0.3,5),ngon(0.11,1.1,5,0,0.3,0),ngon(0.08,1.9,5,0,0.1,0.1)],"bark",T)
    for (px,py,pz,r) in [(0.1,0.1,1.95,0.85),(0.55,-0.1,1.4,0.65),(-0.35,0.25,1.25,0.55)]: ico("foliage",px,py,pz,r,r*0.9,0.3,T)
for x,y,s in [(-7.0,-1.6,0.9),(-6.6,3.2,1.0),(-3.6,5.4,0.95),(3.8,5.4,0.9),(6.8,3.0,1.0),(7.2,-0.9,0.85),(-5.0,-3.6,0.8),(6.3,-8.1,0.75),
              (-1.4,6.0,1.0),(1.6,6.2,0.95)]:     # fewer behind the hall than before, so the open front shore has room
    pine(x,y,s)
for m,(bv,bf) in B.items():                                     # turn the garden's frame into the footprint
    for i in range(MARK.get(m,0),len(bv)):
        x,y,z=bv[i]; X,Y=L2W(x,y); bv[i]=(X,Y,z)

def ground_at(x,y):
    x,y=W2L(x,y)
    h=bridge_h(x,y)
    if h is not None: return h
    if jetty_d(x,y): return JD
    return max(LV,H_l(x,y))
INTERACT=L2W(LX,LY-0.8)   # the shore before the hall
STAND=L2W(2.6,-3.8)       # on the shore, beside the lantern

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/byodo-in.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/byodo-in.json"
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
    objname=key if key.startswith("glow_") else "byodo_"+key
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
