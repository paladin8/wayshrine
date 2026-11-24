# Biei Blue Pond landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python blue-pond.py
# Rebuilds content/landmarks/blue-pond.blend and public/models/landmarks/blue-pond.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/blue-pond.glb"
BLEND=ROOT+"/content/landmarks/blue-pond.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"snow":"eef2f4","water":"3fb4c2","ice":"d6eaee","deadwood":"cfc9bd","wood":"5e4632","iron":"2a2c30","fir":"2f4f3e","larch":"8a6e58","glow_cream":"e8dcb0"}
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
rng=random.Random(60)
EXTRA_SOLIDS=[]; NOSOLID={"fir","larch"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=9.6   # footprint half-width (the sidecar's half): a single feature, the pond and its drowned larches
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0

# ---- the pond: a long irregular basin, its milky turquoise water standing among dead larch trunks; a skin of ice
# along the margins. The banks fall gently to the water
PC=(0.0,0.9); PA,PB=5.8,3.1
def wob(t): return 1+0.08*math.sin(3*t+1.0)+0.05*math.sin(5*t+2.2)+0.03*math.sin(7*t+0.4)
def pf(x,y):
    dx,dy=(x-PC[0])/PA,(y-PC[1])/PB; t=math.atan2(dy,dx); return math.hypot(dx,dy)/wob(t)
PD=-0.65; WZ=-0.3
def G(x,y): return PD*(1-smooth(0.82,1.06,pf(x,y)))
def ring(f):
    P=[]
    for k in range(36):
        t=2*math.pi*k/36; w=wob(t); P.append((PC[0]+PA*f*w*math.cos(t),PC[1]+PB*f*w*math.sin(t)))
    return P
W=ring(1.0)
emit([(*p,WZ) for p in W]+[(PC[0],PC[1],WZ)],[[k,(k+1)%36,36] for k in range(36)],["water"]*36)
I0,I1=ring(0.86),ring(0.97)
for k in range(36):
    a,b,c,d=I0[k],I0[(k+1)%36],I1[(k+1)%36],I1[k]
    if math.sin(2.0*k)+0.4*math.sin(5.1*k)>-0.2:       # the ice is patchy
        emit([(*a,WZ+0.015),(*b,WZ+0.015),(*c,WZ+0.015),(*d,WZ+0.015)],[[0,1,2,3]],["ice"])

# the drowned larches: thin pale trunks, many leaning, some with broken stubs of branches
def trunk(x,y,h,r,lean,ph):
    z=G(x,y)-0.1; tx,ty=x+lean*math.cos(ph),y+lean*math.sin(ph)
    solid([ngon(r,z,5,ph,x,y),ngon(r*0.45,z+h,5,ph,tx,ty)],"deadwood")
    if rng.random()<0.6:
        k=rng.uniform(0.45,0.8); bx,by,bz=x+(tx-x)*k,y+(ty-y)*k,z+h*k; a=rng.uniform(0,6.28); L=rng.uniform(0.2,0.4)
        solid([ngon(r*0.4,bz,4,a,bx,by),ngon(r*0.18,bz+L*0.6,4,a,bx+L*math.cos(a),by+L*math.sin(a))],"deadwood")
n=0; pts=[]
while n<54:
    x,y=rng.uniform(-6.2,6.2),rng.uniform(-2.4,4.2)
    f=pf(x,y)
    if f>0.93 or any(math.hypot(x-px,y-py)<0.55 for px,py in pts): continue
    pts.append((x,y)); n+=1
    trunk(x,y,rng.uniform(1.1,2.7)*(0.75 if f>0.75 else 1.0),rng.uniform(0.05,0.08),rng.uniform(0.0,0.35),rng.uniform(0,6.28))
for k in range(5):                                     # fallen trunks lying in the shallows
    t=rng.uniform(0,6.28); x,y=PC[0]+PA*0.7*math.cos(t),PC[1]+PB*0.7*math.sin(t); a=rng.uniform(0,6.28); L=rng.uniform(0.8,1.4)
    p0=(x-L*math.cos(a)/2,y-L*math.sin(a)/2,WZ-0.03); p1=(x+L*math.cos(a)/2,y+L*math.sin(a)/2,WZ+0.02)
    nx,ny=-math.sin(a)*0.06,math.cos(a)*0.06
    solid([[(p0[0]+nx,p0[1]+ny,p0[2]-0.05),(p0[0]-nx,p0[1]-ny,p0[2]-0.05),(p0[0]-nx,p0[1]-ny,p0[2]+0.05),(p0[0]+nx,p0[1]+ny,p0[2]+0.05)],
           [(p1[0]+nx,p1[1]+ny,p1[2]-0.05),(p1[0]-nx,p1[1]-ny,p1[2]-0.05),(p1[0]-nx,p1[1]-ny,p1[2]+0.05),(p1[0]+nx,p1[1]+ny,p1[2]+0.05)]],"deadwood")

# ---- the viewing walk along the near shore: a low timber deck, railed toward the water, lamps for the winter
# night illumination
DX0,DX1,DY0,DY1,DZ=-3.4,3.4,-3.95,-2.75,0.22
def on_deck(x,y): return DX0<x<DX1 and DY0<y<DY1
box("wood",(DX0+DX1)/2,(DY0+DY1)/2,DZ-0.1,DZ,(DX1-DX0)/2,(DY1-DY0)/2)
for x in [DX0+0.2+k*(DX1-DX0-0.4)/6 for k in range(7)]:
    for y in (DY0+0.1,DY1-0.1): box("wood",x,y,G(x,y)-0.2,DZ-0.1,0.05,0.05)
    box("wood",x,DY1-0.04,DZ,DZ+0.55,0.04,0.04)
box("wood",(DX0+DX1)/2,DY1-0.04,DZ+0.5,DZ+0.58,(DX1-DX0)/2,0.04)
for x in (DX0,DX1):
    box("wood",x,(DY0+DY1)/2,DZ,DZ+0.55,0.04,0.04); box("wood",x,(DY0+DY1)/2+0.25,DZ+0.5,DZ+0.58,0.04,(DY1-DY0)/2-0.25)
for k,x in enumerate((-2.8,2.8)):
    y=DY0+0.12
    prism("iron",x,y,DZ,DZ+1.3,0.04,0.035,6); box("glow_lamps",x,y,DZ+1.3,DZ+1.52,0.08,0.08)
    frus("iron",x,y,DZ+1.52,DZ+1.62,0.11,0.11,0.02,0.02)

# ---- the forest: Todo firs under snow and bare winter larches, thick behind the pond, thinning toward the front
def fir(x,y,s):
    z=G(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.12,-0.3,5),ngon(0.08,0.8,5)],"wood",T)
    for zc,r,hh in ((0.6,0.7,1.1),(1.3,0.45,1.0)):
        cone("fir",ngon(r,zc,6,rng.uniform(0,1)),(0,0,zc+hh),T)
        cone("snow",ngon(r*0.55,zc+hh*0.45,6,0.3),(0,0,zc+hh+0.06),T)
def larch(x,y,s):
    z=G(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.09,-0.3,5),ngon(0.05,1.0,5)],"wood",T)
    cone("larch",ngon(0.5,0.7,6,rng.uniform(0,1)),(0,0,2.9),T)
tp=[]
def plant(x,y,s,kind):
    if abs(x)>FH-1.0 or abs(y)>FH-1.0 or pf(x,y)<1.18 or on_deck(x,y): return
    if any(math.hypot(x-px,y-py)<0.95*s for px,py in tp): return
    tp.append((x,y)); (fir if kind else larch)(x,y,s)
for k in range(260):
    x,y=rng.uniform(-8.6,8.6),rng.uniform(-8.6,8.6)
    dens=smooth(-3.5,4.5,y)*0.85+0.15*smooth(5.5,7.5,abs(x))
    if rng.random()>dens or len(tp)>=62: continue
    plant(x,y,rng.uniform(0.8,1.1),rng.random()<0.45)
for x,y,s in [(-7.6,-7.4,0.9),(7.4,-7.6,0.85),(-6.4,-4.6,0.8),(6.6,-5.0,0.8)]: plant(x,y,s,1)

def ground_at(x,y):
    if on_deck(x,y): return DZ
    return G(x,y)
def terrain_at(x,y): return G(x,y)
def water_disc(x,y): return pf(x,y)<0.95
INTERACT=(0.0,-3.15)   # on the viewing deck at the water's edge
STAND=(0.9,-3.6)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/blue-pond.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/blue-pond.json"
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
    objname=key if key.startswith("glow_") else "bluepond_"+key
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
