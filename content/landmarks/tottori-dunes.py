# Tottori Sand Dunes (the wind-rippled sand climbing to the Umanose ridge, the sea beyond it, the oasis pond, camels waiting by the path) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python tottori-dunes.py
# Rebuilds content/landmarks/tottori-dunes.blend and public/models/landmarks/tottori-dunes.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/tottori-dunes.glb"
BLEND=ROOT+"/content/landmarks/tottori-dunes.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"sand":"e2c890","sand2":"d4b77c","sanddk":"b89a62","sea":"2f6f8f","foam":"eef2f0","wood":"7a5a3e","grass":"7a8a4a","camel":"b08a5c","red":"c8473a"}
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
rng=random.Random(56)
EXTRA_SOLIDS=[]; NOSOLID={"foam","grass"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the dune ridge with the sea beyond it
TERRAIN_SURFACE=False; EDGE_LEVEL=0.0          # the model draws its own sand, rippled by the wind
S2=math.sqrt(0.5)
def to_xy(u,v): return (S2*(u+v),S2*(v-u))
def to_uv(x,y): return (S2*(x-y),S2*(x+y))
def F(u,v,rot=0.0,cz=0.0): x,y=to_xy(u,v); return dict(cx=x,cy=y,cz=cz,rot=math.pi/4+rot)

# ---- the landform: the sand climbs from the camera to Umanose, the horse's back, a long ridge; its lee falls steeply
# to a beach and a strip of the Sea of Japan, held in by spits at either end. A pond (the oasis) lies in a hollow
SEA=-0.55; SF=-1.0
def ridge_u(v): return -2.0+0.6*math.sin(0.35*v+0.5)
# the Sea of Japan fills the whole back of the footprint behind one long beach, held in only by a low sand lip at
# the footprint's edge, so it reads as the open sea the ridge falls toward and not as a pond
SW=14.3
def sea_in(u,v): return u<-6.4 and abs(u)+abs(v)<SW
PO=(2.0,-3.6)
def H(x,y):
    u,v=to_uv(x,y)
    ru=ridge_u(v); top=3.0+0.4*math.sin(0.5*v)
    if u>=ru: h=top*(1-smooth(ru,ru+7.0,u))**1.1             # the long windward slope up from the camera
    else:     h=top*(1-smooth(ru,ru-3.6,u))                  # the steep lee slope down to the beach
    h*=smooth(14.6,11.4,abs(u)+abs(v))                       # back to the base height at the footprint's corners
    if u<ru-3.0:
        b=0.12*smooth(-5.6,-6.4,u)
        h=max(h,0.0)-b
        if sea_in(u,v):
            f=smooth(-6.3,-6.9,u)*smooth(SW,SW-0.7,abs(u)+abs(v)); h=SF*f+(SEA+0.1)*(1-f)
    h+=0.035*math.sin(5.5*u+1.3*v)*smooth(0.2,0.8,h)          # wind ripples
    d=math.hypot(u-PO[0],(v-PO[1])*0.8)
    h-=0.55*smooth(1.8,0.9,d)
    return h
def water_disc(x,y):
    u,v=to_uv(x,y); return sea_in(u,v) or math.hypot(u-PO[0],(v-PO[1])*0.8)<0.95
STEP=0.5; N=int(round(2*FH/STEP)); STEP=2*FH/N
g={}
for j in range(N+1):
    for i in range(N+1):
        x,y=-FH+i*STEP,-FH+j*STEP
        if 0<i<N and 0<j<N: x+=rng.uniform(-0.04,0.04); y+=rng.uniform(-0.04,0.04)
        g[(i,j)]=(x,y,H(x,y))
vs=[];ix={}
for k,vv in g.items(): ix[k]=len(vs); vs.append(vv)
fs=[];ms=[]
for j in range(N):
    for i in range(N):
        a,b,c,d=(i,j),(i+1,j),(i+1,j+1),(i,j+1)
        for t in ([(a,b,c),(a,c,d)] if (i+j)%2==0 else [(a,b,d),(b,c,d)]):
            ps=[g[k] for k in t]; cx,cy=sum(p[0] for p in ps)/3,sum(p[1] for p in ps)/3; hh=sum(p[2] for p in ps)/3
            u,v=to_uv(cx,cy)
            m="sand" if math.sin(2.2*u+0.6*v+0.4*math.sin(0.8*v))>-0.2 else "sand2"
            if u<ridge_u(v)-0.2 and u>ridge_u(v)-3.4: m="sanddk"            # the shadowed lee face
            if hh<SEA-0.05: m="sanddk"
            fs.append([ix[k] for k in t]); ms.append(m)
emit(vs,fs,ms)
uu=[-6.6-0.4*k for k in range(19)]
for ua,ub in zip(uu,uu[1:]):
    wa=SW-0.1-abs(ua); wb=SW-0.1-abs(ub)
    if wa<0.3 or wb<0.3: continue
    q=[to_xy(ua,-wa),to_xy(ua,wa),to_xy(ub,wb),to_xy(ub,-wb)]
    emit([(*p,SEA) for p in q],[[0,1,2,3]],["sea"])
for k in range(1):                                        # one clean line of surf along the beach
    u=-6.8; w=SW-abs(u)-0.8
    pts=[(u+0.12*math.sin(1.7*t+k),t) for t in [-w+2*w*q/12 for q in range(13)]]
    for (ua,va),(ub,vb) in zip(pts,pts[1:]):
        q=[to_xy(ua-0.07,va),to_xy(ua+0.07,va),to_xy(ub+0.07,vb),to_xy(ub-0.07,vb)]
        emit([(*p,SEA+0.02) for p in q],[[0,1,2,3]],["foam"])
px,py=to_xy(*PO); pz=H(px,py)+0.12
emit([(px+0.95*math.cos(2*math.pi*k/14)*S2-1.19*math.sin(2*math.pi*k/14)*S2,py-0.95*math.cos(2*math.pi*k/14)*S2-1.19*math.sin(2*math.pi*k/14)*S2,pz) for k in range(14)]+[(px,py,pz)],
     [[k,(k+1)%14,14] for k in range(14)],["sea"]*14)

# ---- the walkers' path of wooden steps up from the camera, a line of footprints to the crest, tufts of grass
for k in range(10):
    u=8.5-0.75*k; v=1.2+0.15*math.sin(k)
    x,y=to_xy(u,v); z=H(x,y)
    box("wood",0,0,z-0.12,z+0.04,0.55,0.12,F(u,v))
for k in range(16):
    u=1.2-0.22*k; v=1.25+0.3*math.sin(0.5*k)+(0.12 if k%2 else -0.12)
    x,y=to_xy(u,v); z=H(x,y)
    box("sanddk",0,0,z-0.02,z+0.015,0.08,0.13,F(u,v))
def tuft(u,v,s):
    x,y=to_xy(u,v); z=H(x,y)
    for k in range(5):
        a=2*math.pi*k/5+rng.uniform(0,0.5)
        cone("grass",[(x+0.04*math.cos(a+1.6),y+0.04*math.sin(a+1.6),z),(x-0.04*math.cos(a+1.6),y-0.04*math.sin(a+1.6),z),(x+0.08*math.cos(a),y+0.08*math.sin(a),z)],(x+0.35*s*math.cos(a),y+0.35*s*math.sin(a),z+0.5*s))
for k in range(26):
    u,v=rng.uniform(4,10),rng.uniform(-8,8)
    if abs(u)+abs(v)>12.5: continue
    tuft(u,v,rng.uniform(0.7,1.1))
for k in range(8):
    a=2*math.pi*k/8; tuft(PO[0]+1.25*math.cos(a),PO[1]+1.55*math.sin(a),0.9)

# ---- a string of camels resting by the path, waiting for riders, with their handler's awning
def camel(u,v,ang):
    x,y=to_xy(u,v); z=H(x,y); T=F(u,v,ang,z)
    box("camel",0,0,0.55,0.95,0.55,0.2,T); ico("camel",-0.05,0,1.05,0.28,0.18,0.2,T)
    for sx in (-0.38,0.38):
        for sy in (-0.12,0.12): box("camel",sx,sy,0.0,0.58,0.05,0.05,T)
    solid([[(0.5,-0.08,0.8),(0.5,0.08,0.8),(0.5,0.08,0.95),(0.5,-0.08,0.95)],[(0.75,-0.06,1.3),(0.75,0.06,1.3),(0.75,0.06,1.42),(0.75,-0.06,1.42)]],"camel",T)
    box("camel",0.86,0,1.3,1.42,0.14,0.07,T)
    box("red",-0.05,0,0.95,1.02,0.35,0.24,T)
camel(5.6,-1.6,0.3); camel(6.4,-2.6,0.2)
ax,ay=to_xy(7.2,-4.0)
for sx in (-1,1):
    for sy in (-1,1): x,y=to_xy(7.2+sx*0.6,-4.0+sy*0.6); box("wood",x,y,H(x,y)-0.1,1.4,0.04,0.04)
T=F(7.2,-4.0); box("red",0,0,1.4,1.47,0.75,0.75,T)

def ground_at(x,y): return H(x,y)
INTERACT=to_xy(7.6,1.2)    # at the foot of the wooden steps
STAND=to_xy(8.6,2.2)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/tottori-dunes.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/tottori-dunes.json"
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
    objname=key if key.startswith("glow_") else "tottori_"+key
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
