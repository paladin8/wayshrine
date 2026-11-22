# Mount Fuji, seen past the Chureito pagoda (the snow-capped cone, the vermilion pagoda on its hill, cherry blossom) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python mount-fuji.py
# Rebuilds content/landmarks/mount-fuji.blend and public/models/landmarks/mount-fuji.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/mount-fuji.glb"
BLEND=ROOT+"/content/landmarks/mount-fuji.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"fuji":"5f6878","hill":"6f8a50","snow":"f2f5f5","greige":"8d837b","slate":"837d77","vermilion":"d96b59","roof":"3a3634","blossom":"f2b6c4","foliage":"779555","bark":"4e3a30","glow_cream":"e8dcb0"}
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
rng=random.Random(14)
H=lambda x,y: 0.0   # the game's terrain draws the mountain ground (terrainSurface)
EXTRA_SOLIDS=[]
FH=16.8   # footprint half-width (the sidecar's half): Fuji is huge
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)

# ---- Mount Fuji: a concave cone, gentle in its wide skirt and steep toward the top, the summit cut off at the
# crater; snow on the upper slopes reaching down the gullies in a ragged line
FX,FY=-3.2,3.2; FR=12.4; FHT=8.2   # wide, with a smooth gradual slope, like the real mountain
NA=28; NK=12
def fuji_r(z,a):
    t=min(1.0,z/(FHT*0.95))
    ridge=1.0+0.035*math.sin(9*a+1.2)*(1-t)+0.02*math.sin(17*a)                # gullies down the flanks
    return (1.4+(FR-1.4)*(1.0-t)**1.25)*ridge                                 # a smooth, gradual cone, only slightly concave, truncated at the rim
def snowline(a):
    return FHT*(0.5+0.06*math.sin(5*a+0.8)+0.05*math.sin(11*a+2.1)+0.035*math.sin(23*a))
levels=[FHT*(k/NK)**0.85*0.95 for k in range(NK+1)]
verts=[]; faces=[]; mats=[]
for k,z in enumerate(levels):
    for i in range(NA):
        a=2*math.pi*i/NA; r=fuji_r(z,a)
        verts.append((FX+r*math.cos(a),FY+r*math.sin(a),z-(0.25 if k==0 else 0.0)))
for k in range(NK):
    for i in range(NA):
        j=(i+1)%NA; a=2*math.pi*(i+0.5)/NA
        q=[k*NA+i,k*NA+j,(k+1)*NA+j,(k+1)*NA+i]
        zm=(levels[k]+levels[k+1])/2
        faces+=[[q[0],q[1],q[2]],[q[0],q[2],q[3]]]
        m="snow" if zm>snowline(a) else "fuji"
        mats+=[m,m]
# the crater: the summit ring dips into a shallow bowl
top=NK*NA; c=len(verts); verts.append((FX,FY,levels[-1]-0.3))
for i in range(NA):
    faces.append([top+i,top+(i+1)%NA,c]); mats.append("snow")
emit(verts,faces,mats)

# ---- the Chureito pagoda on its hill: five vermilion storeys under dark roofs, steps climbing to it from a torii
HX,HY=8.0,-6.0
def mound(cx,cy,R,Hm,n=14):
    rings=[]
    for z,r in [(-0.2,1.0),(0.25*Hm,0.92),(0.6*Hm,0.75),(0.88*Hm,0.55),(Hm,0.42)]:
        rings.append([(cx+R*r*rng.uniform(0.93,1.07)*math.cos(2*math.pi*i/n),cy+R*r*rng.uniform(0.93,1.07)*math.sin(2*math.pi*i/n),z) for i in range(n)])
    solid(rings,"hill",mt="foliage")
HM=1.8
mound(HX,HY,5.0,HM)
PX,PY=HX+0.2,HY+0.5; PZ=HM; PS=0.85   # the pagoda kept below Fuji's summit
box("slate",PX,PY,PZ-0.2,PZ+0.22,1.2*PS,1.2*PS)
z=PZ+0.22
for i in range(5):
    b=(0.78-0.07*i)*PS; r=(1.18-0.1*i)*PS
    box("vermilion",PX,PY,z,z+0.78*PS,b,b)
    flared_roof([(r,r,z+0.78*PS,0.2*PS),(r,r,z+0.86*PS,0.2*PS),(b*0.7+0.18*PS,b*0.7+0.18*PS,z+1.04*PS,0.05*PS),(b-0.12*PS,b-0.12*PS,z+1.12*PS,0.0)],"roof",PX,PY)
    z+=1.06*PS
prism("roof",PX,PY,z+0.05,z+1.35*PS,0.05,0.04,6,0)
for k in range(5): prism("roof",PX,PY,z+0.3*PS+k*0.18*PS,z+0.33*PS+k*0.18*PS,(0.16-0.012*k)*PS,(0.16-0.012*k)*PS,8,0)
# stairs down the front of the hill to a torii
SX0,SY0=HX+0.9,HY-1.6; SX1,SY1=HX+1.5,HY-4.6
for k in range(9):
    t=k/8; x=SX0+(SX1-SX0)*t; y=SY0+(SY1-SY0)*t; zt=HM*(1-t)**1.15
    box("slate",x,y,-0.05,zt+0.05,0.55,0.32,dict(rot=math.atan2(SY1-SY0,SX1-SX0)+math.pi/2))
TX,TY=SX1+0.15,SY1-0.8
T=dict(cx=TX,cy=TY,rot=math.atan2(SY1-SY0,SX1-SX0)+math.pi/2,s=0.75)
for sx in (-1,1): prism("vermilion",sx*0.9,0,-0.1,2.2,0.11,0.1,6,0,T)
box("vermilion",0,0,1.75,1.9,1.12,0.07,T)
box("roof",0,0,2.15,2.3,1.22,0.11,T)
extrude_y("roof",[(-1.32,2.3),(1.32,2.3),(1.5,2.52),(0.7,2.44),(-0.7,2.44),(-1.5,2.52)],-0.14,0.14,T)
for sx in (-1,1):
    box("slate",TX+sx*1.4,TY-0.4,-0.05,0.18,0.28,0.28)
    box("glow_lantern_%d"%(1 if sx<0 else 2),TX+sx*1.4,TY-0.4,0.18,0.62,0.13,0.13)
    box("slate",TX+sx*1.4,TY-0.4,0.62,0.72,0.24,0.24)

# ---- cherry trees in blossom round the pagoda and the approach; pines and slate rocks on the mountain ground
def sakura(cx,cy,s,z=0.0):
    T=dict(cx=cx,cy=cy,cz=z,s=s)
    solid([ngon(0.17,-0.3,6),ngon(0.13,1.0,6,0,0.15,0),ngon(0.09,1.5,6,0,0.05,0.1)],"bark",T)
    ico("blossom",0,0,1.95,1.25,1.15,0.85,T)
    ico("blossom",0.65,0.35,1.55,0.75,0.7,0.55,T)
    ico("blossom",-0.6,-0.3,1.6,0.7,0.65,0.5,T)
for a in [(6.8,-4.8,0.9,0.4),(10.6,-4.0,0.95,1.0),(10.2,-8.8,0.9,0.7),(6.0,-8.4,0.85,0.5),(12.8,-10.0,1.0,0.0),(3.6,-10.2,0.95,0.0),(12.4,-13.8,0.9,0.0),(0.0,-12.8,0.95,0.0),(8.6,-13.4,0.9,0.0)]:
    sakura(*a)
def pine(cx,cy,s):
    T=dict(cx=cx,cy=cy,cz=0.0,s=s)
    prism("bark",0,0,-0.3,0.9,0.2,0.18,6,0,T)
    cone("foliage",ngon(1.05,0.7,7,0),(0,0,2.2),T)
    cone("foliage",ngon(0.82,1.5,7,0.4),(0,0,2.9),T)
    cone("foliage",ngon(0.56,2.2,7,0.8),(0,0,3.55),T)
for a in [(-14.8,-7.0,0.95),(-11.6,-11.8,0.9),(-6.4,-14.2,0.85),(14.8,2.4,0.9),(15.2,8.8,0.85),(-15.8,-3.0,0.85),(13.6,14.4,0.9),(-1.6,-15.6,0.85),(15.4,-4.0,0.9)]: pine(*a)
def slate(cx,cy,s):
    T=dict(cx=cx,cy=cy,rot=rng.uniform(0,6.28),s=s)
    ico("slate",0,0,0.3,0.75,0.5,0.4,T); ico("greige",0.25,0.1,0.55,0.4,0.3,0.3,T)
for a in [(-8.8,-8.4,1.2),(-4.0,-9.6,1.0),(1.8,-10.4,0.9),(-13.6,-6.0,1.1),(13.6,-6.8,1.0),(-10.4,-14.6,0.9),(4.0,-15.2,1.0)]: slate(*a)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/mount-fuji.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=FH; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y): return 0.0     # the mountain and the pagoda hill are solid, not walkable; the game draws the ground
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
INTERACT=(9.6,-12.2)  # the torii at the foot of the pagoda stairs
STAND=(7.0,-14.4)     # the approach to the torii
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]],"terrainSurface":True}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/mount-fuji.json"
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
    objname=key if key.startswith("glow_") else "fuji_"+key
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
