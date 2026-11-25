# Furano lavender fields landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python furano.py
# Rebuilds content/landmarks/furano.blend and public/models/landmarks/furano.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/furano.glb"
BLEND=ROOT+"/content/landmarks/furano.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"lavender":"8a6cc4","poppy":"d8463a","cream":"f2ede2","pink":"e88aaa","orange":"ee9a3a","yellow":"eed24a","gravel":"cfc4ae","roof":"a8443a","bark":"5a4636","leaf":"3f6a3a","soil":"7a5c44"}
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
rng=random.Random(61)
EXTRA_SOLIDS=[]; NOSOLID={"leaf","lavender","poppy","pink","orange","yellow","cream","gravel","soil"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, a hillside farm of flower fields
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0

# ---- the hill: one broad rise, its crown toward the back, falling to level meadow before every edge
HC=(-0.5,2.2); HR=8.6; HH=1.8
def G(x,y):
    d=math.hypot(x-HC[0],(y-HC[1])*1.1)/HR
    return HH*max(0.0,1-d*d)**1.5

def strip(mat,pts,w,h,sink=0.08,top=0.6):
    # a mounded row lofted along the ground through pts (x,y)
    rings=[]
    for k,(x,y) in enumerate(pts):
        a=pts[max(k-1,0)]; b=pts[min(k+1,len(pts)-1)]
        dx,dy=b[0]-a[0],b[1]-a[1]; l=math.hypot(dx,dy) or 1.0; nx,ny=-dy/l,dx/l
        z=G(x,y)
        rings.append([(x+nx*w,y+ny*w,z-sink),(x+nx*w*top,y+ny*w*top,z+h),(x-nx*w*top,y-ny*w*top,z+h),(x-nx*w,y-ny*w,z-sink)])
    solid(rings,mat)

# ---- the lavender field on the left of the hill: long mounded rows of bushes running across the slope,
# bowing gently with the contour
def rowy(j,x): return -5.4+0.78*j+0.45*math.sin(0.35*x+0.3)
for j in range(15):
    x0=-9.2+0.25*math.sin(j)
    xb=-1.2+rng.uniform(-0.6,0.5) if j%3!=1 else 0.6     # where the row breaks into separate bushes near the path
    n=max(1,int((xb-x0)/0.55))
    pts=[(x0+(xb-x0)*k/n,rowy(j,x0+(xb-x0)*k/n)) for k in range(n+1)]
    pts=[p for p in pts if abs(p[0])<FH-1.2 and abs(p[1])<FH-1.2]
    if len(pts)>1: strip("lavender",pts,0.25,0.3)
    x=xb+0.35
    while x<0.55:                                        # the row's front end: low, distinct bushes with gaps
        if rng.random()>0.15:
            y=rowy(j,x); r=rng.uniform(0.2,0.27); ico("lavender",x,y,G(x,y)-0.05,r,r*0.95,r*1.05)
        x+=rng.uniform(0.42,0.55)
# ---- the Irodori field on the right: broad flat bands of colour running down the slope
COL=["poppy","cream","pink","lavender","orange","yellow","poppy","cream","pink","lavender"]
for j,m in enumerate(COL):
    x=2.0+0.78*j
    y0,y1=-5.0+0.3*math.cos(j),6.6-0.4*math.sin(j)
    n=int((y1-y0)/0.6)
    pts=[(x+0.25*math.sin(0.3*(y0+(y1-y0)*k/n)),y0+(y1-y0)*k/n) for k in range(n+1)]
    pts=[p for p in pts if abs(p[0])<FH-1.2 and abs(p[1])<FH-1.2]
    if len(pts)>1: strip(m,pts,0.36,0.14,0.06,0.85)

# ---- the gravel walks: one along the foot of the fields, one climbing between them to a bench on the crown
def walk(pts,w=0.45): strip("gravel",pts,w,0.03,0.06,1.0)
walk([(-9.6+19.2*k/24,-6.5+0.15*math.sin(k*0.5)) for k in range(25)])
walk([(1.3+0.15*math.sin(k*0.7),-6.3+12.6*k/18) for k in range(19)],0.38)
# narrow strips of bare soil beside the walks, where the planting stops short of the gravel
WK=[(1.3+0.15*math.sin(k*0.7),-6.3+12.6*k/18) for k in range(19)]
for sd in (-1,1): strip("soil",[(x+sd*0.58,y) for x,y in WK],0.13,0.012,0.05,1.0)
strip("soil",[(-9.6+19.2*k/24,-5.92+0.15*math.sin(k*0.5)) for k in range(25)],0.12,0.012,0.05,1.0)
bx,by=1.3,6.9; bz=G(bx,by)
box("bark",bx,by+0.25,bz+0.38,bz+0.46,0.6,0.18)
for sx in (-0.5,0.5): box("bark",bx+sx,by+0.25,bz-0.1,bz+0.38,0.05,0.15)

# ---- the farm: a white shop and drying barn with red roofs below the fields
def house(cx,cy,hx,hy,h,r,rot=0.0):
    T=dict(cx=cx,cy=cy,rot=rot)
    box("cream",0,0,-0.1,h,hx,hy,T)
    extrude_y("cream",[(-hx,h-0.02),(hx,h-0.02),(0,h+r-0.12)],-hy,hy,T)
    extrude_y("roof",[(-hx-0.3,h-0.12),(hx+0.3,h-0.12),(0,h+r)],-hy-0.25,hy+0.25,T)
    box("bark",0,-hy-0.02,0.0,0.85,0.3,0.03,T)
    for sx in (-0.6,0.6):
        if hx>1.0: box("bark",sx*hx,-hy-0.02,0.45,0.85,0.22,0.03,T)
house(-5.6,-8.6,1.7,1.0,1.1,0.85)
house(-2.4,-8.9,1.0,0.8,1.0,0.7)
house(6.4,-8.4,1.3,1.6,1.5,1.0,math.pi/2)
prism("roof",8.9,-9.3,-0.1,2.6,0.5,0.5,8); frus("roof",8.9,-9.3,2.6,3.0,0.5,0.5,0.05,0.05)

# ---- the windbreak of poplars along the back, birches at the field corners
def poplar(x,y,s):
    z=G(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.12,-0.3,5),ngon(0.08,1.0,5)],"bark",T)
    ico("leaf",0,0,2.2,0.55,0.55,1.6,T)
for k in range(14):
    x=-9.0+18.0*k/13; y=8.8+0.25*math.sin(k*1.7)
    if abs(x)<FH-1.2: poplar(x,y,rng.uniform(0.9,1.1))
def tree(x,y,s):
    z=G(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.12,-0.3,5),ngon(0.07,1.4,5)],"cream",T)
    ico("leaf",0,0,1.9,0.9,0.9,0.75,T); ico("leaf",0.4,0.25,1.5,0.55,0.55,0.45,T)
for x,y,s in [(-9.4,-3.2,0.9),(-9.6,1.6,0.85),(-9.2,6.0,0.9),(9.6,-3.6,0.9),(9.4,1.2,0.85),(9.6,5.6,0.9),(-8.6,-9.4,0.85),(3.6,-9.6,0.8),(9.6,-6.8,0.85)]:
    tree(x,y,s)

def ground_at(x,y): return G(x,y)
def water_disc(x,y): return False
INTERACT=(-3.0,-6.3)   # on the walk at the foot of the lavender rows
STAND=(-2.0,-7.0)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/furano.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/furano.json"
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
    objname=key if key.startswith("glow_") else "furano_"+key
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
