# Iya vine bridge (the woven kazurabashi sagging over a rocky river in a steep wooded valley) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python iya-kazurabashi.py
# Rebuilds content/landmarks/iya-kazurabashi.blend and public/models/landmarks/iya-kazurabashi.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/iya-kazurabashi.glb"
BLEND=ROOT+"/content/landmarks/iya-kazurabashi.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"vine":"6e563e","vinedk":"4e3d2c","wood":"9a7a56","water":"3f9a94","stone":"cfcac0","leaf":"4a7a42","leafdk":"355f36","maple":"c2603a","fern":"86b45e","bark":"4e3a30"}
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
rng=random.Random(39)
EXTRA_SOLIDS=[]; NOSOLID={"leaf","leafdk","maple","fern"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the valley with its river and the vine bridge
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0
S2=math.sqrt(0.5)
def to_xy(u,v): return (S2*(u+v),S2*(v-u))     # u toward the camera, v screen-right
def to_uv(x,y): return (S2*(x-y),S2*(x+y))

def tube(mat,pts,rs,n=6):
    rings=[]
    for k,p in enumerate(pts):
        a=pts[max(k-1,0)]; b=pts[min(k+1,len(pts)-1)]
        d=Vector(b)-Vector(a); d.normalize()
        u=d.cross(Vector((0,0,1))) if abs(d.z)<0.95 else d.cross(Vector((1,0,0)))
        u.normalize(); w=d.cross(u)
        rings.append([tuple(Vector(p)+rs[k]*(math.cos(2*math.pi*i/n)*u+math.sin(2*math.pi*i/n)*w)) for i in range(n)])
    solid(rings,mat)

# ---- the valley: steep forested sides falling to a rocky river that runs toward the camera; it closes up at
# either end so the river stays inside the footprint
DEPTH=2.8
def vr(u): return 0.35*math.sin(0.4*u+0.6)
def G(u,v):
    dep=DEPTH*smooth(10.6,6.4,abs(u))
    return -dep*(1.0-smooth(1.7,5.6,abs(v-vr(u))))
WZ=-2.5
def in_river(u,v,m=0.0): return abs(v-vr(u))<1.05-m and abs(u)<6.3-m
us=[-6.6+13.2*k/16 for k in range(17)]
for ua,ub in zip(us,us[1:]):
    q=[to_xy(ua,vr(ua)-1.25),to_xy(ua,vr(ua)+1.25),to_xy(ub,vr(ub)+1.25),to_xy(ub,vr(ub)-1.25)]
    emit([(*p,WZ) for p in q],[[0,1,2,3]],["water"])
def boulder(u,v,r,mat="stone"):
    x,y=to_xy(u,v); z=G(u,v)
    ico(mat,x,y,z+0.15*r,r,0.85*r,0.6*r)
for k in range(40):
    u=rng.uniform(-6.6,6.6); sd=rng.choice((-1,1)); v=vr(u)+sd*rng.uniform(0.9,2.2)
    boulder(u,v,rng.uniform(0.5,0.95))
for sd in (-1,1):                                           # boulder fields where the river slips away at each end
    for k in range(9):
        boulder(sd*rng.uniform(6.2,7.6),vr(sd*6.8)+rng.uniform(-1.8,1.8),rng.uniform(0.5,0.9))
for k in range(9):
    u=rng.uniform(-5.5,5.5); boulder(u,vr(u)+rng.uniform(-0.6,0.6),rng.uniform(0.45,0.7))

# ---- the vine bridge: planks laid with gaps on two log stringers, walled with woven vines from the deck to the
# rope rails, sagging across the gorge, its ends lashed to posts with great bundles of vine
BL=5.3; BW=0.6; BZ0=0.3; SAG=1.5
def dz(v): return BZ0-SAG*(1-(v/BL)**2)
def P(u,v,z): x,y=to_xy(u,v); return (x,y,z)
N=28
vs=[-BL+2*BL*k/N for k in range(N+1)]
for sd in (-1,1):
    tube("vine",[P(sd*(BW-0.1),v,dz(v)-0.1) for v in vs],[0.07]*len(vs),5)          # stringers
    tube("vine",[P(sd*BW,v,dz(v)+0.95) for v in vs],[0.075]*len(vs),5)               # rope rails
    tube("vine",[P(sd*BW,v,dz(v)+0.5) for v in vs[1:-1]],[0.045]*(len(vs)-2),4)
    for k in range(0,N,2):                                                             # the woven web
        va,vb=vs[k],vs[k+2]
        tube("vinedk",[P(sd*(BW-0.05),va,dz(va)-0.05),P(sd*BW,vb,dz(vb)+0.95)],[0.03,0.03],4)
        tube("vinedk",[P(sd*(BW-0.05),vb,dz(vb)-0.05),P(sd*BW,va,dz(va)+0.95)],[0.03,0.03],4)
for k in range(1,N):
    v=vs[k]
    for j in (-0.12,0.12):
        vv=v+j; a=P(-BW+0.02,vv,dz(vv)); b=P(BW-0.02,vv,dz(vv))
        tube("wood",[a,b],[0.04,0.04],4)
for sv in (-1,1):                                            # anchors on each rim
    v0=sv*(BL+0.15)
    for su in (-1,1):
        x,y=to_xy(su*0.85,v0); prism("wood",x,y,-0.3,1.6,0.13,0.11,7)
        for z in (0.35,0.65,1.0,1.3): prism("vine",x,y,z,z+0.14,0.2,0.2,7)
        tube("vine",[P(su*0.85,v0,1.25),P(su*BW,sv*(BL-0.3),dz(sv*(BL-0.3))+0.95)],[0.08,0.075],5)
        tube("vine",[P(su*0.85,v0,0.4),P(su*1.3,v0+sv*1.6,0.1),P(su*1.6,v0+sv*2.6,0.0)],[0.12,0.1,0.09],5)
    x,y=to_xy(0,v0+sv*0.35); box("wood",x,y,-0.05,0.08,0.7,0.7)

# ---- forest on the valley sides: green and turning maples, ferns, and the far slopes thickly wooded
def tree(u,v,s,m):
    x,y=to_xy(u,v); z=G(u,v)
    T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.15,-0.4,5),ngon(0.1,1.8,5,0,0.12,0)],"bark",T)
    ico(m,0,0,2.4,1.25,1.15,0.95,T); ico(m,0.6,0.35,1.95,0.8,0.75,0.6,T)
def fern(u,v,s):
    x,y=to_xy(u,v); z=G(u,v)
    T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    for k in range(5):
        a=2*math.pi*k/5
        cone("fern",[(0.05*math.cos(a+1.6),0.05*math.sin(a+1.6),0.05),(-0.05*math.cos(a+1.6),-0.05*math.sin(a+1.6),0.05),(0.45*math.cos(a)-0.08*math.sin(a),0.45*math.sin(a)+0.08*math.cos(a),0.38)],(0.85*math.cos(a),0.85*math.sin(a),0.15),T)
pts=[]
for _ in range(5000):
    u,v=rng.uniform(-13,13),rng.uniform(-13,13); x,y=to_xy(u,v)
    if abs(x)>FH-1.3 or abs(y)>FH-1.3: continue
    if abs(v-vr(u))<2.3: continue
    if abs(u)<1.6 and abs(v)<BL+3.2: continue
    if u>1.5 and abs(v)<8.0: continue                    # keep the camera's side open
    if any((x-px)**2+(y-py)**2<1.8**2 for px,py in pts): continue
    pts.append((x,y))
    if len(pts)>=30: break
for k,(x,y) in enumerate(pts):
    u,v=to_uv(x,y); tree(u,v,rng.uniform(0.85,1.15),"maple" if k%4==0 else ("leafdk" if k%3==0 else "leaf"))
for _ in range(22):
    while True:
        u,v=rng.uniform(-11,11),rng.uniform(-11,11); x,y=to_xy(u,v)
        if abs(x)<FH-0.8 and abs(y)<FH-0.8 and abs(v-vr(u))>1.6 and not (abs(u)<1.4 and abs(v)<BL+1): break
    fern(u,v,rng.uniform(0.7,1.0))

def water_disc(x,y): u,v=to_uv(x,y); return in_river(u,v,0.1)
def ground_at(x,y):
    u,v=to_uv(x,y)
    if abs(u)<=BW-0.05 and abs(v)<=BL: return max(dz(v),G(u,v))
    return G(u,v)
INTERACT=to_xy(0.0,-(BL+1.0))   # the left-hand rim at the bridge's foot
STAND=to_xy(1.2,-(BL+1.6))
def terrain_at(x,y): u,v=to_uv(x,y); return G(u,v)   # the valley runs on under the bridge

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/iya-kazurabashi.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/iya-kazurabashi.json"
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
    objname=key if key.startswith("glow_") else "iya_"+key
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
