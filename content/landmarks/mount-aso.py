# Mount Aso (Nakadake's crater, a bowl of banded rock round a steaming turquoise lake, with Kometsuka and the meadow of Kusasenri before it) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python mount-aso.py
# Rebuilds content/landmarks/mount-aso.blend and public/models/landmarks/mount-aso.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/mount-aso.glb"
BLEND=ROOT+"/content/landmarks/mount-aso.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"ash":"8a8178","strata1":"7a6a5c","strata2":"5a4e46","grass":"7d9a4f","lake":"6fc7bf","water":"5f8fa0","steam":"e2e4e2","concrete":"b5b0a6","pave":"a8a294","horse":"6b4a32"}
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
rng=random.Random(43)
EXTRA_SOLIDS=[]; NOSOLID={"steam"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, Nakadake's crater with Kusasenri's meadow before it
TERRAIN_SURFACE=False; EDGE_LEVEL=0.0       # the model draws its own landform
S2=math.sqrt(0.5)
def to_xy(u,v): return (S2*(u+v),S2*(v-u))     # u toward the camera, v screen-right
def to_uv(x,y): return (S2*(x-y),S2*(x+y))

# ---- the landform: the ash cone of Nakadake, its crater a steep bowl of banded rock with a turquoise lake steaming
# at the bottom, its near rim lower so the camera looks in; Kometsuka's green cinder cone; Kusasenri's meadow and pond
C=(-2.8,0.9); RIM=3.0; FL=0.35
# The crater is an irregular bowl drawn out along the line of the vents (screen-right), not a round pit: positions
# around it are measured in a stretched, wobbled radius rho
RY=1.45
def wob(a): return 1+0.11*math.sin(3*a+0.7)+0.07*math.sin(5*a+2.0)
def polar(u,v):
    a=math.atan2((v-C[1])/RY,u-C[0]); return math.hypot(u-C[0],(v-C[1])/RY)/wob(a),a
def CP(rho,a): w=wob(a); return (C[0]+rho*w*math.cos(a),C[1]+RY*rho*w*math.sin(a))
def rimh_a(a): return 3.7-1.0*math.cos(a)+0.45*math.sin(2*a+0.4)        # the near rim lower; uneven all round
def rimh(u,v): return rimh_a(polar(u,v)[1])
def crater(u,v):
    r,a=polar(u,v); hr=rimh_a(a)
    if r<RIM:
        p=1.1+1.3*(0.5+0.5*math.cos(a-2.6))                 # the far wall falls sheer, the near one shelves
        t=max(0.0,(r-1.3)/(RIM-1.3)); return FL+(hr-FL)*t**p
    return hr*max(0.0,1-(r-RIM)/5.0)**1.1
KM=(3.4,-6.0)
def kome(u,v):
    d=math.hypot(u-KM[0],v-KM[1]); return 1.7*max(0.0,1-d/2.0)**0.95-0.3*math.exp(-d*d/0.25)
PO=(5.2,1.6)
def pond(u,v): return -0.45*smooth(1.9,1.1,math.hypot((u-PO[0])*1.2,v-PO[1]))
def H(x,y):
    u,v=to_uv(x,y)
    return (max(crater(u,v),kome(u,v))+pond(u,v))*smooth(FH,FH-1.3,max(abs(x),abs(y)))
STEP=0.62; NG=int(round(2*FH/STEP))+1
vs=[(-FH+STEP*i,-FH+STEP*j,H(-FH+STEP*i,-FH+STEP*j)) for j in range(NG) for i in range(NG)]
def facemat(x,y,h):
    u,v=to_uv(x,y); r=polar(u,v)[0]
    if r<RIM-0.05 and h<rimh(u,v)-0.08:
        return "strata1" if int((h+0.1)/0.32)%2 else "strata2"
    if r<RIM+2.4 and h>0.3: return "ash"            # the ash stays on the cone; grass runs up its lower slopes
    if math.hypot(u-KM[0],v-KM[1])<2.0:
        a=math.atan2(v-KM[1],u-KM[0]); return "strata2" if (int((a+math.pi)/(2*math.pi)*18)%3==0 and h>0.25) else "grass"
    if h< -0.1: return "grass"
    return "grass"
faces=[];fm=[]
for j in range(NG-1):
    for i in range(NG-1):
        a,b,c,d=j*NG+i,j*NG+i+1,(j+1)*NG+i+1,(j+1)*NG+i
        for tri in ([a,b,c],[a,c,d]):
            ps=[vs[k] for k in tri]
            x,y,h=(sum(p[0] for p in ps)/3,sum(p[1] for p in ps)/3,sum(p[2] for p in ps)/3)
            u,v=to_uv(x,y)
            if polar(u,v)[0]<RIM+0.15: continue                       # the crater's inside is lofted below, in bands
            h+=rng.uniform(-0.18,0.18)*smooth(0.3,0.9,h)
            faces.append(tri); fm.append(facemat(x,y,h))
emit(vs,faces,fm)
NA=28; LV=[1.3,1.62,1.92,2.2,2.45,2.66,2.84,RIM,RIM+0.45]
rings=[]
for r in LV:
    ring=[]
    for k in range(NA):
        a=2*math.pi*k/NA; rr=r+(rng.uniform(-0.07,0.07) if 0<len(rings)<len(LV)-1 else 0.0); u,v=CP(rr,a); x,y=to_xy(u,v)
        ring.append((x,y,crater(u,v)*smooth(FH,FH-1.3,max(abs(x),abs(y)))))
    rings.append(ring)
for li in range(len(rings)-1):
    fs=[];ms=[]
    for k in range(NA):
        k2=(k+1)%NA; fs.append([k,k2,NA+k2,NA+k])
    band=[("strata1" if (li+(k*7)//NA+(1 if math.sin(1.7*k+li)>0.6 else 0))%2 else "strata2") for k in range(NA)]   # broken, uneven bands
    emit(rings[li]+rings[li+1],fs,band if li<len(rings)-2 else ["ash"]*NA)
cxy=to_xy(*C)
emit(rings[0]+[(cxy[0],cxy[1],FL)],[[k,NA,(k+1)%NA] for k in range(NA)],["strata2"]*NA)
cx,cy=to_xy(*C)
LR=[to_xy(*CP(1.3,2*math.pi*k/16)) for k in range(16)]
solid([[(x,y,FL-0.2) for x,y in LR],[(x,y,FL+0.3) for x,y in LR]],"lake")
for k,(r,dz,dv,du) in enumerate(((0.55,0.75,0.0,-0.3),(0.8,1.35,0.25,-0.85),(1.0,2.0,0.6,-1.5),(1.15,2.65,1.05,-2.2),(1.2,3.25,1.6,-2.9))):
    x,y=to_xy(C[0]+du,C[1]+dv); ico("steam",x,y,FL+dz,r,r*0.95,r*0.8)
px,py=to_xy(*PO)
emit([(px+1.75*math.cos(2*math.pi*k/16)/1.2*S2+1.75*math.sin(2*math.pi*k/16)*S2, py-1.75*math.cos(2*math.pi*k/16)/1.2*S2+1.75*math.sin(2*math.pi*k/16)*S2,-0.18) for k in range(16)]+[(px,py,-0.18)],
     [[k,(k+1)%16,16] for k in range(16)],["water"]*16)
def water_disc(x,y):
    u,v=to_uv(x,y)
    return polar(u,v)[0]<1.25 or math.hypot((u-PO[0])*1.2,v-PO[1])<1.5

# ---- on the near rim: the viewing walk with its railing, two concrete shelters; a path up from the meadow
def P(u,v,dz=0.03): x,y=to_xy(u,v); return (x,y,H(x,y)+dz)
for k in range(13):
    a=-0.9+1.8*k/12; u,v=CP(RIM+0.35,a)
    x,y,z=P(u,v,0); box("concrete",x,y,z-0.1,z+0.7,0.05,0.05)
for k in range(12):
    a0=-0.9+1.8*k/12; a1=-0.9+1.8*(k+1)/12
    p0=P(*CP(RIM+0.35,a0),0.62); p1=P(*CP(RIM+0.35,a1),0.62)
    solid([[(p0[0],p0[1],p0[2]),(p0[0]+0.03,p0[1]+0.03,p0[2]),(p0[0]+0.03,p0[1]+0.03,p0[2]+0.06),(p0[0],p0[1],p0[2]+0.06)],[(p1[0],p1[1],p1[2]),(p1[0]+0.03,p1[1]+0.03,p1[2]),(p1[0]+0.03,p1[1]+0.03,p1[2]+0.06),(p1[0],p1[1],p1[2]+0.06)]],"concrete")
for a in (-1.15,1.2):
    x,y,z=P(*CP(RIM+1.5,a),0)
    T=dict(cx=x,cy=y,cz=z,rot=math.pi/4+a)
    box("concrete",0,0,-0.4,0.75,0.7,0.5,T); extrude_x("concrete",[(-0.55,0.75),(0,1.05),(0.55,0.75)],-0.75,0.75,T)
    box("strata2",0.0,-0.51,0.0,0.55,0.35,0.01,T)
pts=[(9.6,1.0),(7.6,-0.6),(5.6,-1.4),(3.0,-0.6),(1.4,0.4),CP(RIM+0.35,-0.07)]
for (ua,va),(ub,vb) in zip(pts,pts[1:]):
    n=max(2,int(math.hypot(ub-ua,vb-va)/0.6))
    for k in range(n):
        t0,t1=k/n,(k+1)/n
        u0,v0=ua+(ub-ua)*t0,va+(vb-va)*t0; u1,v1=ua+(ub-ua)*t1,va+(vb-va)*t1
        dl=math.hypot(u1-u0,v1-v0); nu,nv=-(v1-v0)/dl*0.42,(u1-u0)/dl*0.42
        emit([P(u0+nu,v0+nv),P(u0-nu,v0-nv),P(u1-nu,v1-nv),P(u1+nu,v1+nv)],[[0,1,2,3]],["pave"])

# ---- horses grazing on Kusasenri
def horse(u,v,ang):
    x,y,z=P(u,v,0); T=dict(cx=x,cy=y,cz=z,rot=ang)
    box("horse",0,0,0.42,0.72,0.42,0.14,T)
    for sx in (-1,1):
        for sy in (-1,1): box("horse",sx*0.3,sy*0.08,0.0,0.45,0.04,0.04,T)
    solid([[(0.35,-0.07,0.6),(0.35,0.07,0.6),(0.35,0.07,0.75),(0.35,-0.07,0.75)],[(0.62,-0.06,0.4),(0.62,0.06,0.4),(0.62,0.06,0.55),(0.62,-0.06,0.55)]],"horse",T)
    box("strata2",-0.44,0,0.35,0.62,0.03,0.03,T)
for u,v,a in [(6.6,-2.6,0.4),(7.4,3.8,2.2),(4.0,4.4,-0.8),(8.4,-0.2,1.4)]:
    horse(u,v,a)

def ground_at(x,y): return H(x,y)
INTERACT=to_xy(*CP(RIM+0.9,0.0))   # on the near rim, looking down into the crater
STAND=to_xy(*CP(RIM+1.9,0.12))

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/mount-aso.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/mount-aso.json"
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
    objname=key if key.startswith("glow_") else "aso_"+key
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
