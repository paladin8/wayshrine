# Sakurajima (the smoking volcano across a strip of Kagoshima Bay, its lava shore, the promenade we watch it from) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python sakurajima.py
# Rebuilds content/landmarks/sakurajima.blend and public/models/landmarks/sakurajima.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/sakurajima.glb"
BLEND=ROOT+"/content/landmarks/sakurajima.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"ash":"8a8178","scrub":"6f7d4f","green":"4f7a45","ground":"6b5a4c","lava":"3a3634","water":"3f7f99","plume":"9e9890","pave":"b9b2a2","wood":"7a5a3e","pine":"3a5e36","bark":"4e3a30","glow_cream":"e8dcb0"}
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
rng=random.Random(42)
EXTRA_SOLIDS=[]; NOSOLID={"plume","pine"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the volcano across its strip of bay
TERRAIN_SURFACE=False; EDGE_LEVEL=0.0       # the model draws its own landform: the volcano, the bay, the near shore
S2=math.sqrt(0.5)
def to_xy(u,v): return (S2*(u+v),S2*(v-u))     # u toward the camera, v screen-right
def to_uv(x,y): return (S2*(x-y),S2*(x+y))

# ---- the landform: Sakurajima's broad massif with its two summits (Kitadake, and Minamidake with the active crater),
# gullied slopes, the Taisho lava at its foot, a strip of Kagoshima Bay, and the near shore we look from
VC=(-3.8,0.2); K=(-5.2,-2.8); M=(-2.6,2.3)     # Kitadake higher, Minamidake lower: an unequal pair
def Hv(u,v):
    r=math.hypot(u-VC[0],v-VC[1]); th=math.atan2(v-VC[1],u-VC[0])
    h=2.9*max(0.0,1-r/8.4)**1.2
    h+=4.6*math.exp(-((u-K[0])**2+(v-K[1])**2)/(2*1.7**2))+3.1*math.exp(-((u-M[0])**2+(v-M[1])**2)/(2*1.6**2))
    h-=1.0*math.exp(-((u-M[0])**2+(v-M[1])**2)/(2*0.42**2))                    # Minamidake's crater
    h+=0.28*math.sin(9*th+1.3)*min(1.0,r/3.0)*max(0.0,1-r/8.4)                    # gullies
    return h*smooth(2.7,1.1,u)
def bay(u,v): return -0.85*smooth(2.0,2.9,u)*smooth(7.7,6.8,u)*smooth(10.2,8.4,abs(v))     # a wide reach of the bay
def H(x,y):
    u,v=to_uv(x,y)
    return (Hv(u,v)+bay(u,v))*smooth(FH,FH-1.2,max(abs(x),abs(y)))
STEP=0.7; NG=int(round(2*FH/STEP))+1
Z=[[H(-FH+STEP*i,-FH+STEP*j) for i in range(NG)] for j in range(NG)]
def facemat(x,y,h,slope):
    u,v=to_uv(x,y)
    if h< -0.15: return "lava"
    if 0.6<u<2.9 and h<1.1 and abs(v)<7.5: return "lava"             # the black lava fields along the island's shore
    if h>4.1: return "ash"
    if h>2.5 or (h>1.6 and slope>1.1): return "scrub"
    if h>0.18: return "green"
    return "ground"
vs=[(-FH+STEP*i,-FH+STEP*j,Z[j][i]) for j in range(NG) for i in range(NG)]
faces=[];fm=[]
for j in range(NG-1):
    for i in range(NG-1):
        a,b,c,d=j*NG+i,j*NG+i+1,(j+1)*NG+i+1,(j+1)*NG+i
        for tri in ([a,b,c],[a,c,d]):
            ps=[vs[k] for k in tri]; hs=[p[2] for p in ps]
            x,y=sum(p[0] for p in ps)/3,sum(p[1] for p in ps)/3
            hm=sum(hs)/3; hm+=rng.uniform(-0.3,0.3)*smooth(0.6,1.4,hm)
            m=facemat(x,y,hm,(max(hs)-min(hs))/STEP)
            faces.append(tri); fm.append(m)
emit(vs,faces,fm)
W_=FH-0.3
emit([(-W_,-W_,-0.28),(W_,-W_,-0.28),(W_,W_,-0.28),(-W_,W_,-0.28)],[[0,1,2,3]],["water"])   # shows only where the bay dips below it
def water_disc(x,y): return H(x,y)< -0.4
# the crater's glow and the ash plume leaning away on the wind
mx,my=to_xy(*M); mz=Hv(*M)
prism("glow_crater",mx,my,mz+0.05,mz+0.12,0.32,0.28,8)
for k,(r,dz,dv) in enumerate(((0.45,0.5,0.0),(0.65,1.1,0.3),(0.85,1.8,0.8),(1.0,2.45,1.5),(1.1,3.0,2.3),(1.15,3.4,3.2))):
    x,y=to_xy(M[0]-0.2*k,M[1]+dv); ico("plume",x,y,mz+dz,r,r*0.9,r*0.75)
# lava boulders and black rock along the shore
for k in range(26):
    u=rng.uniform(1.3,2.6); v=rng.uniform(-7.0,7.0); x,y=to_xy(u,v)
    ico("lava",x,y,H(x,y)+0.05,rng.uniform(0.25,0.55),rng.uniform(0.2,0.45),rng.uniform(0.18,0.35))

# ---- the near shore: a promenade along the water with a railing, a small lookout, pines; pines on the island's foot
for va,vb in ((-5.4,5.4),):
    q=[to_xy(8.1,va),to_xy(9.2,va),to_xy(9.2,vb),to_xy(8.1,vb)]
    emit([(*p,0.04) for p in q],[[0,1,2,3]],["pave"])
for k in range(15):
    v=-5.3+10.6*k/14; x,y=to_xy(8.0,v); box("wood",x,y,-0.05,0.85,0.05,0.05)
a=to_xy(8.0,-5.3); b=to_xy(8.0,5.3)
for z in (0.45,0.8): solid([[(a[0],a[1]-0.03,z),(a[0],a[1]+0.03,z),(a[0],a[1]+0.03,z+0.06),(a[0],a[1]-0.03,z+0.06)],[(b[0],b[1]-0.03,z),(b[0],b[1]+0.03,z),(b[0],b[1]+0.03,z+0.06),(b[0],b[1]-0.03,z+0.06)]],"wood")
def pine(x,y,s,z0=None):
    z0=H(x,y) if z0 is None else z0
    T2=dict(cx=x,cy=y,cz=z0,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.14,-0.4,5),ngon(0.1,1.7,5,0,0.3,0)],"bark",T2)
    for zc,r,dx in ((2.0,0.95,0.3),(1.5,0.7,-0.3),(2.45,0.55,0.5)): ico("pine",dx,0.1,zc,r,r*0.9,r*0.4,T2)
for u,v,s in [(9.6,-5.8,0.95),(9.8,5.6,0.9)]:     # only a pine at either end: the view across the bay stays open
    x,y=to_xy(u,v)
    if abs(x)<FH-1.3 and abs(y)<FH-1.3: pine(x,y,s)
for k in range(18):
    while True:
        u,v=rng.uniform(-1.0,1.6),rng.uniform(-6.5,6.5); x,y=to_xy(u,v)
        if 0.3<H(x,y)<1.8: break
    pine(x,y,rng.uniform(0.6,0.85))

def ground_at(x,y): return H(x,y)
INTERACT=to_xy(8.6,0.0)   # on the promenade, the volcano across the water
STAND=to_xy(9.4,0.8)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/sakurajima.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/sakurajima.json"
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
    objname=key if key.startswith("glow_") else "sakurajima_"+key
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
