# Takachiho Gorge (the columnar basalt walls, Manai Falls into the emerald river, rowboats, the forested rims) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python takachiho.py
# Rebuilds content/landmarks/takachiho.blend and public/models/landmarks/takachiho.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/takachiho.glb"
BLEND=ROOT+"/content/landmarks/takachiho.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"basalt":"5f6560","moss":"6f9a3a","water":"2f8a78","foam":"eef2ee","boat":"3f6fae","leaf":"4a7a42","leafdk":"355f36","fern":"86b45e","bark":"4e3a30"}
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
rng=random.Random(38)
EXTRA_SOLIDS=[]; NOSOLID={"leaf","leafdk","fern","moss","foam"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the gorge with its falls and its forested rims
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0
S2=math.sqrt(0.5)
def to_xy(u,v): return (S2*(u+v),S2*(v-u))     # u toward the camera, v screen-right
def to_uv(x,y): return (S2*(x-y),S2*(x+y))

# ---- the gorge runs across the view: its far wall of columnar basalt faces the camera, the near side steps down in
# broken columns to the emerald river; the river ends in the narrows at either hand
WZ=-2.2; DEEP=-2.4; VL=7.4; FV=-2.4
def uc(v): return 0.25*math.sin(0.35*v)
def in_river(u,v,m=0.0): return abs(u-uc(v))<1.6-m and abs(v)<VL-m
def water_disc(x,y): u,v=to_uv(x,y); return in_river(u,v,0.1)

vs=[-VL+2*VL*k/18 for k in range(19)]
for va,vb in zip(vs,vs[1:]):
    q=[to_xy(uc(va)-1.75,va),to_xy(uc(va)+1.75,va),to_xy(uc(vb)+1.75,vb),to_xy(uc(vb)-1.75,vb)]
    emit([(*p,WZ) for p in q],[[0,1,2,3]],["water"])
def column(u,v,top,bot=DEEP-0.4,r=0.5,moss=True):
    x,y=to_xy(u,v); prism("basalt",x,y,bot,top,r,r*0.97,6,rng.uniform(0,1))
    if moss and rng.random()<0.55: prism("moss",x,y,top,top+0.06,r*0.85,r*0.6,6,rng.uniform(0,1))
# far wall: a basalt core with three ranks of columns standing proud of it, rising to the rim
for va,vb in zip(vs,vs[1:]):
    a0=to_xy(uc(va)-1.3,va); a1=to_xy(uc(va)-3.2,va); b0=to_xy(uc(vb)-1.3,vb); b1=to_xy(uc(vb)-3.2,vb)
    solid([[(a0[0],a0[1],DEEP-0.4),(a1[0],a1[1],DEEP-0.4),(a1[0],a1[1],-0.05),(a0[0],a0[1],-0.05)],[(b0[0],b0[1],DEEP-0.4),(b1[0],b1[1],DEEP-0.4),(b1[0],b1[1],-0.05),(b0[0],b0[1],-0.05)]],"basalt")
for row,(u,t0) in enumerate(((-1.2,0.1),(-1.95,0.3),(-2.75,0.2))):
    for k in range(-10,11):
        v=k*0.78+(0.39 if row%2 else 0)+rng.uniform(-0.08,0.08)
        if abs(v)>VL+0.6: continue
        if row==0 and abs(v-FV)<0.55: continue        # the notch the falls has cut
        column(u+uc(v)+(rng.uniform(-0.25,0.2) if row==0 else rng.uniform(-0.06,0.06)),v,t0+rng.uniform(-0.25,0.35),r=0.46 if row==0 else 0.5)
# near side: basalt cliffs rise at both ends, so the river runs confined between walls; in the middle a lower break
# (a slope of forest floor down to broken columns at the waterline) keeps the falls and a boat in view
VC=-1.6
def cliff(v): return smooth(2.9,4.0,abs(v-VC))     # a notch in the near rim, centred between the falls and the middle
for va,vb in zip(vs,vs[1:]):
    ca,cb=cliff(va),cliff(vb)
    if ca<0.05 and cb<0.05: continue
    za,zb=(DEEP+0.4)+(-0.05-(DEEP+0.4))*ca,(DEEP+0.4)+(-0.05-(DEEP+0.4))*cb
    a0=to_xy(uc(va)+1.35,va); a1=to_xy(uc(va)+3.6,va); b0=to_xy(uc(vb)+1.35,vb); b1=to_xy(uc(vb)+3.6,vb)
    solid([[(a0[0],a0[1],DEEP-0.4),(a1[0],a1[1],DEEP-0.4),(a1[0],a1[1],za),(a0[0],a0[1],za)],[(b0[0],b0[1],DEEP-0.4),(b1[0],b1[1],DEEP-0.4),(b1[0],b1[1],zb),(b0[0],b0[1],zb)]],"basalt")
for row,(du,t0) in enumerate(((1.3,0.05),(2.05,0.25))):
    for k in range(-10,11):
        v=k*0.78+(0.39 if row%2 else 0)+rng.uniform(-0.08,0.08)
        c=cliff(v)
        if abs(v)>VL+0.6 or c<0.3: continue
        column(du+uc(v)+rng.uniform(-0.1,0.15),v,(DEEP+0.6)+(t0+rng.uniform(-0.25,0.3)-(DEEP+0.6))*c,r=0.46)
for k in range(-9,10):
    v=k*0.82+rng.uniform(-0.15,0.15)
    if abs(v)>VL-0.3 or cliff(v)>0.4: continue
    u=uc(v)+1.75+rng.uniform(-0.1,0.2)
    column(u,v,DEEP+rng.uniform(0.3,0.9),r=0.42)
    if k%3==0:
        x,y=to_xy(u+0.7,v+0.3); ico("basalt",x,y,DEEP+0.75,0.5,0.45,0.35)
# the narrows closing each end
for sv in (-1,1):
    for k in range(-4,5):
        u=k*0.62; column(u,sv*(VL+0.4)+rng.uniform(-0.1,0.1),rng.uniform(-0.3,0.4))
        if k<2: column(u-0.3,sv*(VL+1.15),rng.uniform(-0.1,0.4))

# ---- Manai Falls: a fan of white threads from the far rim into the river, fed by a stream across the plateau
for dv,w in ((-0.3,0.18),(0.0,0.26),(0.32,0.16)):
    a=to_xy(uc(FV)-1.25,FV+dv-w); b=to_xy(uc(FV)-1.25,FV+dv+w); c=to_xy(uc(FV)-0.7,FV+dv+w*1.6); d=to_xy(uc(FV)-0.7,FV+dv-w*1.6)
    emit([(*a,0.45),(*b,0.45),(*c,WZ+0.02),(*d,WZ+0.02)],[[0,1,2,3]],["foam"])
p=to_xy(uc(FV)-0.45,FV); ico("foam",p[0],p[1],WZ+0.1,0.8,0.8,0.25)
for ua,ub in ((-1.5,-3.4),(-3.4,-5.6),(-5.6,-7.2)):
    sa,sb=FV+0.3*(ua+1.0)/2.4,FV+0.3*(ub+1.0)/2.4
    q=[to_xy(ua,sa-0.35),to_xy(ua,sa+0.35),to_xy(ub,sb+0.35),to_xy(ub,sb-0.35)]
    emit([(*pp,0.42) for pp in q],[[0,1,2,3]],["water"])
for ua in (-1.6,-3.0,-4.4,-6.0,-7.4):
    for sd in (-1,1):
        p=to_xy(ua,FV+sd*0.6+0.3*(ua+1.0)/2.4); ico("basalt",p[0],p[1],0.2,0.32,0.3,0.25)

# ---- rowboats on the green water
def boat(v,ang,col):
    u=uc(v); x,y=to_xy(u,v); T=dict(cx=x,cy=y,cz=WZ,rot=math.pi/4+ang)
    solid([[(-0.75,-0.18,0.0),(0.75,-0.18,0.0),(0.75,0.18,0.0),(-0.75,0.18,0.0)],[(-0.95,-0.3,0.22),(0.95,-0.3,0.22),(0.95,0.3,0.22),(-0.95,0.3,0.22)]],col,T)
    box("foam",0.0,0,0.22,0.27,0.82,0.25,T); box(col,0.0,0,0.27,0.33,0.1,0.25,T); box(col,0.15,0,0.3,0.55,0.1,0.1,T); ico("leaf" if False else "boat",0.15,0,0.62,0.08,0.08,0.08,T)
boat(-4.1,0.3,"boat"); boat(-1.35,-0.15,"boat"); boat(1.0,0.2,"boat")   # all in the notch's view; the middle one framed by the falls and the dark wall

# ---- the forest on the rims: tall broadleaf trees and cedars beyond the far wall, lower growth and ferns on the near
def tree(x,y,s,m):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.16,-0.3,5),ngon(0.1,2.0,5,0,0.15,0)],"bark",T)
    ico(m,0,0,2.7,1.35,1.25,1.05,T); ico(m,0.7,0.35,2.2,0.85,0.8,0.65,T); ico(m,-0.5,-0.4,3.2,0.8,0.75,0.6,T)
def fern(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    for k in range(5):
        a=2*math.pi*k/5
        cone("fern",[(0.05*math.cos(a+1.6),0.05*math.sin(a+1.6),0.05),(-0.05*math.cos(a+1.6),-0.05*math.sin(a+1.6),0.05),(0.45*math.cos(a)-0.08*math.sin(a),0.45*math.sin(a)+0.08*math.cos(a),0.38)],(0.85*math.cos(a),0.85*math.sin(a),0.15),T)
pts=[]
for _ in range(3000):
    u,v=rng.uniform(-14,-3.6),rng.uniform(-12,12)
    x,y=to_xy(u,v)
    if abs(x)>FH-1.8 or abs(y)>FH-1.8: continue
    if abs(v-FV)<1.0 and u>-7.8: continue
    if any((x-px)**2+(y-py)**2<1.7**2 for px,py in pts): continue
    pts.append((x,y))
    if len(pts)>=22: break
for k,(x,y) in enumerate(pts): tree(x,y,rng.uniform(0.9,1.2),"leafdk" if k%3==0 else "leaf")
for u,v,s in [(6.4,-8.0,0.8),(6.6,7.0,0.8),(8.2,-7.0,0.7),(5.6,9.0,0.75)]:   # none in front of the notch
    x,y=to_xy(u,v)
    if abs(x)<FH-1.2 and abs(y)<FH-1.2: tree(x,y,s,"leaf")
for _ in range(26):
    while True:
        u,v=rng.uniform(-12,9),rng.uniform(-11,11); x,y=to_xy(u,v)
        if abs(x)<FH-0.8 and abs(y)<FH-0.8 and (u<-3.6 or u>2.4) and not (u<6.5 and abs(v-VC)<3.2): break
    fern(x,y,rng.uniform(0.7,1.05))

def ground_at(x,y):
    u,v=to_uv(x,y)
    if abs(v)<VL+0.2:
        d=u-uc(v)
        if -2.5<=d<=1.5: return DEEP          # under the far wall too, so the terrain's slope stays inside the rock
        if cliff(v)>0.5: return DEEP if d<=3.3 else 0.0      # under the near cliffs, inside the rock
        if 1.5<d<5.5: return DEEP*(1-(d-1.5)/4.0)*smooth(VL+0.2,VL-1.0,abs(v))+0.0
    return 0.0
INTERACT=to_xy(4.2,FV)        # on the near bank, looking across at the falls
STAND=to_xy(5.0,FV+0.9)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/takachiho.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/takachiho.json"
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
    objname=key if key.startswith("glow_") else "takachiho_"+key
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
