# Ryoan-ji (the rock garden: fifteen stones on moss in raked white gravel, the oiled earthen walls, the hojo veranda, a weeping cherry) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python ryoan-ji.py
# Rebuilds content/landmarks/ryoan-ji.blend and public/models/landmarks/ryoan-ji.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/ryoan-ji.glb"
BLEND=ROOT+"/content/landmarks/ryoan-ji.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"gravel":"dcd8ce","moss":"6f9a3a","rock":"6e6a62","wall":"b08a5c","wallstain":"8c6a44","tile":"5d5f60","wood":"8a6a4a","darkwood":"3d3028","white":"efeae0","leaf":"4f7a45","blossom":"efc2cf","bark":"4e3a30"}
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
rng=random.Random(41)
EXTRA_SOLIDS=[]; NOSOLID={"leaf","blossom","moss"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the dry garden with its hall and the trees beyond
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0
def water_disc(x,y): return False
S2=math.sqrt(0.5)
def to_xy(u,v): return (S2*(u+v),S2*(v-u))     # u toward the camera, v screen-right
def to_uv(x,y): return (S2*(x-y),S2*(x+y))
ROT=math.pi/4
def F(u,v,rot=ROT): x,y=to_xy(u,v); return dict(cx=x,cy=y,rot=rot)   # local x along v, local -y toward the camera
def quad(mat,pts,z): emit([(*to_xy(u,v),z) for u,v in pts],[[0,1,2,3]],[mat])

# ---- the garden: a long rectangle of white gravel, fifteen stones in five groups on moss, the gravel raked in
# rings round each group and in straight lines along its length; walls of oiled earth behind and to the left
U0,U1,V0,V1=-2.6,2.6,-6.6,6.6; GZ=0.1
box("gravel",0,0,-0.05,GZ,(V1-V0)/2,(U1-U0)/2,F(0,0))
GROUPS=[((-0.5,-4.6),5,1.25),((-1.5,-1.8),2,0.85),((0.6,0.3),3,1.05),((-1.2,2.6),2,0.85),((-0.2,4.8),3,1.05)]
def ridge_ring(u,v,R,w=0.1,h=0.055,n=22):
    vs=[];fs=[]
    for k in range(n):
        a=2*math.pi*k/n; ca,sa=math.cos(a),math.sin(a)
        for rr,z in ((R-w,GZ),(R,GZ+h),(R+w,GZ)): vs.append((*to_xy(u+rr*ca,v+rr*sa),z))
    for k in range(n):
        a,b=3*k,3*((k+1)%n)
        fs+=[[a,b,b+1,a+1],[a+1,b+1,b+2,a+2]]
    emit(vs,fs,["gravel"]*len(fs))
for (u,v),n,R in GROUPS:
    for k in range(3): ridge_ring(u,v,R+0.3*k)
uu=U0+0.25
while uu<U1-0.15:                                            # straight raking, broken where it meets the rings
    cuts=[]
    for (u,v),n,R in GROUPS:
        RR=R+0.75
        if abs(uu-u)<RR: dv=math.sqrt(RR*RR-(uu-u)**2); cuts.append((v-dv,v+dv))
    cuts.sort(); segs=[]; a=V0+0.2
    for c0,c1 in cuts:
        if c0>a: segs.append((a,c0))
        a=max(a,c1)
    if a<V1-0.2: segs.append((a,V1-0.2))
    for s0,s1 in segs:
        if s1-s0<0.2: continue
        p=[to_xy(uu-0.1,s0),to_xy(uu,s0),to_xy(uu+0.1,s0)]; q=[to_xy(uu-0.1,s1),to_xy(uu,s1),to_xy(uu+0.1,s1)]
        emit([(*p[0],GZ),(*p[1],GZ+0.055),(*p[2],GZ),(*q[0],GZ),(*q[1],GZ+0.055),(*q[2],GZ)],[[0,3,4,1],[1,4,5,2]],["gravel"]*2)
    uu+=0.3
for gi,((u,v),n,R) in enumerate(GROUPS):
    pts=[]
    for k in range(10):
        a=2*math.pi*k/10; r=R*0.78*(1+0.18*math.sin(3*a+gi))
        pts.append(to_xy(u+r*math.cos(a)*0.8,v+r*math.sin(a)))
    c=to_xy(u,v)
    emit([(x,y,GZ+0.04) for x,y in pts]+[(c[0],c[1],GZ+0.05)],[[k,(k+1)%10,10] for k in range(10)],["moss"]*10)
    for k in range(n):
        a=2*math.pi*k/max(1,n-1)+gi; r=0.0 if k==0 else R*0.55
        s=(0.55 if k==0 else rng.uniform(0.28,0.4))*(1.1 if gi==0 else 1.0)
        x,y=to_xy(u+r*math.cos(a)*0.75,v+r*math.sin(a))
        ico("rock",x,y,GZ+0.1*s,s*rng.uniform(0.9,1.3),s*rng.uniform(0.7,1.0),s*rng.uniform(0.45,0.8))
# the dark pebble gutter along the viewing side
quad("rock",[(U1,V0-0.1),(U1+0.3,V0-0.1),(U1+0.3,V1+0.2),(U1,V1+0.2)],0.06)
# the walls: earth, oil-stained, under small tiled roofs
def wall(u0,v0,u1,v1):
    L=math.hypot(u1-u0,v1-v0); cu,cv=(u0+u1)/2,(v0+v1)/2
    rot=ROT if abs(v1-v0)>abs(u1-u0) else ROT+math.pi/2
    T=F(cu,cv,rot)
    box("rock",0,0,-0.05,0.25,L/2,0.24,T); box("wall",0,0,0.25,1.55,L/2,0.18,T)
    for k in range(int(L/1.6)):
        box("wallstain",-L/2+0.8+1.6*k+rng.uniform(-0.3,0.3),-0.185,0.4,rng.uniform(0.9,1.4),rng.uniform(0.2,0.45),0.005,T)
    extrude_x("tile",[(-0.42,1.5),(0,1.82),(0.42,1.5),(0.36,1.46),(0,1.72),(-0.36,1.46)],-L/2-0.15,L/2+0.15,T)
wall(U0-0.3,V0-0.3,U0-0.3,V1+0.3); wall(U0-0.3,V0-0.3,U1+0.1,V0-0.3)

# ---- the hojo: its veranda runs along the viewing side and round its own front; white shoji, dark timber, a big
# grey roof
DZ=0.42
quad("wood",[(U1+0.3,V0),(U1+1.15,V0),(U1+1.15,V1+1.1),(U1+0.3,V1+1.1)],DZ)
for k in range(15):
    v=V0+0.2+(V1+0.9-V0)*k/14
    for u in (U1+0.38,U1+1.07): x,y=to_xy(u,v); box("darkwood",x,y,-0.05,DZ,0.05,0.05)
for k in range(3):
    quad("wood",[(U1+0.3,V0-0.3*(k+1)),(U1+1.15,V0-0.3*(k+1)),(U1+1.15,V0-0.3*k),(U1+0.3,V0-0.3*k)],DZ*(2-k)/3)
HU0,HU1,HV0,HV1=-3.4,U1+1.15,V1+1.1,V1+3.6
quad("wood",[(HU0,HV0-0.85),(HU1,HV0-0.85),(HU1,HV0),(HU0,HV0)],DZ)
T=F((HU0+HU1)/2,(HV0+HV1)/2,ROT+math.pi/2)                 # local x along u, local -y toward -v (the garden)
LH,WH=(HU1-HU0)/2,(HV1-HV0)/2
box("rock",0,0,-0.05,DZ-0.05,LH,WH,T)
box("darkwood",0,0,DZ,DZ+1.5,LH-0.1,WH-0.1,T)
for k in range(9): box("white",-LH+0.55+(2*LH-1.1)*k/8,-WH+0.08,DZ+0.15,DZ+1.35,0.3,0.01,T)
nb=len(B.get("tile",([],[]))[0])
flared_roof([(LH+0.6,WH+0.6,DZ+1.5,0.18),(LH+0.6,WH+0.6,DZ+1.6,0.18),(LH*0.75,WH*0.5,DZ+2.3,0.04),(LH*0.6,0.12,DZ+2.8,0.0)],"tile",0,0)
bv=B["tile"][0]
for i in range(nb,len(bv)):
    x,y,z=bv[i]; bv[i]=(*xf([(x,y,z)],**T)[0][:2],z)

# ---- beyond the walls: a weeping cherry, maples, pines, tall trees
def tree(u,v,s,m):
    x,y=to_xy(u,v); T2=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.15,-0.3,5),ngon(0.1,2.0,5)],"bark",T2)
    ico(m,0,0,2.8,1.35,1.25,1.05,T2); ico(m,0.65,0.4,2.25,0.85,0.8,0.65,T2)
def weeping(u,v,s):
    x,y=to_xy(u,v); T2=dict(cx=x,cy=y,s=s,rot=0)
    solid([ngon(0.17,-0.3,6),ngon(0.11,2.6,6)],"bark",T2)
    ico("blossom",0,0,2.95,1.35,1.35,0.75,T2)
    for k in range(8):
        a=2*math.pi*k/8+0.2; ico("blossom",1.15*math.cos(a),1.15*math.sin(a),2.1,0.55,0.55,0.95,T2)
weeping(-4.4,-5.4,1.1)
for u,v,s,m in [(-4.6,-1.8,1.1,"leaf"),(-4.4,1.8,1.15,"leaf"),(-4.8,5.0,1.1,"leaf"),(-7.2,-3.6,1.2,"leaf"),(-7.4,0.6,1.2,"leaf"),
                (-7.0,4.4,1.15,"leaf"),(-2.6,-8.6,1.0,"leaf"),(1.0,-8.8,1.0,"leaf"),(-6.0,-7.6,1.0,"leaf"),(-6.4,6.8,1.0,"leaf"),(-9.4,-1.4,1.0,"leaf"),(-9.2,2.8,1.0,"leaf")]:
    tree(u,v,s,m)
for u,v in [(5.4,-5.2),(6.0,4.6),(7.2,-1.6),(4.8,-8.4)]:
    x,y=to_xy(u,v)
    if abs(x)<FH-1 and abs(y)<FH-1: ico("leaf",x,y,0.4,0.9,0.8,0.6); ico("leaf",x+0.4,y+0.2,0.3,0.6,0.55,0.4)

# keep the gravel unwalked: a line along its open sides
for k in range(28):
    v=V0+(V1-V0)*k/27; EXTRA_SOLIDS.append((*to_xy(U1-0.15,v),0.22))
for k in range(10):
    u=U0+(U1-U0)*k/9; EXTRA_SOLIDS.append((*to_xy(u,V1-0.1),0.22))
def on_deck(u,v): return (U1+0.3<=u<=U1+1.15 and V0<=v<=V1+1.1) or (HU0<=u<=HU1 and HV0-0.85<=v<=HV0)
def ground_at(x,y):
    u,v=to_uv(x,y)
    if on_deck(u,v): return DZ
    if U1+0.3<=u<=U1+1.15 and V0-0.9<=v<V0: return DZ*(v-(V0-0.9))/0.9
    return 0.0
def terrain_at(x,y): return 0.0                     # the veranda stands on posts over the ground
INTERACT=to_xy(U1+0.75,0.0)   # on the veranda, before the stones
STAND=to_xy(U1+2.2,0.8)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/ryoan-ji.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/ryoan-ji.json"
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
    objname=key if key.startswith("glow_") else "ryoan_"+key
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
