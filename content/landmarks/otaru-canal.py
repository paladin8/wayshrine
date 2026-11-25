# Otaru Canal landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python otaru-canal.py
# Rebuilds content/landmarks/otaru-canal.blend and public/models/landmarks/otaru-canal.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/otaru-canal.glb"
BLEND=ROOT+"/content/landmarks/otaru-canal.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"snow":"eef2f4","stonewall":"8f8a80","pave":"a8a298","water":"2a4e62","ware":"b3a68f","brick":"a5523c","roof":"3e4248","iron":"2a2c30","wood":"5e4632","fir":"2f4f3e","glow_cream":"e8dcb0"}
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
rng=random.Random(58)
EXTRA_SOLIDS=[]; NOSOLID={"fir"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, a stretch of canal with its warehouses and walk
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0
def to_xy(u,v): return (v,-u)     # u toward the front (-Y), v along +X: the canal runs along a grid axis
def to_uv(x,y): return (-y,x)
R45=0.0; R135=math.pi/2
def T45(u,v,z=0.0): x,y=to_xy(u,v); return dict(cx=x,cy=y,cz=z,rot=R45)      # local x along v, local y toward -u
def T135(u,v,z=0.0): x,y=to_xy(u,v); return dict(cx=x,cy=y,cz=z,rot=R135)    # local x toward -u, local y toward -v

# ---- the canal: a straight stone-walled channel running screen-right, sunk below the banks, ending in a stone
# head at either end so the water stays inside the footprint. Each end runs in under a road bridge -- Asakusa bridge
# square across the left, a second crossing angled across the right -- so the heads are hidden and the canal reads
# as carrying on beyond them
CW=1.75; VC=8.4; CH=-0.75; WZ=-0.42; BRW=0.78
BRIDGES=[(-7.85,0.0),(7.75,0.42)]                      # (centre along the canal, angle off square)
def bloc(u,v,vc,ang):
    dv=v-vc; c,s_=math.cos(ang),math.sin(ang); return u*c+dv*s_,-u*s_+dv*c      # along the deck, across it
def on_bridge(u,v):
    for vc,ang in BRIDGES:
        lu,lv=bloc(u,v,vc,ang)
        if abs(lv)<BRW and abs(lu)<(CW+0.6)/math.cos(ang): return True
    return False
def in_canal(u,v,m=0.0): return abs(u)<CW-m and -VC+m<v<VC-m
def G(u,v): return CH if in_canal(u,v) else 0.0
q=[to_xy(-CW,-VC),to_xy(CW,-VC),to_xy(CW,VC),to_xy(-CW,VC)]
emit([(*p,WZ) for p in q],[[0,1,2,3]],["water"])
def wall(u0,v0,u1,v1,z0,z1,mat="stonewall"):
    a=to_xy(u0,v0); b=to_xy(u1,v0); c=to_xy(u1,v1); d=to_xy(u0,v1)
    solid([[(*a,z0),(*b,z0),(*c,z0),(*d,z0)],[(*a,z1),(*b,z1),(*c,z1),(*d,z1)]],mat)
for sd in (-1,1):                                      # the embankment walls, coped a little above the bank
    wall(sd*CW,-VC-0.25,sd*(CW+0.25),VC+0.25,CH-0.05,0.06)
for se in (-1,1):
    wall(-CW-0.25,se*VC,CW+0.25,se*(VC+0.25),CH-0.05,0.06)
for k in range(9):                                     # mooring stones and stains along the far wall
    v=-7.4+1.85*k
    if on_bridge(-CW,v) or abs(v)>7.0: continue
    wall(-CW+0.02,v-0.12,-CW+0.14,v+0.12,WZ-0.02,-0.1,"pave")
# the bridges: flat stone decks with low parapets and corner posts
def bquad(lu0,lu1,lv0,lv1,z0,z1,vc,ang,mat):
    c,s_=math.cos(ang),math.sin(ang)
    def P(lu,lv): return to_xy(lu*c-lv*s_,vc+lu*s_+lv*c)
    q=[P(lu0,lv0),P(lu1,lv0),P(lu1,lv1),P(lu0,lv1)]
    solid([[(*p,z0) for p in q],[(*p,z1) for p in q]],mat)
for vc,ang in BRIDGES:
    L=(CW+0.55)/math.cos(ang)
    bquad(-L,L,-BRW,BRW,-0.32,0.05,vc,ang,"pave")
    for sd in (-1,1):
        bquad(-L,L,sd*BRW,sd*(BRW-0.16),0.05,0.5,vc,ang,"stonewall")
        for su in (-1,1): bquad(su*L-0.12,su*L+0.12,sd*(BRW-0.2),sd*(BRW+0.04),0.05,0.68,vc,ang,"stonewall")
# a moored barge
TB=T45(-0.75,2.6,WZ)
solid([[(-1.1,-0.28,-0.02),(1.1,-0.28,-0.02),(1.1,0.28,-0.02),(-1.1,0.28,-0.02)],[(-1.35,-0.38,0.2),(1.35,-0.38,0.2),(1.35,0.38,0.2),(-1.35,0.38,0.2)]],"wood",TB)
box("snow",0.1,0,0.2,0.28,0.95,0.26,TB)

# ---- the far bank: the stone warehouses of the old port, long sides to the water, gables under deep snow;
# one of red brick. Lit doors and windows face the canal
def warehouse(uc,v0,v1,D,H,R,mat,doors):
    L=(v1-v0)/2; vc=(v0+v1)/2; T=T45(uc,vc); Tg=T135(uc,vc)
    box(mat,0,0,-0.1,H,L,D,T)
    extrude_y(mat,[(-D,H-0.02),(D,H-0.02),(0,H+R-0.14)],-L,L,Tg)                    # the gable walls
    extrude_y("roof",[(-D-0.32,H-0.16),(D+0.32,H-0.16),(0,H+R-0.04)],-L-0.32,L+0.32,Tg)
    extrude_y("snow",[(-D-0.36,H-0.05),(D+0.36,H-0.05),(0,H+R+0.1)],-L-0.26,L+0.26,Tg)
    box("roof",0,-D-0.02,H-0.36,H-0.22,L+0.05,0.04,T)                                  # the dark string course
    for k,(dv,kind) in enumerate(doors):
        if kind=="door":
            box("glow_doors",dv,-D-0.03,0.0,1.05,0.36,0.03,T)
            box("iron",dv-0.52,-D-0.04,0.0,1.15,0.12,0.03,T); box("iron",dv+0.52,-D-0.04,0.0,1.15,0.12,0.03,T)
        elif kind=="win":
            box("glow_windows",dv,-D-0.03,1.35,1.85,0.2,0.03,T)
        else:
            box("iron",dv,-D-0.03,1.35,1.85,0.22,0.03,T)
    for dv in (-L*0.55,L*0.55):                                                        # back-side shutters
        box("iron",dv,D+0.03,1.35,1.85,0.22,0.03,T)
UW=-3.55; DW=1.35
warehouse(UW,-8.0,-4.3,DW,2.2,1.05,"ware",[(-1.1,"sh"),(0.0,"door"),(1.1,"win")])
warehouse(UW-0.15,-4.0,-0.2,DW+0.15,2.55,1.15,"brick",[(-1.2,"win"),(-0.4,"sh"),(0.6,"door"),(1.45,"win")])
warehouse(UW,0.1,4.4,DW,2.3,1.05,"ware",[(-1.4,"door"),(-0.3,"win"),(0.7,"sh"),(1.6,"win")])
warehouse(UW+0.1,4.7,8.1,DW-0.1,2.0,0.95,"ware",[(-0.9,"win"),(0.3,"door"),(1.3,"sh")])
wall(-CW-0.25,-VC-0.25,UW+DW+0.05,VC+0.25,-0.05,0.04,"pave")                          # the narrow quay before them
# the street behind, and lower buildings beyond it
for vc,L,H,mat in ((-5.6,1.6,1.5,"ware"),(-2.2,1.4,1.7,"brick"),(1.2,1.5,1.4,"ware"),(4.4,1.3,1.6,"ware")):
    T=T45(-7.2,vc); Tg=T135(-7.2,vc); D=1.0
    box(mat,0,0,-0.1,H,L,D,T)
    extrude_y("roof",[(-D-0.25,H-0.12),(D+0.25,H-0.12),(0,H+0.62)],-L-0.25,L+0.25,Tg)
    extrude_y("snow",[(-D-0.28,H-0.03),(D+0.28,H-0.03),(0,H+0.74)],-L-0.2,L+0.2,Tg)
    box("glow_windows",-L*0.4,-D-0.03,0.6,1.0,0.18,0.03,T); box("glow_windows",L*0.4,-D-0.03,0.6,1.0,0.18,0.03,T)

# ---- the near bank: the stone walk with its gas lamps, a snow bank along the canal edge set with snow candles
wall(CW+0.25,-VC-0.25,4.5,VC+0.25,-0.05,0.03,"pave")
for k in range(12):                                     # the snow bank, a low ridge along the coping
    v=-VC+0.1+(2*VC-0.2)*k/12; v1=-VC+0.1+(2*VC-0.2)*(k+1)/12
    if on_bridge(CW+0.6,v) or on_bridge(CW+0.6,v1): continue
    a,b=to_xy(CW+0.1,v),to_xy(CW+0.1,v1); c,d=to_xy(CW+0.75,v1),to_xy(CW+0.75,v)
    hh=rng.uniform(0.16,0.26)
    solid([[(*a,0.0),(*b,0.0),(*c,0.0),(*d,0.0)],[(*to_xy(CW+0.3,v+0.1),hh),(*to_xy(CW+0.3,v1-0.1),hh),(*to_xy(CW+0.55,v1-0.1),hh*0.8),(*to_xy(CW+0.55,v+0.1),hh*0.8)]],"snow")
for k in range(16):
    v=-7.6+15.2*k/15
    if on_bridge(CW+0.6,v): continue
    x,y=to_xy(CW+0.45,v)
    box("glow_candles",x,y,0.12,0.36,0.06,0.06)
    prism("snow",x,y,0.0,0.18,0.14,0.11,6)
LU=2.62                                # the lamps stand right along the water's edge, leading the eye down it
def lamp(v):
    x,y=to_xy(LU,v); T=dict(cx=x,cy=y,rot=R45)
    prism("iron",x,y,0.0,0.16,0.13,0.1,6); prism("iron",x,y,0.16,1.85,0.05,0.04,6)
    box("iron",0,0,1.78,1.84,0.42,0.03,T)
    for sx in (-0.36,0.36):
        box("glow_lamps",sx,0,1.56,1.8,0.09,0.09,T)
        frus("iron",sx,0,1.84,1.96,0.13,0.13,0.03,0.03,None,T)
    prism("iron",x,y,1.85,2.05,0.03,0.01,4)
for v in (-6.3,-3.9,-1.5,0.9,3.3,5.7): lamp(v)
for v in (-3.9,3.6):                                    # benches
    T=T45(4.4,v); box("wood",0,0,0.38,0.46,0.6,0.18,T); box("snow",0,0,0.46,0.52,0.56,0.15,T)
    for sx in (-0.5,0.5): box("iron",sx,0,0.0,0.38,0.04,0.15,T)

# ---- snow-laden firs and drifts on the open ground
def fir(u,v,s):
    x,y=to_xy(u,v); T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.12,-0.3,5),ngon(0.08,0.8,5)],"wood",T)
    for zc,r,hh in ((0.6,0.75,1.1),(1.3,0.48,1.0)):
        cone("fir",ngon(r,zc,6,rng.uniform(0,1)),(0,0,zc+hh),T)
        cone("snow",ngon(r*0.55,zc+hh*0.45,6,0.3),(0,0,zc+hh+0.06),T)
for u,v,s in [(6.0,-7.6,1.0),(8.4,-5.2,0.9),(6.4,-2.4,1.0),(8.8,0.8,1.1),(6.2,4.6,0.9),(8.6,7.4,1.0),(5.8,9.4,0.85),(9.4,-8.8,0.85),
              (-1.0,9.6,1.0),(2.4,9.8,0.9),(-0.6,-9.6,1.0),(2.6,-9.8,0.85),(-6.0,9.4,0.9),(-9.2,8.6,0.85),(-6.2,-9.4,0.9),(-9.0,-8.4,0.85),(-9.4,-0.2,0.8)]:
    x,y=to_xy(u,v)
    if abs(x)<FH-1.1 and abs(y)<FH-1.1: fir(u,v,s)
def ground_at(x,y):
    u,v=to_uv(x,y)
    if on_bridge(u,v): return 0.05
    return G(u,v)
def terrain_at(x,y):
    u,v=to_uv(x,y); return G(u,v)
def water_disc(x,y): u,v=to_uv(x,y); return in_canal(u,v,0.15) and not on_bridge(u,v)
INTERACT=to_xy(3.1,2.1)    # on the canal walk between two lamps, looking across at the warehouses
STAND=to_xy(3.75,2.1)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/otaru-canal.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/otaru-canal.json"
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
    objname=key if key.startswith("glow_") else "otaru_"+key
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
