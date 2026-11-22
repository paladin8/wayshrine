# Shirakawa-go in winter (gassho-zukuri farmhouses among snowy paddies, lit for the evening illumination) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python shirakawa-go.py
# Rebuilds content/landmarks/shirakawa-go.blend and public/models/landmarks/shirakawa-go.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/shirakawa-go.glb"
BLEND=ROOT+"/content/landmarks/shirakawa-go.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"snow":"f1f4f6","thatch":"6f5a43","darkwood":"4a3426","bark":"4e3a30","cedar":"3f6b47","stone":"a39e98","cream":"e8dcb0","wood":"9a7650","glow_cream":"e8dcb0"}
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

def flared_roof(spec,mat="tile",ox=0.0,oy=0.0):
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
rng=random.Random(9)
H=lambda x,y: 0.0   # flat grounds; the game's terrain draws the snow (terrainSurface)
EXTRA_SOLIDS=[]

# ---- gassho-zukuri farmhouses: steep thatched A-frames (about 52 degrees) carrying snow, the ridge running
# front to back so the dark timbered gable with its tiers of paper windows faces the approach
GLOW=[0]
def gassho(cx,cy,W,L,storeys=3,shed=False):
    T=dict(cx=cx,cy=cy)
    E=0.5                                        # eave height
    HR=E+1.3*(W+0.25)                            # ridge height for a 52 degree pitch
    box("darkwood",0,0,0.0,E+0.45,W*0.78,L*0.96,T)                      # ground storey walls
    box("stone",0,0,-0.05,0.12,W*0.84,L*1.0,T)
    extrude_y("darkwood",[(-W*0.78,E+0.4),(W*0.78,E+0.4),(0,HR-0.3)],-L*0.96,L*0.96,T)   # gable walls
    # thatch: two thick slabs meeting at the ridge, overhanging the gables
    extrude_y("thatch",[(-W-0.28,E),(0,HR+0.32),(W+0.28,E),(W-0.1,E),(0,HR-0.12),(-W+0.1,E)],-L-0.38,L+0.38,T)
    # snow on the slopes, short of the eaves and the gable edges so the thatch shows as a brown rim
    k=0.1/(W+0.28)
    def lift(x): return E+(HR+0.32-E)*(1-abs(x)/(W+0.28))
    sx0=W+0.1
    extrude_y("snow",[(-sx0,lift(-sx0)+0.03),(0,HR+0.46),(sx0,lift(sx0)+0.03),(sx0-0.04,lift(sx0)-0.02),(0,HR+0.32),(-sx0+0.04,lift(-sx0)-0.02)],-L-0.26,L+0.26,T)
    box("thatch",0,0,HR+0.3,HR+0.48,0.16,L+0.3,T)                         # ridge cap
    box("snow",0,0,HR+0.48,HR+0.56,0.2,L+0.24,T)
    # the front gable: timber beams and tiers of paper windows (lit, as for the evening illumination)
    g=GLOW[0]=GLOW[0]+1
    yf=-L*0.96
    zs=[E+0.6+i*0.48 for i in range(storeys)]
    for i,z in enumerate(zs):
        half=W*0.78*(1-(z-(E+0.4))/(HR-0.3-(E+0.4)))
        if half<0.25: break
        box("darkwood",0,yf-0.03,z-0.12,z-0.06,half,0.03,T)
        n=max(1,int(half/0.32))
        for j in range(n):
            x=-half+0.2+(2*half-0.4)*(j+0.5)/n
            box("glow_window_%d"%g,x,yf-0.04,z,z+0.3,min(0.13,(2*half-0.4)/n*0.38),0.02,T)
    for x in (-W*0.4,W*0.4):                                               # ground-floor windows on the right side
        box("cream",W*0.78+0.02,x*L/W*0.9,0.45,0.8,0.02,0.2,T)
    if shed:                                                               # a lean-to on the right side
        box("darkwood",W*0.78+0.45,L*0.3,0.0,0.8,0.45,L*0.45,T)
        extrude_y("thatch",[(W*0.7,1.15),(W*0.78+1.05,0.72),(W*0.78+1.05,0.84),(W*0.7,1.27)],L*0.3-L*0.5,L*0.3+L*0.5,T)
        extrude_y("snow",[(W*0.72,1.28),(W*0.78+0.98,0.86),(W*0.78+0.98,0.9),(W*0.72,1.33)],L*0.3-L*0.45,L*0.3+L*0.45,T)
    return HR
HOUSES=[(-4.2,2.0,1.45,2.3,4,True),(1.8,5.2,1.2,1.9,3,False),(5.6,-0.8,1.1,1.75,3,True),(-0.4,-3.2,1.05,1.65,3,False),(-7.2,-4.6,0.95,1.5,2,False),
        (6.8,6.2,1.0,1.6,3,False),(-8.0,6.2,1.0,1.6,2,True),(-4.2,-8.4,0.95,1.5,2,False)]
for h in HOUSES: gassho(*h)
gassho(8.7,2.9,0.7,0.95,1)                                                 # a small gassho storehouse

# ---- the village path, cleared of snow, with snow lanterns lit along it
PATH=[(9.0,-10.0),(6.4,-6.6),(2.6,-5.4),(2.0,-1.4),(-1.2,0.4),(-1.4,3.6),(-3.0,8.0),(-3.4,10.0)]
for p,q in zip(PATH,PATH[1:]):
    mx,my=(p[0]+q[0])/2,(p[1]+q[1])/2; h=math.atan2(q[1]-p[1],q[0]-p[0]); L=math.hypot(q[0]-p[0],q[1]-p[1])
    box("stone",0,0,-0.02,0.02,L/2+0.4,0.45,dict(cx=mx,cy=my,rot=h))
    for sy in (-1,1):                                                      # snow banks along the path
        box("snow",0,0,-0.02,0.14,max(0.2,L/2-0.45),0.12,dict(cx=mx-math.sin(h)*sy*0.62,cy=my+math.cos(h)*sy*0.62,rot=h))   # short of the bends
def snow_lantern(cx,cy,idx):
    box("snow",cx,cy,0.0,0.42,0.26,0.26)
    box("glow_lantern_%d"%idx,cx,cy,0.42,0.68,0.17,0.17)
    solid([rect(0.32,0.32,0.68),rect(0.32,0.32,0.75),rect(0.08,0.08,0.95)],"snow",dict(cx=cx,cy=cy))
for i,(x,y) in enumerate([(9.0,-8.4),(5.0,-5.4),(3.1,-3.2),(0.6,-0.1),(-0.5,2.4),(-1.8,6.2),(-2.3,9.2)],1): snow_lantern(x,y,i)

# ---- snowy paddies: low snow ridges between the fields, and wooden racks for drying rice
def ridge(x0,y0,x1,y1):
    mx,my=(x0+x1)/2,(y0+y1)/2; L=math.hypot(x1-x0,y1-y0)/2; h=math.atan2(y1-y0,x1-x0)
    box("snow",0,0,-0.02,0.1,L,0.1,dict(cx=mx,cy=my,rot=h))
for (x0,y0,x1,y1) in [(-10.2,-1.6,-5.6,-1.6),(-10.2,2.6,-6.6,2.6),(-2.2,-6.6,1.6,-6.6),(-2.2,-10.2,-2.2,-6.6),(1.6,-10.2,1.6,-6.6),(-0.3,-6.6,-0.3,-10.2),
                      (8.2,1.0,10.4,1.0),(8.2,1.0,8.2,-3.4),(8.2,-3.4,10.4,-3.4),(3.6,9.0,9.0,9.0),(-10.2,-6.8,-6.0,-6.8)]:
    ridge(x0,y0,x1,y1)
def hasa(cx,cy,rot,L=1.6):
    T=dict(cx=cx,cy=cy,rot=rot)
    for k in range(4):
        x=-L+2*L*k/3; box("darkwood",x,0,0.0,1.3,0.04,0.04,T)
    for z in (0.55,0.85,1.15): box("wood",0,0,z,z+0.05,L+0.1,0.03,T)
    box("snow",0,0,1.3,1.36,L+0.1,0.06,T)
hasa(0.6,-8.4,math.pi/2,1.3); hasa(9.3,-1.2,math.pi/2,1.2); hasa(-7.6,-1.0,0.0,1.4)

# ---- cedars (sugi) heavy with snow round the village
def cedar(cx,cy,s,ph=0.0):
    T=dict(cx=cx,cy=cy,s=s)
    prism("bark",0,0,-0.3,0.8,0.18,0.15,6,ph,T)
    for (r,zb,zt,p) in [(0.95,0.6,2.4,ph),(0.78,1.6,3.4,ph+0.4),(0.6,2.6,4.4,ph+0.8),(0.42,3.6,5.3,ph+0.2)]:
        cone("cedar",ngon(r,zb,7,p),(0,0,zt),T)
        cone("snow",ngon(r*0.52,zb+(zt-zb)*0.5+0.04,7,p),(0,0,zt+0.04),T)
for (x,y,s,p) in [(-10.0,3.8,1.05,0.2),(-10.0,9.0,1.15,0.6),(-6.0,10.0,1.0,0.1),(-0.6,10.0,1.1,0.4),(3.6,10.0,1.0,0.8),(9.6,8.6,0.95,0.3),
                  (10.0,5.0,0.9,0.5),(-10.0,-3.4,0.9,0.7),(-9.8,-8.6,0.85,0.2),(-1.8,6.9,0.8,0.9),(4.0,2.4,0.75,0.3),(-6.4,-10.0,0.85,0.6)]: cedar(x,y,s,p)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/shirakawa-go.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=11.2; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1   # a larger footprint for the whole village (MAX_FOOTPRINT_HALF)
def ground_at(x,y): return 0.0     # flat grounds; the houses are solid, not walkable
ground=[[0.0 for ix in range(GN)] for iz in range(GN)]
CELL=0.3
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
                    if z<BAND0 or z>BAND1: continue
                    if nz>0.92 and z<0.6: continue
                    solid_cells.add((int((x+HALF)/CELL),int((y+HALF)/CELL)))
solids=[[round(-HALF+CELL*(cx+0.5),2), round(-(-HALF+CELL*(cy+0.5)),2), 0.22] for cx,cy in sorted(solid_cells)]
solids+=[[round(x,2),round(-y,2),r] for x,y,r in EXTRA_SOLIDS]
INTERACT=(2.6,-3.4)   # the village path among the houses
STAND=(7.7,-8.3)      # where the path enters the village
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]],"terrainSurface":True}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/shirakawa-go.json"
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
    objname=key if key.startswith("glow_") else "shirakawago_"+key
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
