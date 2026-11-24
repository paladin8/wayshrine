# Shiretoko (the Five Lakes in early snow under the white Shiretoko range, fir forest, the raised boardwalk, a brown bear and sika deer) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python shiretoko.py
# Rebuilds content/landmarks/shiretoko.blend and public/models/landmarks/shiretoko.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/shiretoko.glb"
BLEND=ROOT+"/content/landmarks/shiretoko.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"snow":"eef2f4","rock":"6e6a66","forest":"3f5a48","reed":"a8a07a","ice":"cfe2ea","water":"2f5a6e","fir":"2f4f3e","bark":"4e3a30","deck":"9a7a5a","post":"6b5440","bear":"5a3e2a","deerc":"9a6a42"}
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
rng=random.Random(57)
EXTRA_SOLIDS=[]; NOSOLID={"fir","grass"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the lakes under the peninsula's mountains
TERRAIN_SURFACE=False; EDGE_LEVEL=0.0          # the model draws its own landform: the mountains, the lakes, the snow
S2=math.sqrt(0.5)
def to_xy(u,v): return (S2*(u+v),S2*(v-u))
def to_uv(x,y): return (S2*(x-y),S2*(x+y))
def F(u,v,rot=0.0,cz=0.0): x,y=to_xy(u,v); return dict(cx=x,cy=y,cz=cz,rot=math.pi/4+rot)
def tube(mat,pts,rs,n=6):
    rings=[]
    for k,p in enumerate(pts):
        a=pts[max(k-1,0)]; b=pts[min(k+1,len(pts)-1)]
        d=Vector(b)-Vector(a); d.normalize()
        w0=d.cross(Vector((0,0,1))) if abs(d.z)<0.95 else d.cross(Vector((1,0,0)))
        w0.normalize(); w1=d.cross(w0)
        rings.append([tuple(Vector(p)+rs[k]*(math.cos(2*math.pi*i/n)*w0+math.sin(2*math.pi*i/n)*w1)) for i in range(n)])
    solid(rings,mat)

# ---- Shiretoko Goko in early winter: the Shiretoko range white along the back, Rausu-dake highest, a dark band of
# fir forest below, three of the five lakes edged with ice in the snowy marsh, and the raised boardwalk out to them
PEAKS=[(-7.4,-3.6,5.2,2.6),(-7.8,1.6,4.2,2.4),(-6.8,5.6,3.4,2.0),(-6.4,-7.0,3.0,2.0)]
def mtn(u,v):
    h=0.0
    for pu,pv,ph,pr in PEAKS:
        d=math.hypot((u-pu)/1.0,(v-pv)/1.2)
        h=max(h,ph*max(0.0,1-d/pr)**1.3)
    h+=1.0*smooth(-3.5,-6.5,u)
    return h*smooth(14.8,11.8,abs(u)+abs(v))
# the first lake, where the boardwalk ends, is large and open with a ragged shore; two more lie tucked in the treeline
LAKES=[(1.2,-3.6,3.1,2.5),(-2.9,3.9,1.3,1.0),(-3.3,-5.0,1.1,0.85)]
def lwob(i,t): return 1+(0.14*math.sin(3*t+0.5)+0.08*math.sin(5*t+1.9)+0.05*math.sin(7*t+0.3) if i==0 else 0.06*math.sin(3*t+i))
def lake_d(u,v):
    return min(math.hypot((u-a)/c,(v-b)/d)/lwob(i,math.atan2((v-b)/d,(u-a)/c)) for i,(a,b,c,d) in enumerate(LAKES))
def H(x,y):
    u,v=to_uv(x,y)
    h=mtn(u,v)
    ld=lake_d(u,v)
    h-=0.5*smooth(1.0,0.75,ld)
    return h
def water_disc(x,y): u,v=to_uv(x,y); return lake_d(u,v)<0.8
STEP=0.55; N=int(round(2*FH/STEP)); STEP=2*FH/N
g={}
for j in range(N+1):
    for i in range(N+1):
        x,y=-FH+i*STEP,-FH+j*STEP
        if 0<i<N and 0<j<N: x+=rng.uniform(-0.12,0.12); y+=rng.uniform(-0.12,0.12)
        g[(i,j)]=(x,y,H(x,y))
vs=[];ix={}
for k,vv in g.items(): ix[k]=len(vs); vs.append(vv)
fs=[];ms=[]
for j in range(N):
    for i in range(N):
        a,b,c,d=(i,j),(i+1,j),(i+1,j+1),(i,j+1)
        for t in ([(a,b,c),(a,c,d)] if (i+j)%2==0 else [(a,b,d),(b,c,d)]):
            ps=[g[k] for k in t]; hh=[p[2] for p in ps]; cx,cy=sum(p[0] for p in ps)/3,sum(p[1] for p in ps)/3
            sl=(max(hh)-min(hh))/STEP; h=sum(hh)/3
            u,v=to_uv(cx,cy)
            m="snow"
            if sl>1.15 and h>1.2: m="rock"
            elif 0.3<h<2.0 and u<-2.0 and sl>0.25: m="forest"
            elif h<0.05 and lake_d(u,v)<1.25: m="reed"
            fs.append([ix[k] for k in t]); ms.append(m)
emit(vs,fs,ms)
for i,(a,b,c,d) in enumerate(LAKES):                     # the lakes: open water to a thin broken edge of ice
    n=24 if i==0 else 14; cx,cy=to_xy(a,b)
    def lr(f,t): w=lwob(i,t); return to_xy(a+c*f*w*math.cos(t),b+d*f*w*math.sin(t))
    ring=[lr(0.86,2*math.pi*k/n) for k in range(n)]
    emit([(x,y,-0.34) for x,y in ring]+[(cx,cy,-0.34)],[[k,(k+1)%n,n] for k in range(n)],["ice"]*n)
    ring2=[lr(0.86-(0.04 if (k*5)%7<4 else 0.14),2*math.pi*k/n) for k in range(n)]
    emit([(x,y,-0.32) for x,y in ring2]+[(cx,cy,-0.32)],[[k,(k+1)%n,n] for k in range(n)],["water"]*n)
# fir forest on the lower slopes, a few birches and firs round the marsh
def fir(u,v,s):
    x,y=to_xy(u,v); z=H(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.12,-0.3,5),ngon(0.08,0.8,5)],"bark",T)
    for zc,r,hh in ((0.6,0.75,1.1),(1.3,0.48,1.0)):
        cone("fir",ngon(r,zc,6,rng.uniform(0,1)),(0,0,zc+hh),T)
    cone("snow",ngon(0.2,1.95,5,0.3),(0,0,2.3),T)
for k in range(48):
    u,v=rng.uniform(-6.5,-2.2),rng.uniform(-9,9)
    if abs(u)+abs(v)>13.5: continue
    x,y=to_xy(u,v)
    if H(x,y)>2.6 or lake_d(u,v)<1.15: continue
    fir(u,v,rng.uniform(0.7,1.05))
for u,v,s in [(4.6,-6.4,0.9),(5.6,4.6,0.85),(3.6,6.8,0.9),(-0.4,-7.0,0.85),(6.6,-2.6,0.8),(-1.0,6.4,0.8)]:
    fir(u,v,s)
# the raised boardwalk: from the camera's side out across the marsh to a railed deck over the first lake
DZ=0.8; W=0.55
PATH=[(9.8,0.4),(6.8,0.2),(5.4,-1.0),(4.4,-1.6)]
DECK=(3.8,-2.8,0.9,1.3)
def seg_hit(u,v):
    for (ua,va),(ub,vb) in zip(PATH,PATH[1:]):
        L2=(ub-ua)**2+(vb-va)**2; t=max(0.0,min(1.0,((u-ua)*(ub-ua)+(v-va)*(vb-va))/L2))
        if math.hypot(u-ua-t*(ub-ua),v-va-t*(vb-va))<=W: return True
    return abs(u-DECK[0])<=DECK[2] and abs(v-DECK[1])<=DECK[3]
for (ua,va),(ub,vb) in zip(PATH,PATH[1:]):
    L=math.hypot(ub-ua,vb-va); ang=math.atan2(vb-va,ub-ua)
    T=F((ua+ub)/2,(va+vb)/2,ang-math.pi/2)
    if (ua,va)==PATH[0]:                                 # the first stretch ramps up from the snow
        def rp(u,z): return [(*to_xy(u,va+(vb-va)*(ua-u)/(ua-ub)-W),z-0.1),(*to_xy(u,va+(vb-va)*(ua-u)/(ua-ub)+W),z-0.1),(*to_xy(u,va+(vb-va)*(ua-u)/(ua-ub)+W),z),(*to_xy(u,va+(vb-va)*(ua-u)/(ua-ub)-W),z)]
        solid([rp(9.85,0.02),rp(8.6,DZ)],"deck")
        T=F((8.6+ub)/2,(va+vb)/2,ang-math.pi/2); L=8.6-ub
    box("deck",0,0,DZ-0.1,DZ,L/2+W*0.5,W,T)
    for k in range(int(L/0.9)+1):
        s=-L/2+L*k/max(1,int(L/0.9))
        for sd in (-1,1):
            box("deck",s,sd*(W-0.03),DZ,DZ+0.55,0.03,0.03,T); box("post",s,sd*(W-0.1),-0.4,DZ-0.1,0.04,0.04,T)
    for sd in (-1,1): box("deck",0,sd*(W-0.03),DZ+0.5,DZ+0.56,L/2,0.03,T)
T=F(DECK[0],DECK[1])
box("deck",0,0,DZ-0.1,DZ,DECK[3],DECK[2],T)
for sx in (-1,1):
    box("deck",sx*DECK[3],0,DZ+0.5,DZ+0.56,0.03,DECK[2],T); box("deck",0,-sx*DECK[2],DZ+0.5,DZ+0.56,DECK[3],0.03,T)
    for k in range(5):
        t=-1+2*k/4; box("deck",sx*DECK[3],t*DECK[2],DZ,DZ+0.55,0.03,0.03,T); box("deck",t*DECK[3],-sx*DECK[2],DZ,DZ+0.55,0.03,0.03,T)
        box("post",sx*(DECK[3]-0.1),t*DECK[2]*0.9,-0.5,DZ-0.1,0.04,0.04,T)
# a brown bear crossing the snow below the forest, and sika deer
def bear(u,v,ang):
    x,y=to_xy(u,v); z=H(x,y); T2=F(u,v,ang,z)
    ico("bear",0,0,0.5,0.55,0.3,0.32,T2); ico("bear",0.5,0,0.62,0.2,0.18,0.18,T2); box("bear",0.68,0,0.56,0.64,0.08,0.06,T2)
    for sx in (-0.3,0.3):
        for sy in (-0.15,0.15): box("bear",sx,sy,0.0,0.4,0.08,0.08,T2)
def deer(u,v,ang):
    x,y=to_xy(u,v); z=H(x,y); T2=F(u,v,ang,z)
    box("deerc",0,0,0.42,0.68,0.32,0.12,T2)
    for sx in (-0.24,0.24):
        for sy in (-0.07,0.07): box("deerc",sx,sy,0.0,0.45,0.03,0.03,T2)
    solid([[(0.28,-0.05,0.6),(0.28,0.05,0.6),(0.28,0.05,0.7),(0.28,-0.05,0.7)],[(0.42,-0.04,0.85),(0.42,0.04,0.85),(0.42,0.04,0.93),(0.42,-0.04,0.93)]],"deerc",T2)
bear(-1.2,-5.8,0.4); deer(4.2,4.6,2.0); deer(4.8,5.4,1.6)
def ground_at(x,y):
    u,v=to_uv(x,y)
    if seg_hit(u,v): return DZ*smooth(9.85,8.6,u)          # the boardwalk ramps up from the snow
    return H(x,y)
def terrain_at(x,y): return H(x,y)
INTERACT=to_xy(9.0,0.4)   # on the deck over the first lake
STAND=to_xy(10.4,1.4)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/shiretoko.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/shiretoko.json"
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
    objname=key if key.startswith("glow_") else "shiretoko_"+key
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
