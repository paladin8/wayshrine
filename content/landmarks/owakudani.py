# Owakudani (the steaming sulfur valley under Kanmuri-ga-take, its check dams, the ropeway's gondolas overhead, the plaza and the black-egg hut) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python owakudani.py
# Rebuilds content/landmarks/owakudani.blend and public/models/landmarks/owakudani.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/owakudani.glb"
BLEND=ROOT+"/content/landmarks/owakudani.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"terrain":"574441","sulfur":"d8d2b8","yellow":"e2d36a","ash":"9a948a","scrub":"7a6a4e","rock":"4a4442","concrete":"b5b0a6","steam":"eef0ee","steel":"5a5e62","red":"c8473a","pave":"b9b2a2","roofdark":"2e2e30","glow_cream":"e8dcb0"}
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
rng=random.Random(45)
EXTRA_SOLIDS=[]; NOSOLID={"steam"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the steaming valley climbing away from its plaza
TERRAIN_SURFACE=False; EDGE_LEVEL=0.0       # the model draws its own landform
def water_disc(x,y): return False
S2=math.sqrt(0.5)
def to_xy(u,v): return (S2*(u+v),S2*(v-u))     # u toward the camera, v screen-right
def to_uv(x,y): return (S2*(x-y),S2*(x+y))

def tube(mat,pts,rs,n=6):
    rings=[]
    for k,p in enumerate(pts):
        a=pts[max(k-1,0)]; b=pts[min(k+1,len(pts)-1)]
        d=Vector(b)-Vector(a); d.normalize()
        uu=d.cross(Vector((0,0,1))) if abs(d.z)<0.95 else d.cross(Vector((1,0,0)))
        uu.normalize(); w=d.cross(uu)
        rings.append([tuple(Vector(p)+rs[k]*(math.cos(2*math.pi*i/n)*uu+math.sin(2*math.pi*i/n)*w)) for i in range(n)])
    solid(rings,mat)

# ---- the landform: the flank of Kamiyama rising away from the camera, a pale sulfurous gully steaming down its
# middle, scrubby slopes either side, the dark crag of Kanmuri-ga-take at the top; a flat plaza at the bottom
def vg(u): return 0.6*math.sin(0.35*u+0.8)
KR=(-7.4,-3.2)
def Hr(u,v):
    h=4.2*smooth(4.2,-7.5,u)
    h-=1.1*math.exp(-(v-vg(u))**2/(2*1.8**2))*smooth(3.6,-1.5,u)
    h+=2.0*math.exp(-((u-KR[0])**2+(v-KR[1])**2)/(2*1.5**2))
    h+=0.18*math.sin(1.7*v+0.6*u)*smooth(3.0,-2.0,u)
    return max(0.0,h)
def H(x,y):
    u,v=to_uv(x,y); return Hr(u,v)*smooth(FH,FH-1.6,max(abs(x),abs(y)))
STEP=0.62; NG=int(round(2*FH/STEP))+1
vs=[(-FH+STEP*i,-FH+STEP*j,H(-FH+STEP*i,-FH+STEP*j)) for j in range(NG) for i in range(NG)]
VENTS=[(rng.uniform(-6.5,2.2),0.0) for _ in range(9)]
VENTS=[(u,vg(u)+rng.uniform(-1.5,1.5)) for u,_ in VENTS]
def facemat(x,y,h):
    u,v=to_uv(x,y)
    if math.hypot(u-KR[0],v-KR[1])<1.6 and h>4.6: return "rock"
    if u<3.4 and abs(v-vg(u))<1.9+0.35*math.sin(1.3*u+0.4):
        if any(math.hypot(u-a,v-b)<0.55 for a,b in VENTS): return "yellow"
        return "sulfur"
    if u<3.6 and abs(v-vg(u))<3.1+0.4*math.sin(0.9*u) and h>0.3: return "ash"
    if h>0.25: return "scrub"
    return "terrain"                                                 # the foot of the slope: the region's own ground
faces=[];fm=[]
for j in range(NG-1):
    for i in range(NG-1):
        a,b,c,d=j*NG+i,j*NG+i+1,(j+1)*NG+i+1,(j+1)*NG+i
        for tri in ([a,b,c],[a,c,d]):
            ps=[vs[k] for k in tri]
            faces.append(tri); fm.append(facemat(sum(p[0] for p in ps)/3,sum(p[1] for p in ps)/3,sum(p[2] for p in ps)/3))
emit(vs,faces,fm)
def P(u,v,dz=0.0): x,y=to_xy(u,v); return (x,y,H(x,y)+dz)

# ---- fumaroles breathing steam up the gully, and the stepped check dams that hold it
for k,(u,v) in enumerate(VENTS):
    x,y,z=P(u,v); dr=rng.uniform(0.3,0.6)
    for j,(r,dz) in enumerate(((0.4,0.35),(0.6,0.9),(0.72,1.5))):
        if k%2 and j==2: break
        ico("steam",x-dr*j*0.35,y+dr*j*0.35,z+dz,r,r*0.95,r*0.75)
for u in (-0.6,-2.6,-4.6):
    for st in range(2):
        uu=u+0.45*st; v0=vg(uu)
        a=P(uu,v0-1.5); b=P(uu,v0+1.5); zc=min(a[2],b[2],P(uu,v0)[2])
        x,y=to_xy(uu,v0)
        T=dict(cx=x,cy=y,rot=math.pi/4)
        box("concrete",0,0,P(uu,v0)[2]-0.5,P(uu,v0)[2]+0.38-0.12*st,1.5,0.16,T)

# ---- the ropeway: two lattice pylons, the cables across the valley, gondolas hanging from them
ZC=8.6
PYL=[(-2.4,-7.4),(-2.6,7.0)]
for u,v in PYL:
    x,y,z=P(u,v)
    for sx in (-1,1):
        for sy in (-1,1):
            tube("steel",[(x+sx*0.45,y+sy*0.45,z-0.2),(x+sx*0.12,y+sy*0.12,ZC-0.2)],[0.05,0.04],4)
    for zz in [z+(ZC-z)*t for t in (0.25,0.5,0.75)]:
        w=0.45-(0.33)*(zz-z)/(ZC-z); box("steel",x,y,zz-0.03,zz+0.03,w,w)
    T=dict(cx=x,cy=y,rot=math.pi/4); box("steel",0,0,ZC-0.2,ZC,0.15,0.9,T)
for side in (-0.75,0.75):
    a=P(PYL[0][0],PYL[0][1]); b=P(PYL[1][0],PYL[1][1])
    pa=to_xy(PYL[0][0]+side,PYL[0][1]); pb=to_xy(PYL[1][0]+side,PYL[1][1])
    pts=[];rs=[]
    for k in range(9):
        t=k/8; pts.append((pa[0]+(pb[0]-pa[0])*t,pa[1]+(pb[1]-pa[1])*t,ZC-0.6*math.sin(math.pi*t))); rs.append(0.025)
    tube("steel",pts,rs,4)
for t,side in ((0.3,-0.75),(0.68,0.75)):
    pa=to_xy(PYL[0][0]+side,PYL[0][1]); pb=to_xy(PYL[1][0]+side,PYL[1][1])
    x,y=pa[0]+(pb[0]-pa[0])*t,pa[1]+(pb[1]-pa[1])*t; z=ZC-0.6*math.sin(math.pi*t)
    box("steel",x,y,z-0.6,z,0.02,0.02)
    T=dict(cx=x,cy=y,rot=math.pi/4)
    box("red",0,0,z-1.25,z-0.6,0.42,0.32,T); box("roofdark",0,-0.33,z-1.05,z-0.75,0.36,0.01,T); box("roofdark",0,0,z-0.6,z-0.55,0.44,0.34,T)

# ---- the plaza at the foot: the ropeway station, a railed lookout up the valley, the hut where the black eggs cook
for va,vb in ((-6.0,6.0),):
    q=[to_xy(4.3,va),to_xy(8.4,va),to_xy(8.4,vb),to_xy(4.3,vb)]
    emit([(*p,0.04) for p in q],[[0,1,2,3]],["concrete"])
for k in range(13):
    v=-5.8+11.6*k/12; x,y,z=P(4.35,v); box("steel",x,y,0.0,0.85,0.04,0.04)
a=to_xy(4.35,-5.8); b=to_xy(4.35,5.8)
solid([[(a[0],a[1],0.8),(a[0]+0.03,a[1]+0.03,0.8),(a[0]+0.03,a[1]+0.03,0.86),(a[0],a[1],0.86)],[(b[0],b[1],0.8),(b[0]+0.03,b[1]+0.03,0.8),(b[0]+0.03,b[1]+0.03,0.86),(b[0],b[1],0.86)]],"steel")
sx_,sy_=to_xy(6.6,-3.8); T=dict(cx=sx_,cy=sy_,rot=math.pi/4)
box("concrete",0,0,-0.05,1.6,2.1,1.3,T); box("glow_station",0,-1.31,0.3,1.3,1.8,0.01,T)
box("concrete",0,0,1.6,2.9,1.6,1.0,T); box("glow_upper",0,-1.01,1.9,2.6,1.3,0.01,T)
solid([[(-2.6,-1.8,2.9),(2.6,-1.8,2.9),(2.6,1.6,3.4),(-2.6,1.6,3.4)],[(-2.6,-1.8,3.05),(2.6,-1.8,3.05),(2.6,1.6,3.55),(-2.6,1.6,3.55)]],"roofdark",T)
ex,ey=to_xy(6.0,4.0); T=dict(cx=ex,cy=ey,rot=math.pi/4)
for sx in (-1,1):
    for sy in (-1,1): box("roofdark",sx*0.7,sy*0.5,-0.05,1.4,0.05,0.05,T)
extrude_x("roofdark",[(-0.8,1.35),(0,1.75),(0.8,1.35),(0.7,1.3),(0,1.62),(-0.7,1.3)],-0.95,0.95,T)
box("concrete",0,0,-0.05,0.55,0.55,0.35,T)
for k in range(7): ico("roofdark",-0.3+0.1*k,rng.uniform(-0.15,0.15),0.62,0.07,0.07,0.09,T)
for j,(r,dz) in enumerate(((0.3,0.9),(0.45,1.5),(0.55,2.1))): ico("steam",ex,ey,dz,r,r,r*0.8)

# dead trees standing on the scorched slopes
for k in range(12):
    while True:
        u,v=rng.uniform(-6.5,3.0),rng.uniform(-8.0,8.0)
        if abs(v-vg(u))>2.6 and abs(u)+abs(v)<13: break
    x,y,z=P(u,v); hgt=rng.uniform(1.0,1.6); a=rng.uniform(0,6.28)
    tube("rock",[(x,y,z-0.2),(x+0.1,y,z+hgt)],[0.07,0.04],5)
    tube("rock",[(x+0.05,y,z+hgt*0.6),(x+0.45*math.cos(a),y+0.45*math.sin(a),z+hgt*0.95)],[0.03,0.02],4)
def ground_at(x,y): return H(x,y)
INTERACT=to_xy(4.9,0.0)   # at the lookout rail, looking up the steaming valley
STAND=to_xy(6.0,0.7)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/owakudani.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/owakudani.json"
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
    objname=key if key.startswith("glow_") else "owakudani_"+key
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
