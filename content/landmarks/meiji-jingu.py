# Meiji Jingu (the great cypress torii on the gravel approach through the planted forest, the walls of sake casks and wine barrels, the south gate beyond) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python meiji-jingu.py
# Rebuilds content/landmarks/meiji-jingu.blend and public/models/landmarks/meiji-jingu.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/meiji-jingu.glb"
BLEND=ROOT+"/content/landmarks/meiji-jingu.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"wood":"8a7a66","stone":"8f8b84","pave":"cdc8bc","gold":"d9b04a","barrel":"efeae0","label":"c4402f","bark":"4e3a30","leaf":"3f6a3a","leaf2":"557f45","roof":"6f9a8a","glow_cream":"e8dcb0"}
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
rng=random.Random(35)
EXTRA_SOLIDS=[]; NOSOLID={"leaf","leaf2"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the approach through the forest with its torii
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0
def water_disc(x,y): return False
S2=math.sqrt(0.5)
def to_xy(u,v): return (S2*(u+v),S2*(v-u))     # u toward the camera, v screen-right
def to_uv(x,y): return (S2*(x-y),S2*(x+y))
def inside(x,y,m=0.0): return abs(x)<=FH-m and abs(y)<=FH-m
def frame(u,v): x,y=to_xy(u,v); return dict(cx=x,cy=y,rot=math.pi/4)   # local x = v, local -y = toward the camera

def tube(mat,pts,rs,n=8):
    rings=[]
    for k,p in enumerate(pts):
        a=pts[max(k-1,0)]; b=pts[min(k+1,len(pts)-1)]
        d=Vector(b)-Vector(a); d.normalize()
        u=d.cross(Vector((0,0,1))) if abs(d.z)<0.95 else d.cross(Vector((1,0,0)))
        u.normalize(); w=d.cross(u)
        rings.append([tuple(Vector(p)+rs[k]*(math.cos(2*math.pi*i/n)*u+math.sin(2*math.pi*i/n)*w)) for i in range(n)])
    solid(rings,mat)

# ---- the approach: a broad gravel way running straight away from the camera, kerbed with stone
PW=1.6
def band(mat,v0,v1,z,u0=-15.8,u1=15.8):
    pts=[to_xy(u0,v0),to_xy(u0,v1),to_xy(u1,v1),to_xy(u1,v0)]
    # clip to the footprint by shortening along u
    while not all(inside(*p,0.05) for p in pts[:2]): u0+=0.1; pts[0]=to_xy(u0,v0); pts[1]=to_xy(u0,v1)
    while not all(inside(*p,0.05) for p in pts[2:]): u1-=0.1; pts[2]=to_xy(u1,v1); pts[3]=to_xy(u1,v0)
    emit([(*p,z) for p in pts],[[0,1,2,3]],[mat])
band("pave",-PW,PW,0.03)
for sd in (-1,1): band("stone",sd*PW,sd*(PW+0.18),0.07)

# ---- the great torii (Otorii): unpainted cypress gone silver-brown, myojin-style with the lintel's ends lifted,
# three gilt chrysanthemum crests across its face, its posts on stone bases
TU=1.4; T=frame(TU,0.0)
H=7.0; SP=2.75
for sx in (-1,1):
    solid([ngon(0.62,-0.05,10,0,sx*SP,0),ngon(0.55,0.35,10,0,sx*SP,0)],"stone",T)
    solid([ngon(0.4,0.3,12,0,sx*SP,0),ngon(0.35,H,12,0,sx*(SP-0.14),0)],"wood",T)
def lift(x,L,a): return a*(abs(x)/L)**2.6
L=5.2; prof=[(x,H+0.45+lift(x,L,0.32)) for x in [-L+2*L*k/12 for k in range(13)]]
prof=prof+[(x,z+0.5) for x,z in reversed(prof)]
extrude_y("wood",[(x,z-0.45) for x,z in prof[:13]]+[(x,z-0.45) for x,z in prof[13:]],-0.36,0.36,T)
extrude_y("wood",[(-4.7,H+0.05),(4.7,H+0.05),(4.7,H+0.45),(-4.7,H+0.45)],-0.3,0.3,T)       # shimaki
extrude_y("wood",[(-4.0,H-1.45),(4.0,H-1.45),(4.0,H-1.05),(-4.0,H-1.05)],-0.24,0.24,T)        # nuki
box("wood",0,0,H-1.05,H+0.05,0.34,0.22,T)                                                      # gakuzuka
for x in (-SP+0.1,0.0,SP-0.1):
    p=xf([(x,-0.37,H+0.47)],**T)[0]
    tube("gold",[(p[0]+0.02*S2,p[1]-0.02*S2,p[2]),(p[0]-0.04*S2,p[1]+0.04*S2,p[2])],[0.22,0.22],12)

# ---- the walls of sake casks and of Burgundy wine barrels given to the shrine, facing each other across the way
def cask_wall(v0,v1,u,rows,mat,band_mat,label=None):
    n=int(abs(v1-v0)/0.62); vs=min(v0,v1)
    T2=frame(u,(v0+v1)/2)
    box("bark",0,0,-0.05,0.22,abs(v1-v0)/2+0.1,0.45,T2)
    for r in range(rows):
        for k in range(n-(r%2)):
            v=vs+0.31+0.62*k+0.31*(r%2); z=0.5+0.56*r
            a=to_xy(u-0.42,v); b=to_xy(u+0.42,v)
            tube(mat,[(a[0],a[1],z),(b[0],b[1],z)],[0.28,0.28],8)
            if label:
                c=to_xy(u+0.43,v); box(label,c[0],c[1],z-0.13,z+0.13,0.08,0.08)
            for q in (-0.3,0.3):
                d=to_xy(u+q,v); e=to_xy(u+q+0.06,v)
                tube(band_mat,[(d[0],d[1],z),(e[0],e[1],z)],[0.295,0.295],8)
cask_wall(PW+0.9,PW+5.3,5.6,3,"barrel","bark","label")      # sake casks, their faces turned to the approach
cask_wall(-PW-0.9,-PW-4.6,5.6,2,"wood","bark")              # Burgundy barrels opposite

# ---- the forest planted by the nation: camphors, oaks and evergreens, tall and close on either side
def big(x,y,s,m):
    T2=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    tube("bark",[(x,y,-0.3),(x+0.1*s,y,2.6*s),(x-0.1*s,y+0.1*s,4.6*s)],[0.34*s,0.27*s,0.18*s],6)
    ico(m,0,0,6.0,1.8,1.65,1.4,T2); ico(m,1.0,0.5,5.0,1.2,1.1,0.9,T2); ico(m,-0.8,-0.5,6.9,1.1,1.0,0.9,T2)
pts=[]
for _ in range(3000):
    x,y=rng.uniform(-FH+2.6,FH-2.6),rng.uniform(-FH+2.6,FH-2.6)
    u,v=to_uv(x,y)
    if abs(v)<PW+2.3: continue
    if u>3.6 and abs(v)<7.4: continue
    if any((x-px)**2+(y-py)**2<2.3**2 for px,py in pts): continue
    pts.append((x,y))
    if len(pts)>=32: break
for k,(x,y) in enumerate(pts):
    u,v=to_uv(x,y)
    big(x,y,rng.uniform(0.95,1.15),"leaf" if k%3 else "leaf2")
for u,v,s in [(9.0,3.4,1.0),(8.6,-3.6,0.9),(10.6,2.6,0.8),(10.2,-2.4,0.85),(7.2,6.0,0.9),(7.0,-6.2,0.9)]:
    x,y=to_xy(u,v)
    if inside(x,y,1.0): ico("leaf2",x,y,0.4,1.0*s,0.9*s,0.65*s); ico("leaf2",x+0.5,y+0.3,0.3,0.7*s,0.6*s,0.45*s)

# ---- at the far end, the south gate (Minami-shinmon): bare timber under green copper, lanterns hung in it
GU=-9.6; T3=frame(GU,0.0)
box("stone",0,0,-0.05,0.25,2.6,1.2,T3)
for x in (-2.2,-0.75,0.75,2.2):
    for y in (-0.8,0.8): box("wood",x,y,0.25,2.4,0.13,0.13,T3)
for sx in (-1,1): box("wood",sx*1.48,0,0.25,2.3,0.62,0.8,T3)
box("wood",0,0,2.2,2.5,2.4,0.95,T3)
nb=len(B.get("roof",([],[]))[0])
flared_roof([(3.2,1.7,2.5,0.25),(3.2,1.7,2.6,0.25),(2.2,0.7,3.2,0.06),(1.9,0.12,3.7,0.0)],"roof",0,0)
bv=B["roof"][0]
for i in range(nb,len(bv)):
    x,y,z=bv[i]; bv[i]=(*xf([(x,y,z)],**T3)[0][:2],z)
for sx in (-1,1): box("glow_lantern_%d"%(sx+1),sx*0.4,-0.82,1.5,1.95,0.14,0.14,T3)

def ground_at(x,y): return 0.0
INTERACT=to_xy(TU+1.6,0.0)   # on the gravel before the torii
STAND=to_xy(TU+2.6,0.7)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/meiji-jingu.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/meiji-jingu.json"
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
    objname=key if key.startswith("glow_") else "meiji_"+key
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
