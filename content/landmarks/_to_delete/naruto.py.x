# Naruto whirlpools (the whirlpools turning in the strait under the Onaruto suspension bridge, the pine-clad headlands, a tour boat) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python naruto.py
# Rebuilds content/landmarks/naruto.blend and public/models/landmarks/naruto.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/naruto.glb"
BLEND=ROOT+"/content/landmarks/naruto.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"grass":"5f8a45","rock":"6e665c","water":"244e6e","foam":"e8f0f0","deep":"1a3f5a","bridge":"dfe2e0","concrete":"b5b0a6","white":"f0ede6","red":"c8473a","pine":"3a5e36","bark":"4e3a30","wood":"7a5a3e"}
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
rng=random.Random(51)
EXTRA_SOLIDS=[]; NOSOLID={"pine","foam","deep"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the strait between its headlands
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
# ---- the Naruto strait: two rocky, pine-clad headlands either side of a channel of racing sea, the Onaruto
# suspension bridge flying over it, and the whirlpools turning beneath; a tour boat in the channel, a landing below
# the right-hand headland
HDS=[(-0.6,-7.3,5.2,2.0),(0.4,7.4,5.0,2.1)]
def hd_m(u,v):
    return min(((abs(u-cu)/ru)**2.4+(abs(v-cv)/rv)**2.4)**(1/2.4) for cu,cv,ru,rv in HDS)
def hd_top(u,v):
    return 1.4+0.6*math.sin(0.7*u+0.3*v)+0.9*max(0.0,1-hd_m(u,v)/0.6)
def H(x,y):
    u,v=to_uv(x,y); m=hd_m(u,v)
    return shore(hd_top(u,v),m,0.7,1.12)
def water_disc(x,y): return False
def gmat(x,y,h,sl):
    if h<LV+0.3 or sl>1.6: return "rock"
    return "grass"
draw_ground(H,gmat,0.62)
draw_sea()
for k in range(26):                                   # boulders and reefs round the headlands
    cu,cv,ru,rv=HDS[k%2]; a=rng.uniform(0,6.28)
    u,v=cu+ru*1.05*math.cos(a),cv+rv*1.05*math.sin(a)
    if abs(v)<4.5 or abs(to_xy(u,v)[0])>FH-1 or abs(to_xy(u,v)[1])>FH-1: continue
    x,y=to_xy(u,v); ico("rock",x,y,LV,rng.uniform(0.3,0.6),rng.uniform(0.25,0.5),rng.uniform(0.3,0.5))
# whirlpools: a darker funnel of water ringed by broken arcs of foam, the arcs trailing off into the eye; the
# largest turns right under the bridge. The tide runs through the strait along u, so the streaks all point that way
def arc(x0,y0,r0,r1,a0,a1,w,mat="foam",n=8):
    for k in range(n):
        ta,tb=k/n,(k+1)/n
        aa,ab=a0+(a1-a0)*ta,a0+(a1-a0)*tb; ra,rb=r0+(r1-r0)*ta,r0+(r1-r0)*tb
        wa,wb=w*(1-0.6*ta),w*(1-0.6*tb)                     # each arc tapers as it curls in
        P=lambda a,r,d: (x0+(r+d)*math.cos(a),y0+(r+d)*math.sin(a),LV+0.02)
        emit([P(aa,ra,-wa),P(aa,ra,wa),P(ab,rb,wb),P(ab,rb,-wb)],[[0,1,2,3]],[mat])
def whirl(u0,v0,R,narc=4):
    x0,y0=to_xy(u0,v0)
    prism("deep",x0,y0,LV-0.02,LV+0.005,R*0.78,R*0.78,14)                 # the funnel's dark water
    prism("water",x0,y0,LV-0.02,LV+0.01,R*0.3,R*0.3,10)                    # the eye, darker still by contrast
    ph=rng.uniform(0,6.28)
    for k in range(narc):
        a0=ph+2*math.pi*k/narc; span=2*math.pi/narc*rng.uniform(0.55,0.8)
        arc(x0,y0,R*rng.uniform(0.9,1.0),R*0.42,a0,a0+span*1.6,0.11+0.04*R)
whirl(-0.6,-1.2,2.2,5); whirl(-4.2,2.6,1.4,3); whirl(3.6,2.2,1.1,3); whirl(2.4,-4.0,0.8,3)
for k in range(46):                                   # the white water racing through the strait, all one way
    u,v=rng.uniform(-8,8),rng.uniform(-4.2,4.2); x,y=to_xy(u,v)
    if any(math.hypot(u-a,v-b)<r*0.85 for a,b,r in ((-0.6,-1.2,2.2),(-4.2,2.6,1.4),(3.6,2.2,1.1),(2.4,-4.0,0.8))): continue
    L=rng.uniform(0.5,1.4); w=0.04+0.03*rng.random(); bend=rng.uniform(-0.15,0.15)
    p0=to_xy(u,v); p1=to_xy(u+L*0.5,v+bend); p2=to_xy(u+L,v+2*bend)
    for (xa,ya),(xb,yb),wa,wb in ((p0,p1,w*0.4,w),(p1,p2,w,0.0)):
        nx,ny=-(yb-ya),(xb-xa); nl=math.hypot(nx,ny) or 1; nx,ny=nx/nl,ny/nl
        emit([(xa-nx*wa,ya-ny*wa,LV+0.015),(xa+nx*wa,ya+ny*wa,LV+0.015),(xb+nx*wb,yb+ny*wb,LV+0.015),(xb-nx*wb,yb-ny*wb,LV+0.015)],[[0,1,2,3]],["foam"])
# the Onaruto bridge: two towers in the sea, a deep steel truss deck, the main cables and their hangers
DZ=4.6; TV=(-4.4,4.4)
for tv in TV:
    for su in (-0.75,0.75):
        x,y=to_xy(su,tv); box("bridge",x,y,LV-0.5,DZ+2.6,0.16,0.16)
    ubox("bridge",0,tv,DZ+2.3,DZ+2.6,0.9,0.18); ubox("bridge",0,tv,DZ-0.9,DZ-0.7,0.9,0.15)
    x,y=to_xy(0,tv); prism("concrete",x,y,LV-0.6,LV+0.35,1.2,1.1,8)
V0,V1=-8.4,8.4
ubox("bridge",0,0,DZ-0.55,DZ-0.4,0.75,(V1-V0)/2)
ubox("bridge",0,0,DZ,DZ+0.12,0.75,(V1-V0)/2)
for sd in (-1,1):
    for k in range(int((V1-V0)/0.6)):
        va=V0+0.6*k; vb=va+0.6
        tube("bridge",[(*to_xy(sd*0.73,va),DZ-0.5),(*to_xy(sd*0.73,vb),DZ+0.07)],[0.025,0.025],4)
for sd in (-0.75,0.75):
    pts=[]
    for k in range(25):
        v=V0+(V1-V0)*k/24
        if v<TV[0]: z=DZ+0.4+(DZ+2.6-(DZ+0.4))*(v-V0)/(TV[0]-V0)
        elif v>TV[1]: z=DZ+2.6+(DZ+0.4-(DZ+2.6))*(v-TV[1])/(V1-TV[1])
        else: t=(v-TV[0])/(TV[1]-TV[0]); z=DZ+0.25+(2.35)*(2*t-1)**2
        pts.append((*to_xy(sd,v),z))
    tube("bridge",pts,[0.05]*len(pts),4)
    for p in pts[1:-1:2]: tube("bridge",[p,(p[0],p[1],DZ+0.12)],[0.012,0.012],3)
for sv in (-1,1):                                     # anchorages on the headlands
    x,y=to_xy(0,sv*8.6); z=H(x,y); ubox("concrete",0,sv*8.6,z-0.6,DZ+0.5,1.0,0.7)
# the tour boat in the channel
def boat(u,v,ang):
    T=F(u,v,ang,LV)
    solid([[(-1.0,-0.3,-0.05),(1.0,-0.3,-0.05),(1.0,0.3,-0.05),(-1.0,0.3,-0.05)],[(-1.25,-0.42,0.3),(1.3,-0.3,0.3),(1.3,0.3,0.3),(-1.25,0.42,0.3)]],"white",T)
    box("white",-0.15,0,0.3,0.75,0.7,0.36,T); box("rock",-0.15,-0.37,0.45,0.65,0.62,0.01,T); box("rock",-0.15,0.37,0.45,0.65,0.62,0.01,T)
    box("red",-0.15,0,0.75,0.82,0.75,0.4,T)
boat(3.6,-2.6,0.4)
# pines on the headlands, and the landing below the right-hand one
def pine(x,y,s):
    z=H(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.13,-0.4,5),ngon(0.09,1.5,5,0,0.3,0)],"bark",T)
    for zc,r,dx in ((1.8,0.9,0.3),(1.35,0.65,-0.3),(2.2,0.5,0.5)): ico("pine",dx,0.1,zc,r,r*0.9,r*0.4,T)
for k in range(30):
    cu,cv,ru,rv=HDS[k%2]
    while True:
        u,v=cu+rng.uniform(-1,1)*ru*0.8,cv+rng.uniform(-1,1)*rv*0.75
        if hd_m(u,v)<0.68: break
    if (k%2==1 and u>2.6) or abs(v)>9.2: continue
    pine(*to_xy(u,v),rng.uniform(0.75,1.05))
JD=LV+0.3; JU0,JU1,JV=3.4,6.8,5.9
def on_jetty(u,v): return JU0<=u<=JU1 and abs(v-JV)<=0.5
ubox("wood",(JU0+JU1)/2,JV,FLOOR,JD,(JU1-JU0)/2,0.5)
for k in range(5):
    for sd in (-1,1): ubox("wood",JU0+0.3+(JU1-JU0-0.4)*k/4,JV+sd*0.45,FLOOR,JD+0.5,0.04,0.04)
def ground_at(x,y):
    u,v=to_uv(x,y)
    if on_jetty(u,v): return max(JD,H(x,y))
    return H(x,y)
INTERACT=to_xy(3.6,JV)       # at the jetty's head under the headland, the whirlpools and the bridge before it
STAND=to_xy(2.8,6.6)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/naruto.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/naruto.json"
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
    objname=key if key.startswith("glow_") else "naruto_"+key
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
