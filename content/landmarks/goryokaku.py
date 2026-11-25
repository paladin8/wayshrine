# Goryokaku landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python goryokaku.py
# Rebuilds content/landmarks/goryokaku.blend and public/models/landmarks/goryokaku.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/goryokaku.glb"
BLEND=ROOT+"/content/landmarks/goryokaku.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"snow":"eef2f4","stonewall":"8f8a80","pave":"a8a298","water":"2a4e62","wood":"4a3a2e","plaster":"f0ede6","roof":"4a4d52","fir":"2f4f3e","bare":"7a6a5e","glow_cream":"e8dcb0"}
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
rng=random.Random(59)
EXTRA_SOLIDS=[]; NOSOLID={"fir","bare"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the star fort in its moat
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0

# ---- the star: five bastions, a notch toward the front (-Y) where the bridge crosses; the moat follows the
# walls at a constant width, so its outer edge is the star offset outward
def star(R,r,a0=-math.pi/2):
    P=[]
    for k in range(5):
        a=a0+2*math.pi*k/5
        P.append((r*math.cos(a),r*math.sin(a))); b=a+math.pi/5; P.append((R*math.cos(b),R*math.sin(b)))
    return P
def offset(P,w):
    n=len(P); L=[]
    for i in range(n):
        a,b=P[i],P[(i+1)%n]; dx,dy=b[0]-a[0],b[1]-a[1]; l=math.hypot(dx,dy)
        L.append(((a[0]+dy/l*w,a[1]-dx/l*w),(dx,dy)))
    Q=[]
    for i in range(n):
        (p1,d1),(p2,d2)=L[i-1],L[i]
        den=d1[0]*d2[1]-d1[1]*d2[0]; t=((p2[0]-p1[0])*d2[1]-(p2[1]-p1[1])*d2[0])/den
        Q.append((p1[0]+d1[0]*t,p1[1]+d1[1]*t))
    return Q
def inside(P,x,y):
    c=False; n=len(P)
    for i in range(n):
        (x1,y1),(x2,y2)=P[i],P[(i+1)%n]
        if (y1>y)!=(y2>y) and x<x1+(y-y1)*(x2-x1)/(y2-y1): c=not c
    return c
def edist(P,x,y):
    d=1e9; n=len(P)
    for i in range(n):
        (x1,y1),(x2,y2)=P[i],P[(i+1)%n]; dx,dy=x2-x1,y2-y1
        t=max(0.0,min(1.0,((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy)))
        d=min(d,math.hypot(x-x1-t*dx,y-y1-t*dy))
    return d
IN=star(7.0,4.6)
if sum(IN[i][0]*IN[(i+1)%10][1]-IN[(i+1)%10][0]*IN[i][1] for i in range(10))<0: IN=IN[::-1]
MW=1.6
def rmax(P): return max(math.hypot(*p) for p in P)
sg=1 if rmax(offset(IN,1.0))>rmax(IN) else -1      # the sign that offsets outward
OUT=offset(IN,sg*MW); OUTW=offset(IN,sg*(MW+0.25)); INW=offset(IN,-sg*0.25)
CH=-0.75; WZ=-0.42; FZ=0.25
BRX=0.75; BY0,BY1=-6.65,-4.15
def on_bridge(x,y): return abs(x)<BRX and BY0<y<BY1
def rampart(x,y):
    d=edist(IN,x,y)
    h=0.42*smooth(0.25,0.9,d)*(1-smooth(1.5,2.3,d))
    if y<-2.0: h*=smooth(1.4,2.2,abs(x))          # the gate's cut through the bank
    return h
def G(x,y):
    if inside(IN,x,y): return FZ+rampart(x,y)
    if inside(OUT,x,y): return CH
    return 0.0
for i in range(10):                                  # the moat water, a ring of trapezoids
    a,b,c,d=IN[i],IN[(i+1)%10],OUT[(i+1)%10],OUT[i]
    emit([(*a,WZ),(*b,WZ),(*c,WZ),(*d,WZ)],[[0,1,2,3]],["water"])
def ringwall(A,B,z0,z1,mat="stonewall"):
    for i in range(10):
        a,b,c,d=A[i],A[(i+1)%10],B[(i+1)%10],B[i]
        solid([[(*a,z0),(*b,z0),(*c,z0),(*d,z0)],[(*a,z1),(*b,z1),(*c,z1),(*d,z1)]],mat)
ringwall(IN,INW,CH-0.05,FZ+0.08)                     # the dressed-stone walls of the bastions
ringwall(OUT,OUTW,CH-0.05,0.06)                      # the counterscarp
# the bridge into the notch, timber, rising gently from the outer bank onto the fort
def deckz(y): return 0.08+(FZ+0.1-0.08)*smooth(BY0,BY1,y)
NB=6
for k in range(NB):
    y0=BY0+(BY1-BY0)*k/NB; y1=BY0+(BY1-BY0)*(k+1)/NB
    solid([[(-BRX,y0,deckz(y0)-0.12),(BRX,y0,deckz(y0)-0.12),(BRX,y0,deckz(y0)),(-BRX,y0,deckz(y0))],
           [(-BRX,y1,deckz(y1)-0.12),(BRX,y1,deckz(y1)-0.12),(BRX,y1,deckz(y1)),(-BRX,y1,deckz(y1))]],"wood")
for sx in (-1,1):
    for k in range(NB+1):
        y=BY0+(BY1-BY0)*k/NB; box("wood",sx*(BRX-0.05),y,deckz(y),deckz(y)+0.5,0.05,0.05)
    solid([[(sx*(BRX-0.05)-0.04,BY0,deckz(BY0)+0.44),(sx*(BRX-0.05)+0.04,BY0,deckz(BY0)+0.44),(sx*(BRX-0.05)+0.04,BY0,deckz(BY0)+0.52),(sx*(BRX-0.05)-0.04,BY0,deckz(BY0)+0.52)],
           [(sx*(BRX-0.05)-0.04,BY1,deckz(BY1)+0.44),(sx*(BRX-0.05)+0.04,BY1,deckz(BY1)+0.44),(sx*(BRX-0.05)+0.04,BY1,deckz(BY1)+0.52),(sx*(BRX-0.05)-0.04,BY1,deckz(BY1)+0.52)]],"wood")
    for zc in (CH-0.05,):
        for y in (-5.75,-5.05): prism("wood",sx*0.5,y,zc,deckz(y)-0.1,0.07,0.07,6)

# ---- the Hakodate magistrate's office: a long low hall of white plaster over dark timber, grey tile under snow,
# the drum tower on its ridge; a gabled porch faces the bridge
HX,HY=0.0,0.9
def hall(cx,cy,hx,hy,zb,h,ridge):
    box("wood",cx,cy,zb-0.1,zb+0.32,hx+0.02,hy+0.02); box("plaster",cx,cy,zb+0.32,zb+h,hx,hy)
    for k in range(int(hx/0.55)):
        x=cx-hx+0.35+k*((2*hx-0.7)/max(1,int(hx/0.55)-1))
        box("glow_windows",x,cy-hy-0.02,zb+0.45,zb+h-0.18,0.13,0.02)
    z=zb+h
    flared_roof([(hx+0.42,hy+0.42,z,0.16),(hx+0.42,hy+0.42,z+0.07,0.16),(hx-0.15,hy-0.35,z+0.55,0.05),(ridge,0.08,z+0.95,0.0)],"roof",cx,cy)
    flared_roof([(hx+0.34,hy+0.34,z+0.07,0.06),(hx+0.34,hy+0.34,z+0.11,0.06),(hx-0.2,hy-0.38,z+0.6,0.03),(ridge-0.05,0.06,z+0.99,0.0)],"snow",cx,cy)
    return z+0.95
top=hall(HX,HY,2.7,1.05,FZ,0.95,2.1)
hall(HX+2.5,HY+1.95,0.85,1.1,FZ,0.85,0.55)                      # the rear wings
hall(HX-2.4,HY+1.95,0.85,1.1,FZ,0.85,0.55)
# drum tower
box("plaster",HX,HY,top-0.2,top+0.55,0.38,0.38)
box("glow_windows",HX,HY-0.39,top+0.12,top+0.42,0.22,0.02)
flared_roof([(0.62,0.62,top+0.55,0.1),(0.62,0.62,top+0.6,0.1),(0.04,0.04,top+1.0,0.0)],"roof",HX,HY)
flared_roof([(0.54,0.54,top+0.6,0.04),(0.54,0.54,top+0.63,0.04),(0.03,0.03,top+1.03,0.0)],"snow",HX,HY)
# the porch toward the bridge
PY=HY-1.05-0.45
box("wood",HX,PY,FZ-0.1,FZ+0.95,0.62,0.45)
box("glow_door",HX,PY-0.46,FZ,FZ+0.75,0.38,0.02)
extrude_y("roof",[(-0.95,FZ+0.9),(0,FZ+1.5),(0.95,FZ+0.9),(0.85,FZ+0.86),(0,FZ+1.38),(-0.85,FZ+0.86)],PY-0.65,PY+0.5)
extrude_y("snow",[(-0.9,FZ+0.97),(0,FZ+1.56),(0.9,FZ+0.97),(0.82,FZ+0.95),(0,FZ+1.46),(-0.82,FZ+0.95)],PY-0.6,PY+0.5)
box("pave",HX,-2.6,FZ-0.05,FZ+0.03,0.55,1.6)                      # the stone walk from the gate

# ---- pines on the banks, bare cherries in the court, firs out beyond the moat
def fir(x,y,s):
    z=G(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.12,-0.3,5),ngon(0.08,0.8,5)],"wood",T)
    for zc,r,hh in ((0.6,0.72,1.05),(1.25,0.46,0.95)):
        cone("fir",ngon(r,zc,6,rng.uniform(0,1)),(0,0,zc+hh),T)
        cone("snow",ngon(r*0.55,zc+hh*0.45,6,0.3),(0,0,zc+hh+0.06),T)
def bare(x,y,s):
    z=G(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.1,-0.3,5),ngon(0.06,0.9,5)],"wood",T)
    ico("bare",0,0,1.35,0.75,0.75,0.55,T); ico("bare",0.35,0.2,1.05,0.45,0.45,0.35,T)
for k in range(10):                                 # pines on the bank of each bastion
    p=IN[k]; c=(0.0,0.0)
    if k==0: continue
    t=0.78 if k%2 else 0.7
    x,y=p[0]*t,p[1]*t
    fir(x,y,0.75 if k%2 else 0.65)
for x,y,s in [(-3.6,-1.6,0.8),(3.6,-1.6,0.8),(-2.0,-2.8,0.7),(2.0,-2.8,0.7),(-4.4,1.6,0.8),(4.4,1.6,0.8),(0.0,4.6,0.85),(-1.6,3.6,0.7),(1.6,3.6,0.7)]:
    bare(x,y,s)
for x,y,s in [(-9.6,-9.4,1.0),(-8.0,-9.8,0.85),(9.4,-9.6,1.0),(9.8,-7.8,0.85),(-9.6,9.4,1.0),(-7.6,9.8,0.85),(9.6,9.4,1.0),(9.8,7.4,0.85),
              (-2.6,-9.8,0.8),(2.8,-9.6,0.8),(-9.8,-1.2,0.8),(9.8,-1.6,0.8),(0.4,9.9,0.8)]:
    if abs(x)<FH-1.1 and abs(y)<FH-1.1 and not inside(OUTW,x,y) and edist(OUTW,x,y)>0.8: fir(x,y,s)

def ground_at(x,y):
    if on_bridge(x,y): return deckz(y)
    return G(x,y)
def terrain_at(x,y):
    # under the moat the terrain sinks well below the water: the game samples it on 1-unit tiles, and a shallow
    # bed would ride up above the water against the walls
    if inside(OUT,x,y) and not inside(IN,x,y): return -1.8
    return G(x,y)
def bridge_passage(x,y):
    # Include the approaches at both ends of the bridge, where the walls meet the deck.
    return abs(x)<BRX and BY0-0.55<y<BY1+0.55
def water_disc(x,y): return inside(OUT,x,y) and not inside(IN,x,y) and edist(IN,x,y)>0.15 and edist(OUT,x,y)>0.15 and not bridge_passage(x,y)
INTERACT=(0.0,-3.3)   # just inside the gate, on the walk to the magistrate's office
STAND=(1.2,-3.6)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/goryokaku.json and read by the world layer (see docs/landmarks.md).
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
                    if bridge_passage(-HALF+CELL*(ck[0]+0.5),-HALF+CELL*(ck[1]+0.5)): continue
                    solid_cells.add(ck)
solids=[[round(-HALF+CELL*(cx+0.5),2), round(-(-HALF+CELL*(cy+0.5)),2), 0.22] for cx,cy in sorted(solid_cells)]
for ix in range(int(2*HALF/0.6)+1):
    for iy in range(int(2*HALF/0.6)+1):
        x,y=-HALF+0.3+ix*0.6,-HALF+0.3+iy*0.6
        if water_disc(x,y): EXTRA_SOLIDS.append((x,y,0.43))
# Model the narrow rails separately so the player fits between them.
for k in range(14):
    y=BY0+(BY1-BY0)*k/13
    for x in (-(BRX-0.05),BRX-0.05):
        EXTRA_SOLIDS.append((x,y,0.08))
solids+=[[round(x,2),round(-y,2),r] for x,y,r in EXTRA_SOLIDS]
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]]}
if TERRAIN_SURFACE: side["terrainSurface"]=True
if "terrain_at" in globals():         # the terrain's own height where it differs from the walkable ground (a deck over a gorge)
    terr=[[round(terrain_at(-HALF+GSTEP*ix, -(-HALF+GSTEP*iz)),3) for ix in range(GN)] for iz in range(GN)]
    for i in range(GN): terr[0][i]=terr[GN-1][i]=terr[i][0]=terr[i][GN-1]=EDGE_LEVEL
    if terr!=ground: side["terrain"]=terr
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/goryokaku.json"
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
    objname=key if key.startswith("glow_") else "goryo_"+key
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
