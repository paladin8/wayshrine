# Chuson-ji landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python chuson-ji.py
# Rebuilds content/landmarks/chuson-ji.blend and public/models/landmarks/chuson-ji.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/chuson-ji.glb"
BLEND=ROOT+"/content/landmarks/chuson-ji.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"snow":"eef2f4","gold":"d9a83c","lacquer":"221c1a","roof":"5a5e62","wood":"5a4232","stone":"8f8a80","fir":"2f4f3e","shingle":"3f3733","glow_cream":"e8dcb0"}
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
rng=random.Random(64)
EXTRA_SOLIDS=[]; NOSOLID={"fir"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=9.6   # footprint half-width (the sidecar's half): a single feature, the Golden Hall in its cover hall
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0

# ---- the hilltop terrace among the cedars, reached by stone steps from the front
TX0,TX1,TY0,TY1=-3.8,3.8,-1.6,5.0; TZ=0.9
def dd(x,y):
    dx=max(TX0-x,0.0,x-TX1); dy=max(TY0-y,0.0,y-TY1); return math.hypot(dx,dy)
def G(x,y): return TZ*(1-smooth(0.0,1.6,dd(x,y)))
for k in range(8):
    y=-3.35+0.22*k; z=G(0,y+0.11)
    box("stone",0,y+0.11,z-0.3,z+0.03,0.75,0.12)
box("stone",0,-1.0,TZ-0.05,TZ+0.03,0.7,0.65)                       # the paved walk to the hall

# ---- Konjikido: the Golden Hall on its black lacquered dais, gilded walls, posts and doorway under a dark shingled
# pyramid roof (the restoration found no gilding on the roof), the gilt jewel on its peak. (Shown open to the sky,
# as it stood before its cover halls were built)
z0=TZ; KX,KY=0.0,1.4
box("stone",KX,KY,z0-0.1,z0+0.12,2.0,2.0)
box("lacquer",KX,KY,z0+0.12,z0+0.45,1.55,1.55)
box("gold",KX,KY,z0+0.45,z0+0.53,1.62,1.62)
box("gold",KX,KY,z0+0.53,z0+1.85,1.2,1.2)
for sx in (-1,1):
    for sy in (-1,1): box("gold",KX+sx*1.22,KY+sy*1.22,z0+0.53,z0+1.85,0.09,0.09)
for sx in (-1,0,1):
    if sx: box("gold",KX+sx*0.42,KY-1.22,z0+0.53,z0+1.85,0.07,0.04)
box("lacquer",KX,KY-1.21,z0+0.6,z0+1.55,0.34,0.02)                    # the doors, dark between gilded posts
box("glow_altar",KX,KY-1.22,z0+0.8,z0+1.35,0.2,0.02)
for sx in (-1,1):                                                     # thin lacquer frames, so the gilt panels read
    box("lacquer",KX+sx*0.8,KY-1.215,z0+0.68,z0+0.72,0.32,0.02); box("lacquer",KX+sx*0.8,KY-1.215,z0+1.5,z0+1.54,0.32,0.02)
    box("lacquer",KX+sx*1.215,KY,z0+0.68,z0+0.72,0.02,1.0); box("lacquer",KX+sx*1.215,KY,z0+1.5,z0+1.54,0.02,1.0)
box("lacquer",KX,KY-1.21,z0+1.62,z0+1.66,1.2,0.02)
box("gold",KX,KY,z0+1.72,z0+1.86,1.32,1.32)                           # the gilt bracket course under the eaves
for k in range(9):                                                     # a gilt railing round the dais
    t=-1.45+2.9*k/8
    for x,y in ((KX+t,KY-1.5),(KX+t,KY+1.5),(KX-1.5,KY+t),(KX+1.5,KY+t)):
        if not (abs(x-KX)<0.5 and y<KY-1.4): box("gold",x,y,z0+0.45,z0+0.75,0.035,0.035)
for x0,y0,x1,y1 in ((-1.5,-1.5,-0.5,-1.5),(0.5,-1.5,1.5,-1.5),(-1.5,1.5,1.5,1.5),(-1.5,-1.5,-1.5,1.5),(1.5,-1.5,1.5,1.5)):
    box("gold",KX+(x0+x1)/2,KY+(y0+y1)/2,z0+0.72,z0+0.77,abs(x1-x0)/2+0.03,abs(y1-y0)/2+0.03)
for k in range(3):                                                     # steps up the dais
    box("lacquer",KX,KY-1.62-0.16*k,z0+0.12,z0+0.45-0.11*k,0.45,0.08)
flared_roof([(1.75,1.75,z0+1.85,0.16),(1.75,1.75,z0+1.96,0.16),(0.07,0.07,z0+2.85,0.0)],"shingle",KX,KY)
prism("gold",KX,KY,z0+2.85,z0+3.0,0.11,0.07,6); ico("gold",KX,KY,z0+3.05,0.1,0.1,0.1)

# stone lanterns at the top of the steps
for k,sx in enumerate((-1.35,1.35)):
    x,y=sx,-1.25
    prism("stone",x,y,TZ-0.05,TZ+0.6,0.1,0.08,6); box("stone",x,y,TZ+0.6,TZ+0.66,0.2,0.2)
    box("glow_lanterns",x,y,TZ+0.66,TZ+0.88,0.12,0.12)
    flared_roof([(0.25,0.25,TZ+0.88,0.04),(0.25,0.25,TZ+0.93,0.04),(0.03,0.03,TZ+1.13,0.0)],"stone",x,y)
    cone("snow",[(x+0.22*math.cos(a),y+0.22*math.sin(a),TZ+0.95) for a in [2*math.pi*j/6 for j in range(6)]],(x,y,TZ+1.16))

# ---- the old cover hall (Kyu-Ooido): weathered timber under a hip roof, on the level ground to the left
QX,QY=-6.2,3.2
box("stone",QX,QY,-0.1,0.15,1.35,1.35)
box("wood",QX,QY,0.15,1.6,1.15,1.15)
for k in range(5): box("lacquer",QX-1.15+k*0.575,QY-1.16,0.15,1.6,0.05,0.02)
flared_roof([(1.65,1.65,1.6,0.14),(1.65,1.65,1.68,0.14),(0.9,0.9,2.2,0.04),(0.06,0.06,2.75,0.0)],"roof",QX,QY)
flared_roof([(1.56,1.56,1.69,0.05),(1.56,1.56,1.73,0.05),(0.85,0.85,2.26,0.03),(0.04,0.04,2.8,0.0)],"snow",QX,QY)

# ---- the tall cedars of the precinct, lining the approach and closing in behind
def cedar(x,y,s):
    z=G(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.14,-0.3,5),ngon(0.09,1.4,5)],"wood",T)
    for zc,r,hh in ((1.1,0.62,1.2),(1.9,0.45,1.1),(2.6,0.3,0.9)):
        cone("fir",ngon(r,zc,6,rng.uniform(0,1)),(0,0,zc+hh),T)
        cone("snow",ngon(r*0.5,zc+hh*0.48,6,0.3),(0,0,zc+hh+0.05),T)
for x,y,s in [(-1.9,-7.6,1.1),(1.9,-7.2,1.15),(-2.0,-5.2,1.2),(2.1,-4.8,1.1),(-4.6,-2.6,1.2),(4.8,-2.2,1.25),
              (-5.0,0.8,1.3),(5.4,1.4,1.2),(4.6,4.4,1.3),(-3.4,7.2,1.3),(-0.6,7.6,1.35),(2.4,7.4,1.25),(5.6,7.0,1.2),
              (-7.6,6.6,1.15),(-8.0,-0.6,1.1),(7.8,-5.6,1.1),(-7.4,-6.4,1.1),(7.6,4.0,1.15),(-4.2,4.8,1.2)]:
    cedar(x,y,s)

def ground_at(x,y): return G(x,y)
def water_disc(x,y): return False
INTERACT=(0.0,-1.0)   # at the top of the steps, before the Golden Hall
STAND=(0.0,-2.8)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/chuson-ji.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/chuson-ji.json"
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
    objname=key if key.startswith("glow_") else "chuson_"+key
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
