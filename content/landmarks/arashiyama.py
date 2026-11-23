# Arashiyama bamboo grove (the path between brushwood fences through tall bamboo, and the black torii of Nonomiya at its edge) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python arashiyama.py
# Rebuilds content/landmarks/arashiyama.blend and public/models/landmarks/arashiyama.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/arashiyama.glb"
BLEND=ROOT+"/content/landmarks/arashiyama.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"culm":"8fb36a","culmold":"b4b67a","bambooleaf":"6f9e45","brush":"8a6a48","pave":"b3ad9f","kuroki":"3b302a","roof":"5e4232","white":"efeae0","moss":"6f9a3a","stone":"9a958c","leaf":"c2603a","glow_cream":"e8dcb0"}
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
rng=random.Random(33)
EXTRA_SOLIDS=[]; NOSOLID={"bambooleaf","moss","leaf"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the grove with its path and the shrine at its edge
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0
def water_disc(x,y): return False
S2=math.sqrt(0.5)
def to_xy(u,v): return (S2*(u+v),S2*(v-u))     # u toward the camera, v screen-right
def to_uv(x,y): return (S2*(x-y),S2*(x+y))
def inside(x,y,m=0.0): return abs(x)<=FH-m and abs(y)<=FH-m

# ---- the path: a gentle S running straight away from the camera between brushwood fences, the bamboo walling it
def vp(u): return 1.1*math.sin(0.33*u)
PW=1.0; FO=1.28
def path_strip(mat,off0,off1,z0,z1,u0=-16.0,u1=16.0,step=1.6,skip=None):
    us=[u0+k*step for k in range(int((u1-u0)/step)+1)]
    for ua,ub in zip(us,us[1:]):
        if skip and skip(ua,ub): continue
        a0=to_xy(ua,vp(ua)+off0); a1=to_xy(ua,vp(ua)+off1); b0=to_xy(ub,vp(ub)+off0); b1=to_xy(ub,vp(ub)+off1)
        if not all(inside(*p,0.05) for p in (a0,a1,b0,b1)): continue
        if z1-z0<0.03:
            emit([(a0[0],a0[1],z1),(a1[0],a1[1],z1),(b1[0],b1[1],z1),(b0[0],b0[1],z1)],[[0,1,2,3]],[mat])
        else:
            solid([[(a0[0],a0[1],z0),(a1[0],a1[1],z0),(a1[0],a1[1],z1),(a0[0],a0[1],z1)],[(b0[0],b0[1],z0),(b1[0],b1[1],z0),(b1[0],b1[1],z1),(b0[0],b0[1],z1)]],mat)
path_strip("pave",-PW,PW,0.0,0.03)
SU0,SU1=5.9,7.3                       # the gap in the left fence at the shrine
gap=lambda ua,ub: ub>SU0-0.2 and ua<SU1+0.2
for sd in (-1,1):
    sk=None
    path_strip("brush",sd*FO-0.07,sd*FO+0.07,-0.05,0.72,skip=sk)          # shibagaki of bundled brushwood
    path_strip("culmold",sd*FO-0.04,sd*FO+0.04,0.72,0.8,skip=sk)          # a bamboo rail along its top
    for k in range(-10,11):
        u=1.6*k
        if sk and SU0-0.4<u<SU1+0.4: continue
        x,y=to_xy(u,vp(u)+sd*FO)
        if inside(x,y,0.2): prism("culmold",x,y,-0.05,0.85,0.05,0.05,4)

# ---- the bamboo: tall pale culms in their hundreds, leaning a little, leaves massed high overhead; the grove
# opens at the camera end so the path can be seen going in
def spindle(mat,p0,p1,w,t):
    P0,P1=Vector(p0),Vector(p1); d=P1-P0; m=P0+d*0.45
    h=d.cross(Vector((0,0,1))); h.normalize() if h.length>1e-6 else None
    n=h.cross(d); n.normalize()
    vs=[tuple(P0),tuple(m+h*w),tuple(m+n*t),tuple(m-h*w),tuple(m-n*t),tuple(P1)]
    emit(vs,[[0,1,2],[0,2,3],[0,3,4],[0,4,1],[5,2,1],[5,3,2],[5,4,3],[5,1,4]],[mat]*8)
pts=[]
for _ in range(5000):
    x,y=rng.uniform(-FH+1.0,FH-1.0),rng.uniform(-FH+1.0,FH-1.0)
    u,v=to_uv(x,y)
    if abs(v-vp(u))<FO+0.35: continue
    if u>4.6+rng.uniform(-0.8,0.8) and not (abs(v)>7.5 and u<8.5): continue
    if any((x-px)**2+(y-py)**2<0.66**2 for px,py in pts): continue
    pts.append((x,y))
    if len(pts)>=165: break
for x,y in pts:
    u,v=to_uv(x,y)
    h=rng.uniform(7.0,9.0)*(0.75 if u>4.6 else 1.0)
    # lean a little away from the path, as bamboo leans toward the light over it
    dv=1 if v>vp(u) else -1; lx,ly=to_xy(0,-dv*rng.uniform(0.0,0.5)); lx+=rng.uniform(-0.15,0.15); ly+=rng.uniform(-0.15,0.15)
    r=rng.uniform(0.07,0.11); m="culm" if rng.random()<0.78 else "culmold"
    solid([ngon(r,-0.1,4,rng.uniform(0,1),x,y),ngon(r*0.7,h,4,0,x+lx,y+ly)],m)
    tx,ty=x+lx,y+ly
    for k in range(3 if rng.random()<0.6 else 2):   # feathery sprays of leaves hanging from the top
        a=rng.uniform(0,6.28)
        spindle("bambooleaf",(tx,ty,h-0.15-0.9*k),(tx+0.95*math.cos(a),ty+0.95*math.sin(a),h-1.1-0.9*k),0.32,0.1)

# ---- Nonomiya, the little shrine at the grove's edge: its torii of unbarked black timber, a moss garden, the hall
SC=to_xy(6.4,-3.6)
T=dict(cx=SC[0],cy=SC[1],rot=math.pi/4)     # local -y faces the camera, the open mouth of the grove
def lbox(mat,x,y,z0,z1,hx,hy): box(mat,x,y,z0,z1,hx,hy,T)
for sx in (-1,1): solid([ngon(0.13,-0.05,7,0,sx*0.85,-2.0),ngon(0.12,1.9,7,0,sx*0.85,-2.0)],"kuroki",T)
for z,h,L in ((1.62,0.12,0.9),(1.9,0.16,1.15)):
    solid([[(-L,-2.0-0.11,z),(L,-2.0-0.11,z),(L,-2.0-0.11,z+h),(-L,-2.0-0.11,z+h)],[(-L,-2.0+0.11,z),(L,-2.0+0.11,z),(L,-2.0+0.11,z+h),(-L,-2.0+0.11,z+h)]],"kuroki",T)
lbox("moss",0,-0.3,-0.12,0.06,2.0,1.5)
lbox("pave",0,-1.3,-0.04,0.07,0.35,1.1)
lbox("stone",0,0.85,-0.05,0.3,1.3,0.75)
lbox("roof",0,0.85,0.3,1.25,1.05,0.55)
lbox("white",0,0.29,0.55,1.1,0.8,0.02)
lbox("glow_hall",0,0.27,0.6,1.0,0.3,0.01)
roofT=[(1.5,1.05,1.25,0.12),(1.5,1.05,1.32,0.12),(0.9,0.1,1.85,0.0)]
nb=len(B.get("roof",([],[]))[0]); flared_roof(roofT,"roof",0,0)
bv=B["roof"][0]
for i in range(nb,len(bv)):
    x,y,z=bv[i]; bv[i]=(*xf([(x,y+0.85,z)],**T)[0][:2],z)
for sx in (-1,1):
    lbox("stone",sx*1.4,-1.0,-0.05,0.55,0.1,0.1); lbox("stone",sx*1.4,-1.0,0.55,0.6,0.17,0.17)
    lbox("glow_lantern_%d"%(sx+1),sx*1.4,-1.0,0.6,0.8,0.11,0.11); lbox("stone",sx*1.4,-1.0,0.8,0.88,0.2,0.2)
# a low brushwood fence round the shrine, open to the path
for (ax,ay),(bx,by) in (((-2.0,-1.9),(-2.0,1.6)),((2.0,-1.9),(2.0,1.6)),((-2.0,1.6),(2.0,1.6)),((-2.0,-1.9),(-1.1,-1.9)),((1.1,-1.9),(2.0,-1.9))):
    cx,cy=(ax+bx)/2,(ay+by)/2; lbox("brush",cx,cy,-0.05,0.6,max(0.06,abs(bx-ax)/2),max(0.06,abs(by-ay)/2))
# maples and shrubs about the open end of the grove
def maple(x,y,s,m="leaf"):
    T2=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.12,-0.3,5),ngon(0.08,1.3,5)],"kuroki",T2)
    ico(m,0,0,1.85,1.0,0.95,0.75,T2); ico(m,0.45,0.25,1.5,0.6,0.55,0.45,T2)
for u,v,s in [(9.6,3.4,1.0),(8.2,5.2,0.9),(10.8,-2.2,0.85),(6.0,-6.6,0.85),(10.2,4.8,0.8),(4.8,-6.0,0.8)]:
    x,y=to_xy(u,v)
    if inside(x,y,1.0): maple(x,y,s)

def ground_at(x,y): return 0.0
INTERACT=tuple(xf([(0.0,-2.8,0.0)],**T)[0][:2])   # before the black torii
STAND=tuple(xf([(1.0,-3.6,0.0)],**T)[0][:2])

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/arashiyama.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/arashiyama.json"
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
    objname=key if key.startswith("glow_") else "arashiyama_"+key
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
