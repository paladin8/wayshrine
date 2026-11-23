# Nachi Falls (the waterfall dropping from columnar rock in the Kumano forest, Hiro shrine's torii, and Seiganto-ji's vermilion three-storey pagoda) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python nachi-falls.py
# Rebuilds content/landmarks/nachi-falls.blend and public/models/landmarks/nachi-falls.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/nachi-falls.glb"
BLEND=ROOT+"/content/landmarks/nachi-falls.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"red":"d65a2e","white":"eef0ec","roof":"5d6862","gold":"d9b04a","rock":"4a4c4e","water":"5f8f94","stone":"9a958c","forest":"3f6a3a","leaf":"5a8a48","wood":"8a6a50","bark":"4e3a30","glow_cream":"e8dcb0"}
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
rng=random.Random(34)
EXTRA_SOLIDS=[]; NOSOLID={"forest","leaf"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the pagoda's terrace with the falls behind
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0
S2=math.sqrt(0.5)
U=(S2,-S2); V=(S2,S2)                 # toward the camera, screen-right
def at(p,du=0.0,dv=0.0): return (p[0]+du*U[0]+dv*V[0],p[1]+du*U[1]+dv*V[1])

# ---- the falls: a white ribbon dropping 9 units from a wall of dark columnar rock, the forested mountain above
# and around it, a plunge pool at its foot behind a rim of boulders
F=(-2.4,7.4)
for row,(du,hs) in enumerate(((0.0,(6.8,8.6)),(-0.95,(8.2,10.0)))):
    for k in range(-9,6):
        t=k*0.62+rng.uniform(-0.1,0.1)
        if row==0 and abs(t)<0.5: continue                   # the notch the water has cut
        p=at(F,du+rng.uniform(-0.15,0.15),t)
        h=rng.uniform(*hs)*(1.0-0.035*abs(t))
        prism("rock",p[0],p[1],-0.2,h,0.42,0.38,6,rng.uniform(0,1))
for k in range(-5,3):
    p=at(F,-0.5,k*1.25); ico("forest",p[0],p[1],8.6-0.25*abs(k)+rng.uniform(0,0.5),1.2,1.1,0.8)
for c,r,z in [((-8.2,6.4),2.4,0.6),((-6.6,9.2),2.0,1.2),((-8.6,1.8),2.0,0.2),((3.2,9.2),2.0,1.0),((6.4,8.0),2.2,0.5),((-4.8,9.4),1.8,3.0)]:
    ico("forest",c[0],c[1],z,r,r*0.9,r*1.3)
W0=at(F,0.55)
emit([(*at(W0,0,-0.3),9.2),(*at(W0,0,0.3),9.2),(*at(W0,0.6,0.55),0.1),(*at(W0,0.6,-0.55),0.1)],[[0,1,2,3]],["white"])
emit([(*at(W0,0.04,-0.12),9.0),(*at(W0,0.04,0.14),9.0),(*at(W0,0.64,0.25),0.2),(*at(W0,0.64,-0.2),0.2)],[[0,1,2,3]],["water"])
ico("white",*at(W0,0.9),0.25,0.9,0.9,0.45)
sm0=at(W0,0,-0.6); sm1=at(W0,0,0.6)                          # the shimenawa rope across the lip
solid([[(sm0[0],sm0[1],9.15),(sm0[0]+0.05,sm0[1],9.15),(sm0[0]+0.05,sm0[1],9.22),(sm0[0],sm0[1],9.22)],[(sm1[0],sm1[1],9.15),(sm1[0]+0.05,sm1[1],9.15),(sm1[0]+0.05,sm1[1],9.22),(sm1[0],sm1[1],9.22)]],"gold")
PC=at(F,2.3); PR=1.7
prism("water",PC[0],PC[1],-0.02,0.04,PR+0.1,PR+0.1,12,0)
for k in range(11):
    a=2*math.pi*k/11+0.2; ico("rock",PC[0]+(PR+0.25)*math.cos(a),PC[1]+(PR+0.25)*math.sin(a),0.05,0.5,0.45,0.35)
def water_disc(x,y): return math.hypot(x-PC[0],y-PC[1])<PR-0.1

# ---- Hiro shrine's vermilion torii before the pool, facing the approach
TT=at(F,4.4); T=dict(cx=TT[0],cy=TT[1],rot=math.pi/4)
for sx in (-1,1): solid([ngon(0.11,-0.05,8,0,sx*0.8,0),ngon(0.1,1.9,8,0,sx*0.8,0)],"red",T)
box("red",0,0,1.5,1.6,1.0,0.08,T); box("red",0,0,1.86,1.98,1.18,0.12,T); box("roof",0,0,1.98,2.06,1.25,0.15,T)
box("stone",0,0.6,-0.05,0.3,0.12,0.12,T)
for sx in (-1,1):
    box("stone",sx*1.5,-0.3,-0.05,0.5,0.09,0.09,T); box("stone",sx*1.5,-0.3,0.5,0.55,0.16,0.16,T)
    box("glow_lantern_%d"%(sx+1),sx*1.5,-0.3,0.55,0.74,0.1,0.1,T); box("stone",sx*1.5,-0.3,0.74,0.8,0.18,0.18,T)

# ---- Seiganto-ji's three-storey pagoda in vermilion, on its stone terrace, with the main hall beside it
TZ=0.8; TX0,TX1,TY0,TY1=-4.0,0.8,-7.2,-3.2
def tring(o,z): return rect((TX1-TX0)/2+o,(TY1-TY0)/2+o,z,(TX0+TX1)/2,(TY0+TY1)/2)
solid([tring(0.8,-0.05),tring(0.3,0.45),tring(0.0,TZ)],"stone")
SY0,SY1=-5.8,-4.6
for k in range(4):
    x=TX1+0.8-0.2*k-0.1; box("stone",x,(SY0+SY1)/2,-0.05,0.2*(k+1),0.1,(SY1-SY0)/2)
PX,PY=-1.6,-5.2
box("stone",PX,PY,TZ-0.05,TZ+0.25,1.3,1.3)
z=TZ+0.25
for i,(b,r) in enumerate(((0.98,1.8),(0.88,1.62),(0.78,1.46))):
    box("red",PX,PY,z,z+0.95,b,b)
    for k in (-1,0,1): box("white",PX+k*b*0.66,PY-b-0.01,z+0.2,z+0.7,0.12,0.01); box("white",PX+b+0.01,PY+k*b*0.66,z+0.2,z+0.7,0.01,0.12)
    box("white",PX,PY,z+0.95,z+1.12,b+0.08,b+0.08)
    flared_roof([(r,r,z+1.12,0.24),(r,r,z+1.22,0.24),(b*0.9+0.08,b*0.9+0.08,z+1.45,0.05),(b-0.08,b-0.08,z+1.55,0.0)],"roof",PX,PY)
    if i<2: box("red",PX,PY,z+1.55,z+1.7,b-0.12,b-0.12)
    z+=1.7
prism("roof",PX,PY,z-0.15,z+0.25,0.42,0.3,8)
prism("gold",PX,PY,z+0.25,z+2.0,0.06,0.045,6)
for k in range(9): prism("roof",PX,PY,z+0.4+k*0.13,z+0.45+k*0.13,0.17,0.17,8)
prism("gold",PX,PY,z+1.75,z+1.95,0.16,0.02,8)
# the main hall (Nyoirin-do): unpainted timber under a broad grey roof
HX,HY=-6.8,-1.4
box("stone",HX,HY,-0.05,0.3,2.4,1.7)
box("wood",HX,HY,0.3,1.55,2.1,1.4)
for k in range(7): box("wood",HX-2.0+0.667*k,HY-1.45,0.3,1.55,0.07,0.07)
box("glow_hall",HX,HY-1.42,0.5,1.2,0.6,0.01)
flared_roof([(3.0,2.25,1.55,0.3),(3.0,2.25,1.68,0.3),(2.1,1.4,2.5,0.08),(1.75,0.15,3.3,0.0)],"roof",HX,HY)
box("roof",HX,HY,3.25,3.42,1.8,0.15)

# ---- the stone path up from the road, splitting for the pagoda and the falls
def path(pts,w=0.55):
    for (ax,ay),(bx,by) in zip(pts,pts[1:]):
        dx,dy=bx-ax,by-ay; L=math.hypot(dx,dy); nx,ny=-dy/L*w,dx/L*w
        emit([(ax+nx,ay+ny,0.03),(ax-nx,ay-ny,0.03),(bx-nx,by-ny,0.03),(bx+nx,by+ny,0.03)],[[0,1,2,3]],["stone"])
path([(10.4,-7.6),(6.6,-5.8),(3.6,-5.0),(1.8,-5.2)])
path([(3.6,-5.0),(3.4,-1.6),(2.4,1.2),*[at(TT,0.6)]])

# ---- Kumano's forest: cedars on the slopes and round the precinct, broadleaf trees by the pagoda
def cedar(x,y,s,z0=0.0):
    T2=dict(cx=x,cy=y,cz=z0,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.28,-0.3,6),ngon(0.16,4.2,6)],"bark",T2)
    for zc,r,h in ((2.4,1.2,1.9),(3.6,0.95,1.7),(4.7,0.65,1.4)):
        cone("forest",ngon(r,zc,7,rng.uniform(0,1)),(0,0,zc+h),T2)
def broad(x,y,s):
    T2=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.14,-0.3,5),ngon(0.09,1.4,5)],"bark",T2)
    ico("leaf",0,0,2.0,1.1,1.0,0.9,T2); ico("leaf",0.55,0.3,1.6,0.7,0.6,0.55,T2)
for x,y,s in [(-9.4,-4.2,1.0),(-9.6,4.0,1.05),(-7.4,8.8,1.0),(0.8,9.8,1.0),(5.0,6.0,1.1),(8.6,4.6,1.0),(9.6,1.0,0.95),(-3.8,2.8,0.95),(1.2,1.6,0.9),(4.6,2.8,1.0),(8.8,8.8,0.9),(-9.4,9.4,0.9)]:
    cedar(x,y,s)
for x,y,s in [(-4.8,-8.6,0.9),(-6.0,-5.6,1.0),(-9.0,-8.6,0.9),(2.4,-8.6,0.85),(6.0,-1.4,0.9),(-2.6,-1.2,0.85),(8.6,-3.4,0.8)]:
    broad(x,y,s)

def ground_at(x,y):
    if TX0-0.05<=x<=TX1+0.05 and TY0-0.05<=y<=TY1+0.05: return TZ
    if TX1<x<=TX1+0.85 and SY0<=y<=SY1: return TZ*(TX1+0.8-x)/0.8
    return 0.0
INTERACT=(0.1,-5.2)   # the terrace beside the pagoda, at the head of the steps
STAND=(2.3,-5.0)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/nachi-falls.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/nachi-falls.json"
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
    objname=key if key.startswith("glow_") else "nachi_"+key
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
