# Ginkaku-ji (the Silver Pavilion over its pond, the raked sea of silver sand and the moon-viewing cone, the hedged approach) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python ginkaku-ji.py
# Rebuilds content/landmarks/ginkaku-ji.blend and public/models/landmarks/ginkaku-ji.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/ginkaku-ji.glb"
BLEND=ROOT+"/content/landmarks/ginkaku-ji.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"sand":"e8e4da","darkwood":"3d3028","white":"efeae0","shingle":"4a443e","bronze":"9a7a40","water":"5f8f86","rock":"8d8a82","moss":"6f9a3a","pine":"3a5e36","leaf":"4f7a45","bark":"4e3a30","glow_cream":"e8dcb0"}
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
rng=random.Random(40)
EXTRA_SOLIDS=[]; NOSOLID={"pine","leaf","moss"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, a temple garden with its hills behind
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0

# ---- the sea of silver sand (Ginshadan), raked in ridges, and the moon-viewing cone (Kogetsudai) beside it
GX0,GX1,GY0,GY1=-6.4,-0.4,-5.6,-0.8; GZ=0.45
box("sand",(GX0+GX1)/2,(GY0+GY1)/2,-0.05,GZ,(GX1-GX0)/2,(GY1-GY0)/2)
y=GY0+0.3
while y<GY1-0.2:
    extrude_x("sand",[(y-0.13,GZ),(y,GZ+0.07),(y+0.13,GZ)],GX0+0.25,GX1-0.25); y+=0.42
CX,CY=-1.7,1.0
solid([ngon(1.25,-0.05,20,0,CX,CY),ngon(0.82,1.1,20,0,CX,CY)],"sand")
for r in (0.55,0.3): solid([ngon(r+0.06,1.1,16,0,CX,CY),ngon(r,1.15,16,0,CX,CY)],"sand")

# ---- the pond (Kinkyochi), rimmed with stones, a slab bridge across its waist
PCX,PCY=3.3,-0.1
def pr(a): return 2.5+0.45*math.sin(3*a+0.4)+0.25*math.cos(2*a)
NP=24
ring=[(PCX+pr(2*math.pi*k/NP)*math.cos(2*math.pi*k/NP),PCY+0.8*pr(2*math.pi*k/NP)*math.sin(2*math.pi*k/NP)) for k in range(NP)]
emit([(x,y,0.03) for x,y in ring]+[(PCX,PCY,0.03)],[[k,(k+1)%NP,NP] for k in range(NP)],["water"]*NP)
def in_pond(x,y,m=0.0):
    a=math.atan2((y-PCY)/0.8,x-PCX); r=math.hypot(x-PCX,(y-PCY)/0.8); return r<pr(a)-m
for k in range(NP):
    a=2*math.pi*(k+0.5)/NP; r=pr(a)+0.1
    ico("rock",PCX+r*math.cos(a),PCY+0.8*r*math.sin(a),0.02,rng.uniform(0.28,0.45),rng.uniform(0.25,0.4),rng.uniform(0.18,0.3))
for x,y,r in [(PCX+0.6,PCY+0.6,0.5),(PCX-1.0,PCY-0.5,0.4),(PCX+1.3,PCY-0.7,0.35)]:
    ico("rock",x,y,0.0,r,r*0.8,r*0.9); ico("moss",x,y+0.05,r*0.65,r*0.7,r*0.55,r*0.25)
box("rock",PCX-0.1,PCY+0.3,0.0,0.16,0.3,1.3)
def on_bridge(x,y): return abs(x-(PCX-0.1))<0.3 and abs(y-(PCY+0.3))<1.3
def water_disc(x,y): return in_pond(x,y,0.15) and not on_bridge(x,y)

# ---- the Kannon-den, the Silver Pavilion: a shoin storey of dark timber and white shoji, a Zen storey above with
# bell-shaped windows, cypress-bark roofs, a bronze phoenix on the peak
KX,KY=3.7,4.5
N0={m:len(v[0]) for m,v in B.items()}
box("rock",KX,KY,-0.05,0.18,1.65,1.35)
box("darkwood",KX,KY,0.3,0.36,1.55,1.25)                     # the veranda
box("darkwood",KX,KY+0.1,0.36,1.45,1.3,1.0)
for x in (-1.0,-0.35,0.35,1.0): box("white",KX+x,KY-0.91,0.5,1.3,0.28,0.01)
for y in (-0.55,0.1,0.75): box("white",KX+1.31,KY+y,0.5,1.3,0.01,0.26)
for x in (-1.3,-0.65,0.0,0.65,1.3): box("darkwood",KX+x,KY-0.92,0.36,1.45,0.04,0.02)
for x in (-1.5,1.5):
    for y in (-1.2,1.2): box("darkwood",KX+x,KY+y,0.18,1.45,0.05,0.05)
flared_roof([(1.85,1.55,1.45,0.14),(1.85,1.55,1.53,0.14),(1.25,1.0,1.72,0.04),(1.0,0.82,1.8,0.0)],"shingle",KX,KY)
box("darkwood",KX,KY,1.8,1.88,1.12,0.95)                      # the upper balcony
for k in range(8):
    t=-1.05+0.3*k; box("darkwood",KX+t,KY-0.92,1.88,2.12,0.025,0.025); box("darkwood",KX+1.1,KY-0.9+0.26*k,1.88,2.12,0.025,0.025)
box("darkwood",KX,KY-0.92,2.08,2.13,1.1,0.03); box("darkwood",KX+1.1,KY,2.08,2.13,0.03,0.93)
box("darkwood",KX,KY,1.88,2.72,0.88,0.72)
for x in (-0.42,0.42):
    box("white",KX+x,KY-0.73,2.05,2.4,0.16,0.01); extrude_y("white",[(KX+x-0.16,2.4),(KX+x+0.16,2.4),(KX+x,2.56)],KY-0.735,KY-0.725)
for y in (-0.3,0.3):
    box("white",KX+0.89,KY+y,2.05,2.4,0.01,0.16); extrude_x("white",[(KY+y-0.16,2.4),(KY+y+0.16,2.4),(KY+y,2.56)],KX+0.885,KX+0.895)
flared_roof([(1.3,1.15,2.72,0.2),(1.3,1.15,2.82,0.2),(0.85,0.75,3.12,0.04),(0.06,0.06,3.75,0.0)],"shingle",KX,KY)
prism("bronze",KX,KY,3.7,3.95,0.09,0.06,6)
extrude_y("bronze",[(KX-0.22,3.95),(KX+0.05,3.92),(KX+0.24,4.2),(KX+0.1,4.06),(KX-0.05,4.25),(KX-0.12,4.05)],KY-0.04,KY+0.04)

for m,(bv,bf) in B.items():                                  # drawn at 4/5 scale above, then enlarged about its centre
    for i in range(N0.get(m,0),len(bv)):
        x,y,z=bv[i]; bv[i]=(KX+1.22*(x-KX),KY+1.22*(y-KY),1.22*z if z>0 else z)

# ---- the main hall (Hondo) behind the sand: white shoji under a broad grey roof
HX,HY=-3.6,4.4
box("rock",HX,HY,-0.05,0.25,2.9,1.9)
box("darkwood",HX,HY,0.25,0.32,2.75,1.75)
box("darkwood",HX,HY+0.15,0.32,1.5,2.5,1.45)
for k in range(8): box("white",HX-2.15+0.615*k,HY-1.31,0.42,1.38,0.27,0.01)
for k in range(9): box("darkwood",HX-2.45+0.613*k,HY-1.32,0.32,1.5,0.04,0.02)
flared_roof([(3.25,2.25,1.5,0.18),(3.25,2.25,1.6,0.18),(2.3,1.3,2.35,0.04),(1.9,0.15,3.0,0.0)],"shingle",HX,HY)

# ---- the approach between tall clipped hedges on stone footings, stone lanterns, moss, pines, the hills behind
for x in (6.6,8.8):
    box("rock",x,-8.0,-0.05,0.35,0.3,2.8); box("pine",x,-8.0,0.35,1.9,0.28,2.75)
box("sand",7.7,-8.0,-0.04,0.03,0.85,3.2)
box("sand",4.4,-4.4,-0.04,0.03,4.2,0.6)
for k,(x,y) in enumerate(((0.6,-3.1),(5.6,-2.4),(-0.2,2.8))):
    prism("rock",x,y,-0.05,0.45,0.12,0.09,6); box("rock",x,y,0.45,0.5,0.2,0.2)
    box("glow_lantern_%d"%k,x,y,0.5,0.72,0.12,0.12); flared_roof([(0.26,0.26,0.72,0.04),(0.26,0.26,0.77,0.04),(0.03,0.03,0.97,0.0)],"rock",x,y)
for k in range(16):
    while True:
        x,y=rng.uniform(-9.5,9.5),rng.uniform(-9.5,8.0)
        if GX0-0.5<x<GX1+0.5 and GY0-0.5<y<GY1+0.5: continue
        if in_pond(x,y,-0.6) or math.hypot(x-CX,y-CY)<1.8 or (abs(x-KX)<2.6 and abs(y-KY)<2.2) or (abs(x-HX)<3.4 and abs(y-HY)<2.4): continue
        if 5.8<x<9.6 and y<-4.8: continue
        break
    r=rng.uniform(0.7,1.4); ico("moss",x,y,-0.12,r,r*0.8,0.24)
def pine(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.13,-0.3,5),ngon(0.09,1.4,5,0,0.35,0.1)],"bark",T)
    for zc,r,dx,dy in ((1.75,1.0,0.35,0.1),(1.3,0.75,-0.4,0.3),(2.1,0.6,0.7,-0.2)): ico("pine",dx,dy,zc,r,r*0.9,r*0.38,T)
def tree(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.15,-0.3,5),ngon(0.1,1.9,5)],"bark",T)
    ico("leaf",0,0,2.6,1.3,1.2,1.1,T); ico("leaf",0.6,0.4,2.1,0.8,0.75,0.65,T)
for x,y,s in [(6.2,1.2,1.0),(0.8,1.6,0.9),(5.8,-2.0,0.85),(1.4,-2.6,0.8),(6.8,6.6,0.95),(-6.8,1.4,0.9),(-7.6,-2.6,0.9)]:
    pine(x,y,s)
for x,y,s in [(-8.6,7.6,1.1),(-5.2,8.4,1.15),(-1.6,8.6,1.1),(1.8,8.4,1.2),(5.2,8.6,1.1),(8.4,7.8,1.05),(-9.0,4.4,1.0),(9.0,3.8,1.0),
              (-3.4,9.4,1.0),(3.6,9.6,1.0),(-7.4,9.4,0.9),(7.0,9.6,0.95)]:
    tree(x,y,s)

def ground_at(x,y):
    if on_bridge(x,y): return 0.16
    return 0.0
INTERACT=(0.8,-1.4)   # between the silver sand and the pond, the pavilion across the water
STAND=(2.4,-3.4)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/ginkaku-ji.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/ginkaku-ji.json"
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
    objname=key if key.startswith("glow_") else "ginkaku_"+key
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
