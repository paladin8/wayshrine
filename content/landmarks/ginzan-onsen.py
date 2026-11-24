# Ginzan Onsen landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python ginzan-onsen.py
# Rebuilds content/landmarks/ginzan-onsen.blend and public/models/landmarks/ginzan-onsen.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/ginzan-onsen.glb"
BLEND=ROOT+"/content/landmarks/ginzan-onsen.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"snow":"eef2f4","water":"2a4e62","stonewall":"8f8a80","pave":"a8a298","wood":"4a3528","plaster":"ece6d8","roof":"3e4248","iron":"2a2c30","rock":"6e6a66","red":"b8402e","fir":"2f4f3e","glow_cream":"e8dcb0"}
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
rng=random.Random(63)
EXTRA_SOLIDS=[]; NOSOLID={"fir","roof","snow"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the onsen street along its river
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0

# ---- the Ginzan river: a narrow stone-walled channel down the middle of the street, fed by the falls at its head
RW=1.1; RY0,RY1=-8.6,7.25; CH=-0.75; WZ=-0.42
def in_river(x,y,m=0.0): return abs(x)<RW-m and RY0+m<y<RY1-m
BRS=[(-6.3,0.6,"red"),(1.2,0.55,"wood")]
def on_bridge(x,y): return any(abs(y-by)<bw and abs(x)<RW+0.35 for by,bw,_ in BRS)
def G(x,y): return CH if in_river(x,y) else 0.0
emit([(-RW,RY0,WZ),(RW,RY0,WZ),(RW,RY1,WZ),(-RW,RY1,WZ)],[[0,1,2,3]],["water"])
def wall(x0,y0,x1,y1,z0,z1,mat="stonewall"):
    solid([[(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0)],[(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)]],mat)
for sd in (-1,1): wall(sd*RW,RY0-0.25,sd*(RW+0.22),RY1+0.25,CH-0.05,0.06)
for y0,y1 in ((RY0-0.25,RY0),(RY1,RY1+0.25)): wall(-RW-0.22,y0,RW+0.22,y1,CH-0.05,0.06)
for k in range(10):                                  # stones in the stream
    x,y=rng.uniform(-0.8,0.8),rng.uniform(RY0+0.6,RY1-0.8)
    if on_bridge(x,y): continue
    ico("stonewall",x,y,WZ,rng.uniform(0.12,0.22),rng.uniform(0.1,0.18),0.08)
# the walks along both banks
for sd in (-1,1): wall(sd*(RW+0.22),RY0-0.25,sd*2.7,RY1+0.25,-0.05,0.03,"pave")
# the bridges: a red-railed one by the entrance, a plain timber one mid-street
for by,bw,rm in BRS:
    wall(-RW-0.35,by-bw,RW+0.35,by+bw,-0.05,0.14,"wood")
    for sy in (-1,1):
        y=by+sy*(bw-0.05)
        for x in (-RW-0.25,-0.4,0.4,RW+0.25): box(rm,x,y,0.14,0.68,0.045,0.045)
        wall(-RW-0.3,y-0.04,RW+0.3,y+0.04,0.6,0.7,rm)

# ---- the ryokan: three and four storeys of dark timber and white plaster, every floor lit, pent eaves under
# snow, balconies on the upper floors; gables face the river on some, ridges run along it on others
def pent(fx,sd,y0,y1,z,o=0.42):
    P=[(fx,z+0.12),(fx-sd*o,z-0.08),(fx-sd*o,z-0.15),(fx,z+0.04)]
    solid([[(x,y0,zz) for x,zz in P],[(x,y1,zz) for x,zz in P]],"roof")
    S=[(fx,z+0.2),(fx-sd*(o-0.06),z+0.0),(fx-sd*(o-0.06),z-0.06),(fx,z+0.12)]
    solid([[(x,y0+0.05,zz) for x,zz in S],[(x,y1-0.05,zz) for x,zz in S]],"snow")
def ryokan(sd,cy,L,D,ns,gable,tower=False,fx0=2.75):
    cx=sd*(fx0+D); fx=sd*fx0; zs=[0.0,1.1]+[1.1+0.9*k for k in range(1,ns)]
    box("wood",cx,cy,-0.1,zs[1],D,L)
    box("glow_windows",fx-sd*0.02,cy,0.15,0.9,0.02,L*0.7)
    for s in range(1,ns):
        z0,z1=zs[s],zs[s+1]
        box("plaster",cx,cy,z0,z1,D-0.03,L-0.03)
        for k in range(4): box("wood",fx-sd*0.01,cy-L+0.08+k*(2*L-0.16)/3,z0,z1,0.02,0.06)
        box("wood",fx-sd*0.01,cy,z0,z0+0.12,0.02,L)
        nw=max(2,int(L/0.55))
        for k in range(nw):
            y=cy-L+(k+0.5)*2*L/nw
            box("glow_windows",fx-sd*0.02,y,z0+0.25,z1-0.15,0.02,L/nw*0.62)
        if s>=2: box("iron",fx-sd*0.22,cy,z0+0.3,z0+0.36,0.025,L-0.05)
        pent(fx,sd,cy-L-0.05,cy+L+0.05,z0)
    zt=zs[ns]; R=0.9
    if gable:   # ridge across the street, the gable facing the river
        T=dict(cx=cx,cy=cy,rot=math.pi/2)
        extrude_y("plaster",[(-L+0.03,zt-0.02),(L-0.03,zt-0.02),(0,zt+R-0.12)],-D+0.03,D-0.03,T)
        extrude_y("roof",[(-L-0.35,zt-0.14),(L+0.35,zt-0.14),(0,zt+R)],-D-0.35,D+0.35,T)
        extrude_y("snow",[(-L-0.3,zt-0.04),(L+0.3,zt-0.04),(0,zt+R+0.1)],-D-0.3,D+0.3,T)
        box("glow_windows",fx-sd*0.02,cy,zt+0.12,zt+0.45,0.02,0.22)
    else:
        extrude_y("plaster",[(cx-D+0.03,zt-0.02),(cx+D-0.03,zt-0.02),(cx,zt+R*0.8-0.12)],cy-L+0.03,cy+L-0.03)
        extrude_y("roof",[(cx-D-0.35,zt-0.14),(cx+D+0.35,zt-0.14),(cx,zt+R*0.8)],cy-L-0.35,cy+L+0.35)
        extrude_y("snow",[(cx-D-0.3,zt-0.04),(cx+D+0.3,zt-0.04),(cx,zt+R*0.8+0.1)],cy-L-0.3,cy+L+0.3)
    if ns>1: box("wood",fx-sd*0.1,cy-L+0.25,1.3,zt-0.1,0.07,0.16)          # the tall signboard
    else:       # the low bathhouses on the near bank show their lit backs to the hillside path
        bx=cx+sd*D
        for k in range(3): box("glow_windows",bx+sd*0.02,cy-L+(k+0.5)*2*L/3,0.35,0.85,0.02,L/3*0.6)
        P=[(bx,0.98),(bx+sd*0.4,0.8),(bx+sd*0.4,0.74),(bx,0.9)]
        solid([[(x,cy-L,zz) for x,zz in P],[(x,cy+L,zz) for x,zz in P]],"roof")
        pent(fx,sd,cy-L,cy+L,1.0,0.35)
    if tower:
        tx=cx; tz=zt+R*0.55
        box("plaster",tx,cy,tz-0.3,tz+0.75,0.42,0.42)
        box("glow_windows",tx-sd*0.43,cy,tz+0.05,tz+0.55,0.02,0.28)
        flared_roof([(0.72,0.72,tz+0.75,0.1),(0.72,0.72,tz+0.82,0.1),(0.05,0.05,tz+1.25,0.0)],"roof",tx,cy)
        flared_roof([(0.64,0.64,tz+0.84,0.04),(0.64,0.64,tz+0.87,0.04),(0.03,0.03,tz+1.29,0.0)],"snow",tx,cy)
for sd,cy,L,D,ns,gab,tw in [(-1,-7.2,1.3,1.4,3,True,False),(-1,-3.9,1.6,1.5,4,False,False),(-1,-0.3,1.4,1.4,3,True,True),(-1,3.2,1.6,1.5,3,False,False),(-1,6.1,1.0,1.3,3,True,False),
                            (1,-6.3,1.3,1.2,1,False,False),(1,-1.9,1.3,1.2,1,True,False),(1,4.0,1.4,1.2,1,False,False)]:
    ryokan(sd,cy,L,D,ns,gab,tw)

# ---- gas lamps along both walks
for sd in (-1,1):
    for y in (-7.6,-4.9,-2.3,0.0,2.6,5.2):
        if on_bridge(sd*1.6,y): continue
        x=sd*1.55
        prism("iron",x,0+y,0.0,0.12,0.11,0.09,6); prism("iron",x,y,0.12,1.55,0.04,0.035,6)
        box("glow_lamps",x,y,1.55,1.8,0.1,0.1); frus("iron",x,y,1.8,1.9,0.14,0.14,0.03,0.03)

# ---- the falls at the head of the street: a rock bluff, its crown snowed and wooded, the water dropping into
# the river's pool
def rring(cx,cy,rx,ry,z,ph):
    return [(cx+rx*(1+0.12*math.sin(3*a+ph))*math.cos(a),cy+ry*(1+0.12*math.sin(3*a+ph))*math.sin(a),z) for a in [2*math.pi*k/12 for k in range(12)]]
solid([rring(0,8.75,5.2,1.25,-0.1,0.4),rring(0,8.85,4.6,1.1,1.9,0.9),rring(0,8.95,3.9,0.95,2.85,1.3)],"rock")
solid([rring(0,8.95,3.85,0.92,2.84,1.3),rring(0,8.95,3.4,0.8,3.05,1.3)],"snow")
box("snow",0,7.2,WZ,2.7,0.42,0.06)
ico("snow",0,7.0,WZ,0.7,0.35,0.18)
def fir(x,y,s,z=0.0):
    T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.12,-0.3,5),ngon(0.08,0.8,5)],"wood",T)
    for zc,r,hh in ((0.6,0.7,1.1),(1.3,0.45,1.0)):
        cone("fir",ngon(r,zc,6,rng.uniform(0,1)),(0,0,zc+hh),T)
        cone("snow",ngon(r*0.55,zc+hh*0.45,6,0.3),(0,0,zc+hh+0.06),T)
for x,s in ((-2.6,0.8),(-0.9,0.75),(1.0,0.8),(2.7,0.75)): fir(x,9.0+0.2*math.sin(x),s,3.0)
for x,y,s in [(-7.2,-8.6,0.9),(-7.6,-4.6,1.0),(-7.4,-0.4,0.9),(-7.2,3.6,1.0),(-6.6,7.6,0.9),(-8.8,9.0,0.9),
              (7.4,-8.4,0.9),(7.6,-4.2,1.0),(7.2,0.2,0.9),(7.4,4.0,1.0),(6.8,7.8,0.9),(8.8,9.2,0.9),(-3.6,-9.8,0.8),(3.8,-9.8,0.8),(3.7,-4.1,0.85),(3.6,1.05,0.8),(3.5,6.6,0.85)]:
    fir(x,y,s)

def ground_at(x,y):
    if on_bridge(x,y): return 0.14
    return G(x,y)
def terrain_at(x,y): return G(x,y)
def water_disc(x,y): return in_river(x,y,0.15) and not on_bridge(x,y)
INTERACT=(0.0,1.2)   # on the timber bridge mid-street, among the lit ryokan
STAND=(2.4,1.1)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/ginzan-onsen.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/ginzan-onsen.json"
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
    objname=key if key.startswith("glow_") else "ginzan_"+key
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
