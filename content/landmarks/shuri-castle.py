# Shuri Castle (the vermilion Seiden with its golden karahafu and dragons, the striped court, the curving coral-limestone walls, the hill as an island) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python shuri-castle.py
# Rebuilds content/landmarks/shuri-castle.blend and public/models/landmarks/shuri-castle.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/shuri-castle.glb"
BLEND=ROOT+"/content/landmarks/shuri-castle.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"red":"c8342a","white":"efeae0","roof":"c4604a","gold":"d9b04a","dark":"3a2a24","limestone":"d8cfb8","pave":"cfc6b0","terrain":"86a75e","sand":"e6dcc0","water":"2a6a8a","leaf":"3f7a42","bark":"5a4a3a"}
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
rng=random.Random(52)
EXTRA_SOLIDS=[]; NOSOLID={"leaf"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the castle hill as an island
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
# ---- Shuri: the red palace of the Ryukyu kings on its hill, ringed by curving walls of coral limestone; here the hill
# stands as an island, its slopes green, a beach and landing below the castle's gate
HT=1.6
def isl_m(u,v): return math.hypot(u/8.6,v/8.0)*(1+0.05*math.sin(3*math.atan2(v,u)+0.6))
def top_m(u,v): return ((abs(u+0.4)/4.0)**3+(abs(v)/4.6)**3)**(1/3)
def H(x,y):
    u,v=to_uv(x,y); m=isl_m(u,v); t=top_m(u,v)
    if t<=1.0: return HT
    land=HT*(1-smooth(1.0,1.75,t))+0.15*smooth(1.0,1.75,t)
    return shore(land,m,0.82,1.1)
def water_disc(x,y): return False
def gmat(x,y,h,sl):
    u,v=to_uv(x,y)
    if top_m(u,v)<1.0: return "pave"
    if h<LV+0.35 or (isl_m(u,v)>0.92 and u>2.5 and abs(v)<1.4): return "sand"
    return "terrain"
draw_ground(H,gmat,0.62,skip=lambda x,y: top_m(*to_uv(x,y))<0.97)
draw_sea()
# the walls: curving coral limestone round the hilltop, battered, with rounded corners; tall on the seaward side
# so they carry the near silhouette, and pierced at the front for the gate
NW=48
WSEC=[(1.15,0.05),(0.45,HT-0.25),(0.05,HT+1.15),(-0.3,HT+1.15),(-0.3,HT-0.01)]
def wsec(a):
    c,s_=math.cos(a),math.sin(a); r=1.0/(((abs(c)/4.0)**3+(abs(s_)/4.6)**3)**(1/3))
    return [(*to_xy((r+o)*c-0.4,(r+o)*s_),z) for o,z in WSEC]
for k in range(NW):
    a0,a1=2*math.pi*k/NW,2*math.pi*(k+1)/NW; am=(a0+a1)/2
    if math.cos(am)>0.9 and abs(math.sin(am))<0.25: continue          # the gap for the Hoshinmon
    solid([wsec(a0),wsec(a1)],"limestone")
q=[to_xy(-4.0,-4.3),to_xy(-4.0,4.3),to_xy(3.2,4.3),to_xy(3.2,-4.3)]
emit([(*p,HT) for p in q],[[0,1,2,3]],["pave"])
# the una, the court before the hall, striped in red and white tile
for k in range(11):                                   # widened, wall to wall between the flanking halls
    v0=-2.9+5.8*k/11; v1=-2.9+5.8*(k+1)/11
    q=[to_xy(-0.75,v0),to_xy(-0.75,v1),to_xy(3.1,v1),to_xy(3.1,v0)]
    emit([(*p,HT+0.02) for p in q],[[0,1,2,3]],["red" if k%2==0 else "white"])
# the Seiden: two storeys of vermilion lacquer under orange-red tile, the great karahafu over its steps, dragons on
# its ridge and its porch
SU,SV=-2.4,0.0
ubox("limestone",SU,SV,HT,HT+0.35,1.35,3.1)
ubox("red",SU,SV,HT+0.35,HT+1.65,1.15,2.85)
T=F(SU,SV)
for k in range(9): box("gold" if k%4==0 else "dark",-2.6+0.65*k,-1.16,HT+0.6,HT+1.4,0.24,0.01,T)
for k in range(10): box("dark",-2.85+0.633*k,-1.17,HT+0.35,HT+1.65,0.06,0.03,T)
nb=len(B.get("roof",([],[]))[0])
flared_roof([(3.35,1.65,HT+1.65,0.2),(3.35,1.65,HT+1.75,0.2),(2.7,1.1,HT+2.05,0.05)],"roof",0,0)
box("red",0,0,HT+2.0,HT+2.85,2.55,0.95,T)
for k in range(7): box("dark",-2.1+0.7*k,-0.96,HT+2.2,HT+2.65,0.22,0.01,T)
flared_roof([(3.15,1.5,HT+2.85,0.28),(3.15,1.5,HT+2.97,0.28),(2.4,0.8,HT+3.45,0.06),(2.1,0.1,HT+3.9,0.0)],"roof",0,0)
bv=B["roof"][0]
for i in range(nb,len(bv)):
    x,y,z=bv[i]; bv[i]=(*xf([(x,y,z)],**T)[0][:2],z)
box("white",0,0,HT+3.85,HT+3.98,2.15,0.12,T)
for sx in (-1,1): extrude_y("gold",[(sx*2.1+sx*px,HT+3.95+pz) for px,pz in [(-0.1,0.0),(0.15,0.0),(0.2,0.3),(0.05,0.5),(0.0,0.28),(-0.12,0.4)]],-0.06,0.06,T)
TK=F(SU,SV,0.0,HT+1.65)
lo=[(-1.3,0),(-0.78,0.3),(-0.33,0.88),(0,1.02),(0.33,0.88),(0.78,0.3),(1.3,0)]
box("red",0,-1.6,-1.3,0.0,1.2,0.45,TK)
for sx in (-1,1): box("dark",sx*1.1,-2.0,-1.3,0.0,0.07,0.07,TK)
extrude_y("gold",lo,-1.55,-2.2,TK)
hi=[(1.52,-0.08),(0.8,0.44),(0.34,1.05),(0,1.2),(-0.34,1.05),(-0.8,0.44),(-1.52,-0.08)]
extrude_y("roof",lo+hi,-1.5,-2.35,TK)
for k in range(5): ubox("limestone",SU+1.45+0.18*k,SV,HT,HT+0.35-0.07*k,0.09,0.9)
# the pair of stone dragon columns (dairyuchu) before the steps, set well out to either side so they read as two
for sv in (-1.45,1.45):
    x,y=to_xy(SU+1.75,sv)
    prism("limestone",x,y,HT,HT+0.2,0.2,0.2,8); prism("limestone",x,y,HT+0.2,HT+1.3,0.11,0.1,8)
    for zc in (HT+0.45,HT+0.8,HT+1.1): prism("gold",x,y,zc,zc+0.08,0.15,0.15,8)
    ico("gold",x,y,HT+1.42,0.17,0.17,0.15); ico("gold",*to_xy(SU+1.95,sv),HT+1.38,0.11,0.09,0.08)
# the Nanden and Hokuden flanking the court
for hv,col in ((-3.95,"red"),(3.95,"red")):           # set back to the court's edges, so the striped una opens between them
    ubox("limestone",0.6,hv,HT,HT+0.2,2.3,0.55)
    ubox(col,0.6,hv,HT+0.2,HT+1.15,2.1,0.42)
    T2=F(0.6,hv,math.pi/2)
    nb=len(B["roof"][0]); flared_roof([(2.5,0.78,HT+1.15,0.14),(2.5,0.78,HT+1.22,0.14),(2.0,0.08,HT+1.75,0.0)],"roof",0,0)
    bv=B["roof"][0]
    for i in range(nb,len(bv)):
        x,y,z=bv[i]; bv[i]=(*xf([(x,y,z)],**T2)[0][:2],z)
# the Hoshinmon gate in the front wall, and the stone steps down the hill to the beach
GU=3.85                                               # low, in the wall's gap, so it doesn't screen the court
ubox("red",GU,0.0,HT+0.75,HT+1.05,0.28,1.05)
for sv in (-0.75,0.75): ubox("dark",GU,sv,HT,HT+1.05,0.3,0.08)
T3=F(GU,0.0)
nb=len(B["roof"][0]); flared_roof([(1.35,0.5,HT+1.05,0.1),(1.35,0.5,HT+1.12,0.1),(0.95,0.07,HT+1.4,0.0)],"roof",0,0)
bv=B["roof"][0]
for i in range(nb,len(bv)):
    x,y,z=bv[i]; bv[i]=(*xf([(x,y,z)],**T3)[0][:2],z)
SU0,SU1=3.7,6.4
def stair_z(u): return HT+(0.15-HT)*(u-SU0)/(SU1-SU0)
for k in range(10):                                   # low slabs on the slope, not a white wedge: the walls lead the eye
    u=SU0+(SU1-SU0)*(k+0.5)/10; ubox("pave",u,0.0,stair_z(u)-0.16,stair_z(u),(SU1-SU0)/20,0.45)
def on_stair(u,v): return SU0-0.35<=u<=SU1 and abs(v)<=0.45
# the landing on the beach
JD=LV+0.3; JU0,JU1,JV=6.6,9.0,0.0
def on_jetty(u,v): return JU0<=u<=JU1 and abs(v-JV)<=0.5
ubox("limestone",(JU0+JU1)/2,JV,FLOOR,JD,(JU1-JU0)/2,0.5)
# banyan (gajumaru), palms and fukugi trees on the slopes
def tree(u,v,s,m="leaf"):
    x,y=to_xy(u,v); z=H(x,y); T4=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.22,-0.4,6),ngon(0.14,1.4,6)],"bark",T4)
    ico(m,0,0,2.0,1.25,1.15,0.85,T4); ico(m,0.6,0.35,1.6,0.8,0.75,0.55,T4)
def palm(u,v,s):
    x,y=to_xy(u,v); z=H(x,y); lean=rng.uniform(0,6.28); dx,dy=math.cos(lean)*0.5*s,math.sin(lean)*0.5*s
    pts=[(x,y,z-0.3),(x+dx*0.4,y+dy*0.4,z+1.2*s),(x+dx,y+dy,z+2.6*s)]
    tube("bark",pts,[0.12*s,0.1*s,0.08*s],5)
    tx,ty,tz=pts[-1]
    for k in range(7):
        a=2*math.pi*k/7
        cone("leaf",[(tx-0.07*math.sin(a),ty+0.07*math.cos(a),tz),(tx+0.07*math.sin(a),ty-0.07*math.cos(a),tz),(tx+0.2*math.cos(a),ty+0.2*math.sin(a),tz+0.1)],(tx+1.2*s*math.cos(a),ty+1.2*s*math.sin(a),tz-0.6*s))
for u,v,s in [(-6.2,-3.0,1.0),(-6.6,2.4,1.0),(-4.8,5.8,0.95),(-4.6,-5.8,0.95),(1.6,6.2,0.9),(1.8,-6.2,0.9),(4.4,-4.6,0.85),(4.4,4.6,0.85)]:
    tree(u,v,s)
for u,v,s in [(6.0,-2.6,0.9),(6.6,2.8,0.85),(5.2,-6.0,0.8),(5.4,5.8,0.8),(7.2,-0.9,0.7)]:
    palm(u,v,s)
def ground_at(x,y):
    u,v=to_uv(x,y)
    if on_jetty(u,v): return max(JD,H(x,y))
    if on_stair(u,v): return max(stair_z(min(max(u,SU0),SU1)),H(x,y))
    return H(x,y)
INTERACT=to_xy(1.6,0.0)   # on the striped court before the Seiden
STAND=to_xy(2.2,1.6)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/shuri-castle.json and read by the world layer (see docs/landmarks.md).
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
                    # The route down the Hoshinmon steps must stay open through the limestone wall.
                    u,v=to_uv(-HALF+CELL*(ck[0]+0.5),-HALF+CELL*(ck[1]+0.5))
                    if SU0-0.85<=u<=JU1+0.4 and abs(v-JV)<0.65: continue
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/shuri-castle.json"
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
    objname=key if key.startswith("glow_") else "shuri_"+key
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
