# Amanohashidate (the pine-lined sandbar curving across the bay, Kono shrine's torii at its northern end, the swing bridge and Chionji's gate at its southern end) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python amanohashidate.py
# Rebuilds content/landmarks/amanohashidate.blend and public/models/landmarks/amanohashidate.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/amanohashidate.glb"
BLEND=ROOT+"/content/landmarks/amanohashidate.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"sand":"ece4cc","grass":"6f8a4a","pine":"355f36","bark":"5a4a3a","path":"d8cfb8","stone":"9a958c","steel":"8a8e90","red":"c8473a","concrete":"b5b0a6","darkwood":"4a3a2e","tile":"4e5256","water":"2a6a8a"}
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
rng=random.Random(55)
EXTRA_SOLIDS=[]; NOSOLID={"pine"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the sandbar curving across the bay
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
# ---- Amanohashidate, the bridge to heaven: a sandbar three kilometres long, lined with eight thousand pines and white
# beaches, laid across Miyazu Bay. Here it curves across the footprint from a wooded hill (the Kasamatsu side, with the
# torii of Kono shrine) to the swing bridge and Chionji's gate at its southern end, where the landing is
def cl(v): return 1.6*math.sin(0.2*v+0.4)
def bar_w(v): return 1.15+0.15*math.sin(0.7*v)
V0,V1=-8.6,5.6
HC=(-1.8,-8.4); HR=2.6                               # the hill at the northern end
IC=(1.2,8.5); IR=1.35                                 # Chionji's islet at the southern end, across the channel
def H(x,y):
    u,v=to_uv(x,y)
    d=abs(u-cl(v))/bar_w(v)
    hb=LV
    if V0<=v<=V1: hb=shore(0.1,d,0.72,1.12)
    elif v<V0: hb=shore(0.1,math.hypot(d,(V0-v)/1.0),0.6,1.2)
    elif v>V1: hb=shore(0.1,math.hypot(d,(v-V1)/0.6),0.6,1.2)
    mh=math.hypot((u-HC[0])/HR,(v-HC[1])/(HR*1.15))
    hh=shore(0.3+1.5*max(0.0,1-mh/0.75),mh,0.75,1.12)
    mi=math.hypot(u-IC[0],v-IC[1])/IR
    hi=shore(0.15,mi,0.75,1.15)
    return max(hb,hh,hi)
def water_disc(x,y): return False
def gmat(x,y,h,sl):
    u,v=to_uv(x,y)
    if h<0.02 or (abs(u-cl(v))>bar_w(v)*0.45 and math.hypot((u-HC[0])/HR,(v-HC[1])/(HR*1.15))>0.75 and math.hypot(u-IC[0],v-IC[1])>IR*0.7): return "sand"
    return "grass"
draw_ground(H,gmat,0.5,0.1)
draw_sea()
# the pines: crowded down the whole length of the bar, wind-bent, and thick on the hill
def pine(x,y,s,lean=None):
    z=H(x,y); lean=rng.uniform(0,6.28) if lean is None else lean
    dx,dy=math.cos(lean)*0.45*s,math.sin(lean)*0.45*s
    pts=[(x,y,z-0.2),(x+dx*0.4,y+dy*0.4,z+0.9*s),(x+dx,y+dy,z+1.7*s)]
    tube("bark",pts,[0.09*s,0.07*s,0.05*s],5)
    tx,ty,tz=pts[-1]
    ico("pine",tx,ty,tz,0.75*s,0.7*s,0.36*s); ico("pine",tx-0.45*dx,ty-0.45*dy,tz-0.45*s,0.55*s,0.5*s,0.28*s)
v=V0+0.4
while v<V1-0.2:
    for off in (-0.36,0.36):
        if rng.random()<0.8:
            u=cl(v)+off*bar_w(v)+rng.uniform(-0.1,0.1); x,y=to_xy(u,v)
            if abs(v-(-1.0))<1.1: continue                               # leave a clearing for the arrival
            pine(x,y,rng.uniform(0.75,1.0))
    v+=0.62
for k in range(14):
    a=rng.uniform(0,6.28); r=rng.uniform(0,0.65)*HR
    u,v=HC[0]+r*math.cos(a),HC[1]+1.15*r*math.sin(a); x,y=to_xy(u,v)
    if max(abs(x),abs(y))<FH-1.4: pine(x,y,rng.uniform(0.9,1.15))
# Kono shrine's torii at the foot of the hill, where the bar begins
tu,tv=cl(V0+0.6)+0.1,V0+0.6; T=F(tu,tv,0.0,H(*to_xy(tu,tv)))
for sx in (-1,1): prism("stone",*xf([(sx*0.55,0,0)],**T)[0][:2],T["cz"],T["cz"]+1.4,0.07,0.06,8)
box("stone",0,0,1.1,1.18,0.7,0.06,T); box("stone",0,0,1.4,1.5,0.85,0.08,T)
# the path down the bar, and at the southern end the swing bridge over the channel to Chionji's islet
pts=[]
v=V0+0.6
while v<V1+0.1:
    pts.append((cl(v),v)); v+=0.5
for (ua,va),(ub,vb) in zip(pts,pts[1:]):
    q=[to_xy(ua-0.28,va),to_xy(ua+0.28,va),to_xy(ub+0.28,vb),to_xy(ub-0.28,vb)]
    emit([(x,y,H(x,y)+0.03) for x,y in q],[[0,1,2,3]],["path"])
BU0,BV0=cl(V1),V1+0.45; BU1,BV1=IC[0]-0.15,IC[1]-IR*0.7
BZ=0.6
def bridge_z(u,v):
    L2=(BU1-BU0)**2+(BV1-BV0)**2; t=((u-BU0)*(BU1-BU0)+(v-BV0)*(BV1-BV0))/L2
    if not 0<=t<=1: return None
    pu,pv=BU0+(BU1-BU0)*t,BV0+(BV1-BV0)*t
    if math.hypot(u-pu,v-pv)>0.42: return None
    return 0.1+(BZ-0.1)*math.sin(math.pi*t)**0.6
n=8; bp=[(BU0+(BU1-BU0)*k/n,BV0+(BV1-BV0)*k/n) for k in range(n+1)]
L=math.hypot(BU1-BU0,BV1-BV0); nu,nv=-(BV1-BV0)/L*0.42,(BU1-BU0)/L*0.42
for (ua,va),(ub,vb) in zip(bp,bp[1:]):
    za,zb=bridge_z(ua+1e-3*(BU1-BU0),va+1e-3*(BV1-BV0)) or 0.1,bridge_z(ub-1e-3*(BU1-BU0),vb-1e-3*(BV1-BV0)) or 0.1
    a=[(*to_xy(ua-nu,va-nv),za-0.1),(*to_xy(ua+nu,va+nv),za-0.1),(*to_xy(ua+nu,va+nv),za),(*to_xy(ua-nu,va-nv),za)]
    b=[(*to_xy(ub-nu,vb-nv),zb-0.1),(*to_xy(ub+nu,vb+nv),zb-0.1),(*to_xy(ub+nu,vb+nv),zb),(*to_xy(ub-nu,vb-nv),zb)]
    solid([a,b],"steel")
for sd in (-1,1):
    tube("red",[(*to_xy(u+sd*nu,v+sd*nv),(bridge_z(u,v) if bridge_z(u,v) is not None else 0.1)+0.5) for u,v in bp],[0.03]*len(bp),4)
x,y=to_xy((BU0+BU1)/2,(BV0+BV1)/2); prism("concrete",x,y,FLOOR,BZ-0.1,0.35,0.35,8)
# Chionji's two-storey gate (sanmon) on the islet, and the landing
GU_,GV_=IC[0]+0.1,IC[1]+0.1; T2=F(GU_,GV_,0.0,H(*to_xy(GU_,GV_)))
for x_ in (-0.7,0.0,0.7):
    for y_ in (-0.35,0.35): box("darkwood",x_,y_,0.0,1.1,0.06,0.06,T2)
box("darkwood",0,0,0.95,1.1,0.85,0.42,T2)
frus("tile",0,0,1.1,1.3,1.25,0.75,0.8,0.32,T=T2)
box("darkwood",0,0,1.32,1.75,0.68,0.33,T2)
frus("tile",0,0,1.75,2.15,1.2,0.72,0.6,0.06,T=T2)
JD=LV+0.3; JU0,JU1,JV=IC[0]+1.0,IC[0]+3.2,IC[1]-0.2
def on_jetty(u,v): return JU0-0.2<=u<=JU1 and abs(v-JV)<=0.45
ubox("darkwood",(JU0+JU1)/2,JV,FLOOR,JD,(JU1-JU0)/2,0.45)
def ground_at(x,y):
    u,v=to_uv(x,y)
    if on_jetty(u,v): return max(JD,H(x,y))
    z=bridge_z(u,v)
    if z is not None: return max(z,H(x,y))
    return H(x,y)
def terrain_at(x,y): return H(x,y)
INTERACT=to_xy(cl(-1.0),-1.0)      # on the path halfway along the bar
STAND=to_xy(cl(-1.0)-0.35,-0.6)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/amanohashidate.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/amanohashidate.json"
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
    objname=key if key.startswith("glow_") else "amano_"+key
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
