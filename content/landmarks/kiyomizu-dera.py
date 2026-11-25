# Kiyomizu-dera and its wooden stage landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python kiyomizu-dera.py
# Rebuilds content/landmarks/kiyomizu-dera.blend and public/models/landmarks/kiyomizu-dera.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/kiyomizu-dera.glb"
BLEND=ROOT+"/content/landmarks/kiyomizu-dera.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"terrain":"86a75e","darkwood":"6e5442","wood":"d1ab80","bark":"6e4a3a","vermilion":"d96b59","stone":"a39e98","cream":"e8dcb0","foliage":"5f9a52","water":"3fb2bd","glow_cream":"e8dcb0"}
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

def flared_roof(spec,mat="bark",ox=0.0,oy=0.0):
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
rng=random.Random(6)
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
def edge_k(x,y,w):
    # 0 on the footprint's edge (square with chamfered corners), easing to 1 over w units inward,
    # so the sidecar's outer ring is exactly the base height and the game terrain blends from one level
    d=min(FH-abs(x),FH-abs(y),(2*FH-1.2-abs(x)-abs(y))/math.sqrt(2))
    return smooth(0.0,w,d)
FLOORS=[]; EXTRA_SOLIDS=[]
FH=11.2   # footprint half-width (the sidecar's half): the middle size, a hillside precinct
PLAT=3.6   # height of the hillside terrace the main hall stands on
def H(x,y):
    # Mt Otowa: a terrace at the back, falling steeply to the valley floor in front
    return PLAT*smooth(-2.2,2.2,y+0.04*x)*(1-0.7*smooth(7.8,FH,x))*edge_k(x,y,2.6)   # eases to 0 at the footprint edge

def octo(z,h=FH,ch=1.2):
    # the full square footprint: no cut corners, so the model's ground meets the game's terrain all round
    return [(-h,-h,z),(h,-h,z),(h,h,z),(-h,h,z)]
solid([octo(-1.0),octo(0.0)],"stone",mb=None,mt=None)
GS=0.8; NG=int(round(2*FH/GS))
gv={}
for j in range(NG+1):
    for i in range(NG+1):
        x=-FH+i*GS; y=-FH+j*GS
        if 0<i<NG and 0<j<NG:
            x+=rng.uniform(-0.22,0.22); y+=rng.uniform(-0.22,0.22)
        z=H(x,y)
        if 0<i<NG and 0<j<NG and 0.3<z<PLAT-0.3: z+=rng.uniform(-0.12,0.12)
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
            P=[gv[k] for k in t3]
            if area2(*P)<=1e-4: continue
            gf.append([gid[k] for k in t3]); gm.append("terrain")
loop=[(i,0) for i in range(NG+1)]+[(NG,j) for j in range(1,NG+1)]+[(i,NG) for i in range(NG-1,-1,-1)]+[(0,j) for j in range(NG-1,0,-1)]
for n in range(len(loop)):
    A,Bk=gv[loop[n]],gv[loop[(n+1)%len(loop)]]
    if max(A[2],Bk[2])<0.01: continue
    base=len(gverts); gverts+=[(A[0],A[1],0.0),(Bk[0],Bk[1],0.0)]
    gf.append([base,base+1,gid[loop[(n+1)%len(loop)]],gid[loop[n]]]); gm.append("stone")   # stone retaining walls
emit(gverts,gf,gm,orient=False)

# ---- the main hall (hondo) and its stage, in the hanging (kake-zukuri) style: the front half of the
# hall and the whole stage stand out over the cliff on tall zelkova posts tied with crisscrossed beams,
# all under one great hipped roof of cypress bark covering the inner sanctuary and the worship hall
HX,HY=-1.2,3.9; HW,HD=4.2,2.8                      # hall: x HX±HW, y HY±HD (front edge out over the slope)
SX0,SX1,SY0,SY1=-5.8,3.4,-2.6,HY-HD                # stage in front of the hall
WX0,WX1,WY0,WY1,WZ=3.4,4.9,-1.6,HY-HD,PLAT-0.35     # lower side stage (wakibutai) at the right end
box("wood",(SX0+SX1)/2,(SY0+SY1)/2,PLAT-0.15,PLAT,(SX1-SX0)/2,(SY1-SY0)/2)
box("wood",(WX0+WX1)/2,(WY0+WY1)/2,WZ-0.15,WZ,(WX1-WX0)/2,(WY1-WY0)/2)
box("wood",HX,HY,PLAT-0.15,PLAT+0.1,HW+0.25,HD+0.2)
FLOORS+=[(SX0,SX1,SY0,SY1,PLAT),(WX0,WX1,WY0,WY1,WZ)]
def lattice(cols,rows,top):
    for x in cols:
        for y in rows:
            g=H(x,y)
            if g<top-0.35: box("darkwood",x,y,g-0.2,top-0.15,0.1,0.1)
    for z in (0.85,1.75,2.6,3.2):            # tie beams (nuki), where the posts stand clear of the slope
        if z>top-0.3: continue
        for y in rows:
            if H(cols[-1],y)<z-0.15: box("darkwood",(cols[0]+cols[-1])/2,y,z,z+0.13,(cols[-1]-cols[0])/2+0.18,0.06)
        rs=[y for y in rows if H(cols[-1],y)<z-0.15]
        if len(rs)>=2:
            for x in cols: box("darkwood",x,(rs[0]+rs[-1])/2,z+0.13,z+0.24,0.06,(rs[-1]-rs[0])/2+0.12)
lattice([SX0+0.25+0.79*k for k in range(12)],[-2.4,-1.62,-0.84,-0.06,0.72,1.5,2.28],PLAT)
lattice([WX0+0.4,WX1-0.25],[-1.4,-0.6,0.2,0.98],WZ)
def railing(x0,x1,y0,y1,z,sides=("f","l","r")):
    n=int((x1-x0)/0.8)
    if "f" in sides:
        for k in range(n+1): box("darkwood",x0+(x1-x0)*k/n,y0+0.05,z,z+0.48,0.05,0.05)
        box("darkwood",(x0+x1)/2,y0+0.05,z+0.4,z+0.5,(x1-x0)/2,0.05)
    for s,sx in (("l",x0+0.05),("r",x1-0.05)):
        if s not in sides: continue
        m=max(1,int((y1-y0)/0.8))
        for k in range(m+1): box("darkwood",sx,y0+(y1-y0)*k/m,z,z+0.48,0.05,0.05)
        box("darkwood",sx,(y0+y1)/2,z+0.4,z+0.5,0.05,(y1-y0)/2)
railing(SX0,SX1,SY0,SY1,PLAT,("f","l"))
box("darkwood",SX1-0.05,SY0+0.5,PLAT,PLAT+0.5,0.05,0.45)
railing(WX0,WX1,WY0,WY1,WZ,("f","r"))
for k in range(25): EXTRA_SOLIDS.append([SX0+(SX1-SX0)*k/24,SY0,0.3])     # keep valley walkers out from under the decks
for k in range(9): EXTRA_SOLIDS.append([SX0,SY0+(SY1-SY0)*k/8,0.3])
for k in range(4): EXTRA_SOLIDS.append([SX1,SY0+(WY0-SY0)*k/3,0.3])
for k in range(5): EXTRA_SOLIDS.append([WX0+(WX1-WX0)*k/4,WY0,0.3])
for k in range(7): EXTRA_SOLIDS.append([WX1,WY0+(WY1-WY0)*k/6,0.3])
# hall body: short dark walls, latticed shutters along the open front of the worship hall
box("darkwood",HX,HY+0.1,PLAT+0.1,PLAT+1.6,HW-0.3,HD-0.35)
for k in range(9): box("wood",HX-3.5+0.875*k,HY-HD+0.33,PLAT+0.3,PLAT+1.4,0.35,0.03)
for k in range(6): box("wood",HX+HW-0.28,HY-HD+0.9+0.75*k,PLAT+0.3,PLAT+1.4,0.03,0.28)
for x in [HX-HW+0.2+(2*HW-0.4)*k/10 for k in range(11)]: box("darkwood",x,HY-HD+0.12,PLAT+0.1,PLAT+1.65,0.08,0.08)
# the great hipped roof: deep, low-eaved, a short ridge, warm cypress bark
flared_roof([(HW+1.1,HD+1.05,PLAT+1.6,0.45),(HW+1.1,HD+1.05,PLAT+1.78,0.45),(HW+0.15,HD+0.1,PLAT+2.65,0.15),(2.0,0.3,PLAT+4.45,0.0)],"bark",HX,HY)
box("bark",HX,HY,PLAT+4.4,PLAT+4.6,2.15,0.18)
# wing halls (yokuro) reaching forward along both sides of the stage, gable ends to the front
for wx in (HX-HW+0.85,HX+HW-0.85):
    wy=(HY-HD)-0.75
    box("darkwood",wx,wy,PLAT,PLAT+1.3,0.8,0.75)
    box("wood",wx,wy-0.77,PLAT+0.25,PLAT+1.1,0.5,0.03)
    flared_roof([(1.15,1.25,PLAT+1.3,0.2),(1.15,1.25,PLAT+1.43,0.2),(0.9,1.0,PLAT+1.62,0.07),(0.12,0.85,PLAT+2.25,0.0)],"bark",wx,wy+0.25)
    for ox in (-0.75,0.75): box("darkwood",wx+ox,wy-0.72,PLAT,PLAT+1.3,0.07,0.07)

# ---- the vermilion three-storey pagoda on the terrace
PX,PY=7.6,7.4; PS=0.95; PG=H(PX,PY)
def pz(z): return PG+PS*z
box("stone",PX,PY,PG-0.3,pz(0.35),1.25*PS,1.25*PS)
for i in range(3):
    zb=0.35+i*1.25; w=0.95-0.1*i
    box("vermilion",PX,PY,pz(zb),pz(zb+0.92),w*PS,w*PS)
    r0=(w+0.75)*PS; r1=(w+0.36)*PS; r2=(w-0.05)*PS
    flared_roof([(r0,r0,pz(zb+0.9),0.2),(r0,r0,pz(zb+0.99),0.2),(r1,r1,pz(zb+1.12),0.07),(r2,r2,pz(zb+1.25),0.0)],"bark",PX,PY)
prism("bark",PX,PY,pz(4.1),pz(5.6),0.08,0.06,6)
for zz in (4.45,4.75,5.05): prism("bark",PX,PY,pz(zz),pz(zz+0.08),0.22,0.22,8)

# ---- Otowa Waterfall at the foot of the slope: three streams from spouts into a stone pool
OX,OY=6.2,-3.3
box("stone",OX,OY+0.25,-0.05,2.3,1.25,0.35)
extrude_x("bark",[(OY-0.15,2.2),(OY-1.0,1.95),(OY-1.0,2.05),(OY-0.15,2.4)],OX-1.35,OX+1.35)
for k in (-1,0,1):
    box("wood",OX+0.5*k,OY-0.35,1.82,1.9,0.05,0.32)
    box("water",OX+0.5*k,OY-0.62,0.18,1.84,0.035,0.035)
box("stone",OX,OY-1.0,-0.05,0.28,1.2,0.55)
box("water",OX,OY-1.0,0.2,0.29,1.05,0.42)

# ---- stone lanterns (fire boxes are separate glow_ objects)
def lantern(cx,cy,idx):
    T=dict(cx=cx,cy=cy)
    box("stone",0,0,-0.05,0.22,0.4,0.4,T)
    prism("stone",0,0,0.22,1.3,0.17,0.15,6,0,T)
    box("stone",0,0,1.3,1.48,0.38,0.38,T)
    box("glow_lantern_%d"%idx,0,0,1.48,1.92,0.27,0.27,T)
    solid([rect(0.62,0.62,1.92),rect(0.62,0.62,2.0),rect(0.14,0.14,2.3)],"stone",T)
    bipyr("stone",0,0,2.38,0.11,2.28,2.56,6,T)
lantern(8.1,-5.8,1); lantern(4.3,-5.6,2); lantern(9.6,-8.6,3)

# stone path up from the front corner to the waterfall
for k in range(10):
    t=k/9; x=8.6+(OX+0.6-8.6)*t; y=-10.2+(OY-1.9+10.2)*t
    box("cream",0,0,-0.04,0.05,0.42,0.28,dict(cx=x+rng.uniform(-0.08,0.08),cy=y,rot=-0.55+rng.uniform(-0.15,0.15)))

# ---- autumn maples and green trees on the slope and the terrace
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
    prism("darkwood",0,0,-0.3,1.1,0.17,0.14,6,0,T)
    ico("vermilion",0,0,1.85,1.1,1.05,0.85,T)
    ico("vermilion",0.5,-0.3,1.35,0.65,0.6,0.5,T)
for a in [(-8.9,-2.0,1.0),(-5.6,-6.4,0.9),(-2.4,-8.2,0.85),(9.6,-0.6,0.85),(-8.8,6.4,0.9),(2.0,9.8,0.85),(-9.4,-7.6,0.8),(1.4,-9.6,0.85),(5.4,-9.8,0.8)]: maple(*a)
for a in [(-8.8,-4.8,0.85),(6.2,-8.2,0.8),(-5.2,9.8,0.9)]: roundtree(*a)
for a in [(-9.6,2.8,0.9,0.2),(4.6,9.8,0.9,0.6),(9.8,3.0,0.85,0.4),(-1.8,9.8,0.85,0.9),(9.6,9.4,0.8,0.3)]: conifer(*a)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/kiyomizu-dera.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=FH; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y):
    h=H(x,y)
    for x0,x1,y0,y1,top in FLOORS:
        if x0<=x<=x1 and y0<=y<=y1: h=max(h,top)
    return h
ground=[[round(ground_at(-HALF+GSTEP*ix, -(-HALF+GSTEP*iz)),3) for ix in range(GN)] for iz in range(GN)]
# The terrain follows the hillside alone: the stage stands over open ground on its posts, so the
# decks raise the walkable `ground` but must not raise the terrain, which would bury the posts.
terrain=[[round(H(-HALF+GSTEP*ix, -(-HALF+GSTEP*iz)),3) for ix in range(GN)] for iz in range(GN)]
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
                    if nz>0.92 and z<g+0.6: continue   # the hillside and the deck themselves
                    solid_cells.add((cx,cy))
solids=[[round(-HALF+CELL*(cx+0.5),2), round(-(-HALF+CELL*(cy+0.5)),2), 0.22] for cx,cy in sorted(solid_cells)]
solids+=[[round(x,2),round(-y,2),r] for x,y,r in EXTRA_SOLIDS]
INTERACT=(OX,OY-2.1)   # in front of Otowa Waterfall
STAND=(8.9,-10.0)      # the foot of the path, front-right corner
side={"half":HALF,"step":GSTEP,"ground":ground,"terrain":terrain,"solids":solids,
      "interact":[round(INTERACT[0],2),round(-INTERACT[1],2)],"reach":3.6,"stand":[STAND[0],-STAND[1]]}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/kiyomizu-dera.json"
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
    objname=key if key.startswith("glow_") else "kiyomizu_"+key
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
res={"tris":sum(stats.values()),"per_obj":stats,"materials":len(bpy.data.materials),"min":[round(v,3) for v in mn],"max":[round(v,3) for v in mx],"glb_bytes":os.path.getsize(GLB)}
json.dump(res,open("/tmp/lm_build.json","w"))
