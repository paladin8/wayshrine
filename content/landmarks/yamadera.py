# Yamadera landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python yamadera.py
# Rebuilds content/landmarks/yamadera.blend and public/models/landmarks/yamadera.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/yamadera.glb"
BLEND=ROOT+"/content/landmarks/yamadera.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"snow":"eef2f4","rock":"6e6a66","forest":"3f5a48","wood":"4e3a2c","red":"c0442e","roof":"4a4d52","stone":"8f8a80","fir":"2f4f3e","glow_cream":"e8dcb0"}
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
rng=random.Random(65)
EXTRA_SOLIDS=[]; NOSOLID={"fir","forest"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the temple mountain and its halls
TERRAIN_SURFACE=False; EDGE_LEVEL=0.0          # the model draws its own landform: the crags, the ledge, the valley

# ---- Hojusan in winter: a valley floor at the front, a rock face rising to the ledge where the Kaisando and the
# little red Nokyodo stand on their crag, the Godaido built out over the drop; higher crags behind
CRAGS=[(-3.75,0.05,1.25,0.75),(-6.2,5.6,1.6,1.4),(-2.6,6.4,1.9,1.5),(1.2,6.0,1.4,1.3),(4.4,5.4,1.7,1.4),(6.6,3.0,1.1,1.2),(-7.0,2.2,1.0,1.1)]
def H(x,y):
    h=3.2*smooth(-1.6,0.7,y+0.5*math.sin(0.7*x))+2.3*smooth(3.0,5.2,y+0.4*math.sin(0.9*x+1.0))
    for cx,cy,ch,cr in CRAGS:
        d=math.hypot(x-cx,y-cy)/cr; h+=ch*max(0.0,1-d*d)**1.5
    return h*smooth(11.0,8.4,y)*smooth(11.0,8.6,abs(x))
STEP=0.55; N=int(round(2*FH/STEP)); STEP=2*FH/N
g={}
for j in range(N+1):
    for i in range(N+1):
        x,y=-FH+i*STEP,-FH+j*STEP
        if 0<i<N and 0<j<N: x+=rng.uniform(-0.12,0.12); y+=rng.uniform(-0.12,0.12)
        g[(i,j)]=(x,y,H(x,y))
vs=[];ix={}
for k,vv in g.items(): ix[k]=len(vs); vs.append(vv)
fs=[];ms=[]
for j in range(N):
    for i in range(N):
        a,b,c,d=(i,j),(i+1,j),(i+1,j+1),(i,j+1)
        for t in ([(a,b,c),(a,c,d)] if (i+j)%2==0 else [(a,b,d),(b,c,d)]):
            ps=[g[k] for k in t]; hh=[p[2] for p in ps]
            sl=(max(hh)-min(hh))/STEP; h=sum(hh)/3
            m="snow"
            if sl>0.95: m="rock"
            elif sl>0.35 and h>0.4: m="forest"
            fs.append([ix[k] for k in t]); ms.append(m)
emit(vs,fs,ms)

def hall(cx,cy,hx,hy,h,wall="wood",roofz=None,ridge=None,rot=0.0):
    z=H(cx,cy) if roofz is None else roofz
    T=dict(cx=cx,cy=cy,rot=rot)
    box("stone",0,0,z-0.4,z+0.12,hx+0.15,hy+0.15,T)
    box(wall,0,0,z+0.12,z+h,hx,hy,T)
    return z
def roof(cx,cy,hx,hy,z,rise,ridge):
    flared_roof([(hx+0.35,hy+0.35,z,0.12),(hx+0.35,hy+0.35,z+0.08,0.12),(hx*0.55,hy*0.4,z+rise*0.6,0.04),(ridge,0.05,z+rise,0.0)],"roof",cx,cy)
    flared_roof([(hx+0.29,hy+0.29,z+0.09,0.04),(hx+0.29,hy+0.29,z+0.12,0.04),(hx*0.52,hy*0.38,z+rise*0.6+0.04,0.02),(ridge*0.95,0.04,z+rise+0.04,0.0)],"snow",cx,cy)

# the Konponchudo, the great main hall on the valley floor
z=hall(-4.6,-6.2,1.7,1.15,1.15)
for k in range(5): box("glow_doors",-4.6-1.2+0.6*k,-6.2-1.16,z+0.2,z+0.95,0.2,0.02)
roof(-4.6,-6.2,1.7,1.15,z+1.15,1.3,1.1)
# the Sanmon at the foot of the steps
z=H(0.0,-4.3)
for sx in (-0.75,0.75):
    for sy in (-0.3,0.3): box("wood",sx,-4.3+sy,z-0.1,z+1.4,0.07,0.07)
box("wood",0,-4.3,z+1.25,z+1.4,0.9,0.4)
roof(0.0,-4.3,0.95,0.45,z+1.4,0.75,0.75)
# the stone steps: up the valley, then switching back and forth up the face to the ledge
PATH=[(0.0,-5.2),(0.0,-3.6),(0.2,-2.2),(-0.4,-1.3),(0.8,-0.6),(-0.2,0.2),(-0.9,1.0),(-1.6,1.3)]
for (x0,y0),(x1,y1) in zip(PATH,PATH[1:]):
    L=math.hypot(x1-x0,y1-y0); n=max(2,int(L/0.3)); a=math.atan2(y1-y0,x1-x0)
    for k in range(n):
        t=(k+0.5)/n; x,y=x0+(x1-x0)*t,y0+(y1-y0)*t; z=H(x,y)
        box("stone",0,0,z-0.35,z+0.06,0.16,0.42,dict(cx=x,cy=y,rot=a))

# ---- on the ledge: the Kaisando, and the little vermilion Nokyodo on the crag's tip beside it
z=hall(-2.1,1.85,0.75,0.6,0.85)
box("glow_doors",-2.1,1.85-0.61,z+0.2,z+0.7,0.35,0.02)
roof(-2.1,1.85,0.75,0.6,z+0.85,0.8,0.5)
nx,ny=-3.75,0.05; nz=H(nx,ny)
box("red",nx,ny,nz-0.2,nz+0.62,0.38,0.38)
box("glow_doors",nx,ny-0.39,nz+0.12,nz+0.48,0.18,0.02)
flared_roof([(0.62,0.62,nz+0.62,0.08),(0.62,0.62,nz+0.68,0.08),(0.04,0.04,nz+1.08,0.0)],"roof",nx,ny)
flared_roof([(0.55,0.55,nz+0.69,0.03),(0.55,0.55,nz+0.72,0.03),(0.03,0.03,nz+1.12,0.0)],"snow",nx,ny)
# ---- the Godaido: an open timber stage built out over the drop on a frame of posts, the view hall of the valley
GX,GY=2.5,0.55; GZ=H(GX,GY+0.8)+0.15
box("wood",GX,GY,GZ-0.1,GZ,1.05,0.8)
for sx in (-1,0,1):
    for sy in (-1,0,1):
        x,y=GX+sx*0.95,GY+sy*0.7; box("wood",x,y,H(x,y)-0.2,GZ-0.1,0.06,0.06)
for zc in (0.35,0.6):
    zz=GZ-0.1-(GZ-H(GX,GY-0.7))*zc
    box("wood",GX,GY-0.7,zz-0.04,zz+0.04,1.0,0.04); box("wood",GX-0.95,GY,zz-0.04,zz+0.04,0.04,0.75); box("wood",GX+0.95,GY,zz-0.04,zz+0.04,0.04,0.75)
for sx in (-1,1):
    for sy in (-1,1): box("wood",GX+sx*0.95,GY+sy*0.7,GZ,GZ+1.0,0.06,0.06)
box("wood",GX,GY-0.78,GZ+0.35,GZ+0.42,1.02,0.03); box("wood",GX-1.03,GY,GZ+0.35,GZ+0.42,0.03,0.78); box("wood",GX+1.03,GY,GZ+0.35,GZ+0.42,0.03,0.78)
box("glow_doors",GX,GY+0.68,GZ+0.1,GZ+0.8,0.6,0.02)
roof(GX,GY,1.0,0.75,GZ+1.0,0.85,0.7)

# ---- snowed cedars on the slopes and in the valley
def cedar(x,y,s):
    z=H(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.13,-0.3,5),ngon(0.08,1.2,5)],"wood",T)
    for zc,r,hh in ((0.9,0.58,1.1),(1.6,0.4,1.0)):
        cone("fir",ngon(r,zc,6,rng.uniform(0,1)),(0,0,zc+hh),T)
        cone("snow",ngon(r*0.5,zc+hh*0.48,6,0.3),(0,0,zc+hh+0.05),T)
keep=[(-4.6,-6.2,2.4),(0,-4.3,1.3),(-2.1,1.85,1.3),(-3.75,0.05,0.9),(2.5,0.55,1.6)]+[(x,y,0.55) for x,y in PATH]
tp=[]
for k in range(260):
    x,y=rng.uniform(-9.8,9.8),rng.uniform(-9.8,8.6)
    h=H(x,y)
    if h>4.2 or any(math.hypot(x-a,y-b)<r+0.4 for a,b,r in keep) or any(math.hypot(x-a,y-b)<1.1 for a,b in tp): continue
    gx=(H(x+0.3,y)-H(x-0.3,y))/0.6; gy=(H(x,y+0.3)-H(x,y-0.3))/0.6
    if math.hypot(gx,gy)>1.3: continue
    if y<-3.0 and rng.random()<0.55: continue
    tp.append((x,y)); cedar(x,y,rng.uniform(0.8,1.1))
    if len(tp)>=34: break

def ground_at(x,y):
    if abs(x-GX)<1.05 and abs(y-GY)<0.8: return GZ
    return H(x,y)
def water_disc(x,y): return False
INTERACT=(0.0,-5.0)   # before the Sanmon at the foot of the thousand steps
STAND=(-0.2,-6.8)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/yamadera.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/yamadera.json"
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
    objname=key if key.startswith("glow_") else "yamadera_"+key
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
