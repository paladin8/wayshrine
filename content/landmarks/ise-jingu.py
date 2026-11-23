# Ise Jingu (the shinmei-zukuri sanctuary of plain cypress and thatch behind its nested fences, its empty twin site, the cedar forest) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python ise-jingu.py
# Rebuilds content/landmarks/ise-jingu.blend and public/models/landmarks/ise-jingu.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/ise-jingu.glb"
BLEND=ROOT+"/content/landmarks/ise-jingu.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"hinoki":"c8a878","hinokidk":"9a8466","thatch":"5e5546","gold":"d9b04a","pebble":"e6e3da","stone":"9a958c","pave":"c4bfb2","cedar":"2f5a3a","bark":"6b4a3a","leaf":"4a7a42","glow_cream":"e8dcb0"}
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
rng=random.Random(36)
EXTRA_SOLIDS=[]; NOSOLID={"cedar","leaf"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the fenced sanctuary, its empty twin site, the forest
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0
def water_disc(x,y): return False

def tube(mat,pts,rs,n=6):
    rings=[]
    for k,p in enumerate(pts):
        a=pts[max(k-1,0)]; b=pts[min(k+1,len(pts)-1)]
        d=Vector(b)-Vector(a); d.normalize()
        u=d.cross(Vector((0,0,1))) if abs(d.z)<0.95 else d.cross(Vector((1,0,0)))
        u.normalize(); w=d.cross(u)
        rings.append([tuple(Vector(p)+rs[k]*(math.cos(2*math.pi*i/n+math.pi/n)*u+math.sin(2*math.pi*i/n+math.pi/n)*w)) for i in range(n)])
    solid(rings,mat)

# ---- the stone terrace the sanctuary stands on, reached up steps from the gravel approach (laid on the 0.8 grid)
TZ=0.8; TX0,TX1,TY0,TY1=-4.0,5.6,-4.0,7.2
def tring(o,z): return rect((TX1-TX0)/2+o,(TY1-TY0)/2+o,z,(TX0+TX1)/2,(TY0+TY1)/2)
solid([tring(0.8,-0.05),tring(0.25,0.5),tring(0.0,TZ)],"stone",mt="pave")
SX0,SX1=0.0,1.6
for k in range(4): box("stone",(SX0+SX1)/2,TY0-0.7+0.2*k,-0.05,0.2*(k+1),(SX1-SX0)/2+0.1,0.1)
box("pave",0.8,-7.6,-0.04,0.03,0.8,3.6)

# ---- the fences, one inside another: the board wall (itagaki), the open fence (tamagaki), the inner wall (mizugaki);
# white pebbles within
CX,CY=0.8,1.6
def wall(x0,x1,y0,y1,h,gap,mat,z0=TZ):
    gx0,gx1=gap
    for (ax,ay),(bx,by) in (((x0,y0),(gx0,y0)),((gx1,y0),(x1,y0)),((x1,y0),(x1,y1)),((x0,y1),(x1,y1)),((x0,y0),(x0,y1))):
        box(mat,(ax+bx)/2,(ay+by)/2,z0,z0+h,max(0.05,abs(bx-ax)/2),max(0.05,abs(by-ay)/2))
def openfence(x0,x1,y0,y1,h,gap,z0=TZ):
    gx0,gx1=gap
    for (ax,ay),(bx,by) in (((x0,y0),(gx0,y0)),((gx1,y0),(x1,y0)),((x1,y0),(x1,y1)),((x0,y1),(x1,y1)),((x0,y0),(x0,y1))):
        L=math.hypot(bx-ax,by-ay); n=max(1,int(L/0.55))
        for k in range(n+1):
            t=k/n; box("hinokidk",ax+(bx-ax)*t,ay+(by-ay)*t,z0,z0+h,0.05,0.05)
        for zz in (0.25,h-0.12):
            box("hinoki",(ax+bx)/2,(ay+by)/2,z0+zz,z0+zz+0.07,max(0.03,abs(bx-ax)/2),max(0.03,abs(by-ay)/2))
def torii(x,y,h=1.6,w=0.75):
    for sx in (-1,1): prism("hinoki",x+sx*w,y,TZ,TZ+h,0.07,0.065,8)
    box("hinoki",x,y,TZ+h-0.35,TZ+h-0.27,w+0.12,0.05); box("hinoki",x,y,TZ+h,TZ+h+0.09,w+0.3,0.08)
box("pebble",CX,CY,TZ,TZ+0.02,3.95,4.75)
wall(CX-4.0,CX+4.0,CY-4.8,CY+4.8,1.35,(CX-0.75,CX+0.75),"hinokidk")
openfence(CX-3.2,CX+3.2,CY-4.0,CY+4.0,1.0,(CX-0.65,CX+0.65)); torii(CX,CY-4.0)
wall(CX-1.85,CX+1.85,CY-2.4,CY+1.45,0.95,(CX-0.5,CX+0.5),"hinokidk"); torii(CX,CY-2.4,1.45,0.55)
# the roofed gate in the board wall
GY=CY-4.8
for sx in (-1,1): prism("hinoki",CX+sx*0.75,GY,TZ,TZ+1.75,0.09,0.08,8)
box("hinoki",CX,GY,TZ+1.6,TZ+1.75,0.95,0.1)
extrude_x("thatch",[(GY-0.7,TZ+1.7),(GY,TZ+2.35),(GY+0.7,TZ+1.7),(GY+0.6,TZ+1.6),(GY,TZ+2.15),(GY-0.6,TZ+1.6)],CX-1.15,CX+1.15)
box("hinoki",CX,GY,TZ+2.3,TZ+2.42,1.15,0.1)

# ---- the main sanctuary (shoden), shinmei-zukuri: plain cypress raised on posts, a deep thatched gable, the crossed
# chigi rising from the gables, ten katsuogi along the ridge tipped in gold, its ridge carried on free-standing posts
SX,SY=CX,CY-0.5
F=TZ+0.95
for x in (-1.0,-0.33,0.33,1.0):
    for y in (-0.62,0.0,0.62): prism("hinoki",SX+x,SY+y,TZ,F,0.07,0.07,8)
box("hinoki",SX,SY,F-0.08,F,1.45,1.0)
for x in [-1.38+0.46*k for k in range(7)]: box("hinoki",SX+x,SY-0.95,F,F+0.38,0.03,0.03)
for x in (-1.38,1.38):
    for y in (-0.3,0.3,0.95): box("hinoki",SX+x,SY+y,F,F+0.38,0.03,0.03)
box("hinoki",SX,SY-0.95,F+0.32,F+0.38,1.42,0.03); box("hinoki",SX-1.4,SY,F+0.32,F+0.38,0.03,0.97); box("hinoki",SX+1.4,SY,F+0.32,F+0.38,0.03,0.97)
box("hinoki",SX,SY,F,F+0.95,1.05,0.68)
box("hinokidk",SX,SY-0.69,F+0.1,F+0.8,0.32,0.01)
for x in (-0.18,0.18):
    for z in (0.3,0.6): box("gold",SX+x,SY-0.7,F+z,F+z+0.05,0.04,0.01)
for k in range(5): box("hinoki",SX,SY-1.05-0.15*k,TZ+(F-TZ)*(5-k)/5.5-0.08,TZ+(F-TZ)*(5-k)/5.5,0.38,0.08)
extrude_x("hinoki",[(SY-0.68,F+0.95),(SY+0.68,F+0.95),(SY,F+1.75)],SX-1.05,SX+1.05)
EZ=F+0.78; RZ=F+2.05
extrude_x("thatch",[(SY-1.32,EZ),(SY,RZ),(SY+1.32,EZ),(SY+1.18,EZ-0.2),(SY,RZ-0.3),(SY-1.18,EZ-0.2)],SX-1.55,SX+1.55)
box("hinoki",SX,SY,RZ-0.05,RZ+0.2,1.6,0.17)
for k in range(10):
    x=SX-1.3+2.6*k/9
    tube("hinoki",[(x,SY-0.24,RZ+0.3),(x,SY+0.24,RZ+0.3)],[0.075,0.075],6)
    for sy in (-1,1): tube("gold",[(x,SY+sy*0.24,RZ+0.3),(x,SY+sy*0.31,RZ+0.3)],[0.08,0.08],6)
for sx in (-1,1):
    x=SX+sx*1.58
    for sy in (-1,1):                                            # chigi: the bargeboards run on past the ridge
        tube("hinoki",[(x,SY+sy*1.3,EZ-0.05),(x,SY-sy*0.42,RZ+0.65)],[0.06,0.06],4)
    prism("hinoki",SX+sx*1.78,SY,TZ,RZ,0.09,0.08,8)              # munamochi-bashira
# the two treasure houses behind it, in the same style
for hx in (-1.55,1.55):
    X,Y=CX+hx,CY+2.7; f=TZ+0.55
    for x in (-0.45,0.45):
        for y in (-0.3,0.3): prism("hinoki",X+x,Y+y,TZ,f,0.06,0.06,6)
    box("hinoki",X,Y,f-0.06,f,0.62,0.45); box("hinoki",X,Y,f,f+0.62,0.5,0.34)
    extrude_x("thatch",[(Y-0.66,f+0.5),(Y,f+1.15),(Y+0.66,f+0.5),(Y+0.56,f+0.38),(Y,f+0.98),(Y-0.56,f+0.38)],X-0.75,X+0.75)
    for k in range(4): tube("hinoki",[(X-0.5+k/3,Y-0.14,f+1.25),(X-0.5+k/3,Y+0.14,f+1.25)],[0.05,0.05],6)
    for sx in (-1,1):
        for sy in (-1,1): tube("hinoki",[(X+sx*0.76,Y+sy*0.66,f+0.45),(X+sx*0.76,Y-sy*0.25,f+1.45)],[0.04,0.04],4)

# ---- the empty twin site beside it (kodenchi), white stones waiting for the next rebuilding, its little hut
KX,KY=-7.2,2.2
box("pebble",KX,KY,-0.04,0.04,1.9,3.2)
for (ax,ay),(bx,by) in (((-1.9,-3.2),(1.9,-3.2)),((1.9,-3.2),(1.9,3.2)),((1.9,3.2),(-1.9,3.2)),((-1.9,3.2),(-1.9,-3.2))):
    L=math.hypot(bx-ax,by-ay); n=int(L/0.8)
    for k in range(n+1):
        t=k/n; prism("hinokidk",KX+ax+(bx-ax)*t,KY+ay+(by-ay)*t,-0.05,0.55,0.04,0.04,4)
box("hinoki",KX,KY-0.4,0.0,0.45,0.25,0.25)
extrude_x("thatch",[(KY-0.75,0.45),(KY-0.4,0.8),(KY-0.05,0.45)],KX-0.35,KX+0.35)

# ---- the approach: a plain shinmei torii and wooden lanterns on posts
for sx in (-1,1): prism("hinoki",0.8+sx*1.1,-9.0,-0.05,2.6,0.12,0.11,8)
box("hinoki",0.8,-9.0,2.05,2.17,1.3,0.07); box("hinoki",0.8,-9.0,2.6,2.75,1.55,0.11)
for k,y in enumerate((-6.0,-8.0,-10.0)):
    for sx in (-1,1):
        x=0.8+sx*1.35; box("hinokidk",x,y,-0.05,1.2,0.06,0.06); box("hinoki",x,y,1.2,1.25,0.18,0.18)
        box("glow_lantern_%d_%d"%(k,sx+1),x,y,1.25,1.5,0.14,0.14); box("hinokidk",x,y,1.5,1.58,0.2,0.2)

# ---- the cedar forest round it all, tall and straight, with an evergreen understorey
def cedar(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.3,-0.3,6),ngon(0.17,6.0,6)],"bark",T)
    for zc,r,h in ((4.4,1.3,2.0),(5.6,1.05,1.8),(6.8,0.75,1.6),(7.9,0.45,1.2)):
        cone("cedar",ngon(r,zc,7,rng.uniform(0,1)),(0,0,zc+h),T)
def shrub(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    ico("leaf",0,0,0.5,0.85,0.75,0.55,T); ico("leaf",0.45,0.2,0.38,0.55,0.5,0.4,T)
S2=math.sqrt(0.5)
pts=[]
for _ in range(4000):
    x,y=rng.uniform(-FH+1.4,FH-1.4),rng.uniform(-FH+1.4,FH-1.4)
    if TX0-1.2<x<TX1+1.2 and TY0-1.2<y<TY1+1.0: continue
    if KX-2.6<x<KX+2.6 and KY-3.9<y<KY+3.9: continue
    if TX0-1.6<x<TX1+1.6 and y<TY0: continue
    if x>TX1 and y<TY1-1.0: continue
    if S2*(x-y)>5.0: continue                                  # keep the camera's side open
    if any((x-px)**2+(y-py)**2<1.9**2 for px,py in pts): continue
    pts.append((x,y))
    if len(pts)>=26: break
for x,y in pts: cedar(x,y,rng.uniform(0.9,1.15))
for x,y,s in [(4.4,-6.6,1.0),(6.8,-4.4,1.1),(3.4,-9.2,0.9),(8.6,-7.4,0.9),(-2.6,-6.4,0.9),(-4.6,-8.6,1.0),(9.0,-1.6,0.9),(7.4,-9.6,0.8)]:
    shrub(x,y,s)

def ground_at(x,y):
    if TX0-0.05<=x<=TX1+0.05 and TY0-0.05<=y<=TY1+0.05: return TZ
    if SX0<=x<=SX1 and TY0-0.85<=y<TY0: return TZ*(y-(TY0-0.8))/0.8
    return 0.0
INTERACT=(0.8,-3.75)  # at the head of the steps, before the board wall's gate
STAND=(1.3,-5.6)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/ise-jingu.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/ise-jingu.json"
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
    objname=key if key.startswith("glow_") else "ise_"+key
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
