# Senso-ji (the Kaminarimon and its lantern, Nakamise-dori, the Hozomon, the five-storey pagoda and the main hall) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python senso-ji.py
# Rebuilds content/landmarks/senso-ji.blend and public/models/landmarks/senso-ji.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/senso-ji.glb"
BLEND=ROOT+"/content/landmarks/senso-ji.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"red":"c4402f","roof":"4a4d52","lantern":"b3302a","pave":"c9c3b6","stone":"9a958c","white":"efeae0","black":"2a2a2e","bronze":"6b5a3a","gold":"d9b04a","foliage":"5f8a45","bark":"4e3a30","glow_cream":"e8dcb0"}
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
rng=random.Random(26)
EXTRA_SOLIDS=[]; NOSOLID={"foliage"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the temple precinct and its approach
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0
def water_disc(x,y): return False
# the approach runs along +Y from the Kaminarimon at the front edge, down Nakamise-dori, through the Hozomon, to the
# main hall at the back; the pagoda stands west of the court (screen-left), beside the hall

# ---- paving: the Nakamise street and the temple court
box("pave",0,-5.0,-0.04,0.03,1.0,4.2)
box("pave",0,1.8,-0.04,0.03,3.8,2.8)
box("pave",-6.0,4.4,-0.04,0.03,1.4,1.4); box("pave",-4.2,3.2,-0.04,0.03,0.9,0.8)

# ---- Kaminarimon, the Thunder Gate: vermilion posts under a dark tiled roof, the great red lantern hanging in its
# middle, and the guardians' bays to either side
GY=-9.4
box("stone",0,GY,-0.05,0.12,1.9,0.85)
for x in (-1.7,-0.62,0.62,1.7):
    for y in (-0.65,0.65): box("red",x,GY+y,0.12,2.45,0.1,0.1)
for sx in (-1,1): box("red",sx*1.36,GY,0.12,2.0,0.3,0.62)     # the bays where the wind and thunder gods stand
for sx in (-1,1): box("black",sx*1.36,GY-0.63,0.5,1.8,0.22,0.01)  # their dark grilles
box("red",0,GY,2.2,2.45,1.85,0.75)
flared_roof([(2.35,1.35,2.45,0.26),(2.35,1.35,2.55,0.26),(1.45,0.55,2.9,0.06),(1.2,0.1,3.2,0.0)],"roof",0,GY)
box("roof",0,GY,3.15,3.28,1.25,0.12)
L=GY-1.0     # the great lantern (chochin), hung forward of the front posts under the eave so it reads at the entrance
prism("lantern",0,L,0.5,0.66,0.44,0.6,12,0); prism("lantern",0,L,0.66,1.82,0.6,0.6,12,0); prism("lantern",0,L,1.82,1.98,0.6,0.44,12,0)
prism("black",0,L,0.3,0.52,0.46,0.46,12,0); prism("black",0,L,1.96,2.18,0.46,0.46,12,0)          # its broad black rims
# its two great characters, 雷門 (Thunder Gate), in bold simplified brush strokes laid on the lantern's facets:
# u is the distance round the lantern from its front, v the height
def on_lantern(u,v,off):
    ph=-math.pi/2+u/0.6
    k=round((ph-math.pi/12)/(math.pi/6)); d=ph-(math.pi/12+k*math.pi/6)       # angle from the nearest facet's centre
    r=0.6*math.cos(math.pi/12)/math.cos(d)+off
    return (r*math.cos(ph),L+r*math.sin(ph),v)
def stroke(u0,v0,u1,v1,w=0.045):
    n=max(1,int(math.hypot(u1-u0,v1-v0)/0.07)+1)
    du,dv=u1-u0,v1-v0; ln=math.hypot(du,dv); pu,pv=-dv/ln*w/2,du/ln*w/2
    for i in range(n):
        a0,a1=i/n,(i+1)/n
        q=[(u0+du*a0-pu,v0+dv*a0-pv),(u0+du*a1-pu,v0+dv*a1-pv),(u0+du*a1+pu,v0+dv*a1+pv),(u0+du*a0+pu,v0+dv*a0+pv)]
        emit([on_lantern(u,v,-0.004) for u,v in q]+[on_lantern(u,v,0.012) for u,v in q],
             [[0,1,2,3],[7,6,5,4],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]],["black"]*6)
# 雷: the rain radical over a field
stroke(-0.25,1.71,0.25,1.71)                                          # top stroke
stroke(-0.30,1.53,-0.30,1.645); stroke(-0.30,1.645,0.30,1.645)       # the crown
stroke(0.30,1.645,0.30,1.51); stroke(0.30,1.51,0.25,1.535,0.035)
stroke(0.0,1.72,0.0,1.50)                                             # centre stroke
for su in (-1,1):                                                     # the four drops
    stroke(su*0.21,1.605,su*0.13,1.585,0.032); stroke(su*0.21,1.555,su*0.13,1.535,0.032)
stroke(-0.22,1.47,-0.22,1.30); stroke(0.22,1.47,0.22,1.30)          # the field: 田
stroke(-0.22,1.47,0.22,1.47); stroke(-0.22,1.385,0.22,1.385); stroke(-0.22,1.30,0.22,1.30)
stroke(0.0,1.47,0.0,1.30,0.038)
# 門: two leaves of a gate
for su in (-1,1):
    stroke(su*0.28,1.16,su*0.28,0.74)                                 # the posts
    stroke(su*0.28,1.16,su*0.06,1.16); stroke(su*0.06,1.16,su*0.06,0.97,0.04)
    stroke(su*0.28,1.075,su*0.06,1.075,0.035); stroke(su*0.28,0.985,su*0.06,0.985,0.035)
stroke(0.28,0.74,0.22,0.775,0.035)                                    # the hook at the foot
box("black",0,(L+GY-0.75)/2,2.18,2.3,0.05,(GY-0.75-L)/2+0.05)                         # hung from the front beam

# ---- Nakamise-dori: long rows of little shops either side of the street, vermilion shutters under green roofs,
# their fronts lit
def shops(x0,y0,y1,side,gi):
    L=(y1-y0)/2; cy=(y0+y1)/2; d=0.7
    box("white",x0,cy,-0.05,1.15,d,L)
    box("red",x0-side*(d+0.01),cy,0.05,0.95,0.02,L-0.05); box("red",x0+side*(d+0.01),cy,0.85,1.05,0.02,L-0.05)
    n=max(1,int(2*L/1.2))
    for k in range(1,n): box("roof",x0-side*(d+0.02),y0+2*L*k/n,0.0,1.15,0.03,0.05)
    box("glow_shop_%d"%gi,x0-side*(d+0.03),cy,0.6,0.9,0.01,L-0.15)
    extrude_y("roof",[(x0-d-0.3,1.12),(x0+d+0.3,1.12),(x0+d+0.3,1.2),(x0,1.6),(x0-d-0.3,1.2)],y0-0.1,y1+0.1)
gi=0
for side,x0 in ((-1,-1.85),(1,1.85)):
    for y0,y1 in ((-8.4,-6.4),(-6.1,-4.2),(-3.9,-2.6)):
        shops(x0,y0,y1,side,gi); gi+=1

# ---- Hozomon, the treasure gate: two storeys, its lower bays open, lanterns hanging, a double roof
HY=-1.0
box("stone",0,HY,-0.05,0.15,2.4,1.2)
for x in (-2.0,-0.7,0.7,2.0):
    for y in (-0.95,0.95): box("red",x,HY+y,0.15,1.95,0.12,0.12)
for sx in (-1,1): box("red",sx*1.35,HY,0.15,1.8,0.55,0.85)
box("red",0,HY,1.8,2.0,2.15,1.05)
flared_roof([(2.8,1.7,2.0,0.24),(2.8,1.7,2.1,0.24),(2.15,1.05,2.3,0.04)],"roof",0,HY)
box("red",0,HY,2.3,3.15,1.85,0.85)
box("white",0,HY-0.86,2.5,2.95,1.6,0.01)
flared_roof([(2.75,1.65,3.15,0.32),(2.75,1.65,3.25,0.32),(1.75,0.75,3.7,0.08),(1.45,0.12,4.1,0.0)],"roof",0,HY)
box("roof",0,HY,4.05,4.2,1.5,0.13)
for x in (-1.35,0.0,1.35): prism("red",x,HY-0.15,0.85,1.7,0.3,0.3,10,0); prism("black",x,HY-0.15,0.8,0.9,0.26,0.26,10,0)

# ---- the five-storey pagoda west of the gate: vermilion, dark roofs, a gilt spire
PX,PY=-6.0,4.4
box("stone",PX,PY,-0.05,0.35,1.25,1.25)
z=0.35
for i in range(5):
    b=0.82-0.06*i; r=1.45-0.07*i
    box("red",PX,PY,z,z+0.85,b,b); box("white",PX,PY,z+0.55,z+0.7,b+0.01,b+0.01)
    flared_roof([(r,r,z+0.85,0.22),(r,r,z+0.95,0.22),(b*0.85+0.1,b*0.85+0.1,z+1.15,0.05),(b-0.06,b-0.06,z+1.25,0.0)],"roof",PX,PY)
    z+=1.22
prism("gold",PX,PY,z,z+1.9,0.07,0.05,6,0)
for k in range(9): prism("gold",PX,PY,z+0.3+k*0.15,z+0.34+k*0.15,0.2-0.008*k,0.2-0.008*k,8,0)

# ---- the incense burner (jokoro) before the main hall
IX,IY=0.0,2.0
prism("bronze",IX,IY,-0.05,0.25,0.5,0.5,8,math.pi/8); prism("bronze",IX,IY,0.25,0.85,0.62,0.5,8,math.pi/8)
for a in range(4): box("bronze",IX+0.42*math.cos(a*math.pi/2+math.pi/4),IY+0.42*math.sin(a*math.pi/2+math.pi/4),0.85,1.25,0.04,0.04)
flared_roof([(0.75,0.75,1.25,0.12),(0.75,0.75,1.32,0.12),(0.1,0.1,1.7,0.0)],"bronze",IX,IY)
box("glow_incense",IX,IY,0.85,0.92,0.45,0.45)

# ---- the main hall (Hondo): vermilion on a high stone base, under a great, steep roof of dark tiles
MX,MY=0.0,6.8
box("stone",MX,MY,-0.05,0.55,3.4,2.4)
for k in range(5): box("stone",MX,MY-2.4-0.18*(k+1)+0.09,-0.05,0.55-0.11*(k+1)+0.11,1.6,0.09)   # the steps
box("red",MX,MY,0.55,2.25,2.95,2.0)
for x in [MX-2.8+0.7*k for k in range(9)]: box("red",x,MY-2.15,0.55,2.25,0.1,0.1)
box("white",MX,MY-2.01,1.6,2.1,2.7,0.02)
box("red",MX,MY-2.0,0.55,1.4,0.6,0.02)
box("glow_hall",MX,MY-2.02,0.65,1.3,0.45,0.01)
box("red",MX,MY,2.2,2.4,3.2,2.25)
flared_roof([(4.2,3.15,2.4,0.4),(4.2,3.15,2.55,0.4),(3.1,2.05,3.5,0.12),(2.4,1.2,4.6,0.05),(2.1,0.18,5.6,0.0)],"roof",MX,MY)
box("roof",MX,MY,5.55,5.75,2.2,0.16)
for sx in (-1,1): extrude_y("roof",[(MX+sx*2.15,5.55),(MX+sx*2.4,5.55),(MX+sx*2.3,6.0),(MX+sx*2.15,5.8)],MY-0.08,MY+0.08)   # ridge-end tiles

# ---- ginkgo and cherry trees round the precinct, kept clear of the axis
def tree(x,y,s,m="foliage"):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.17,-0.3,5),ngon(0.12,1.4,5,0,0.08,0)],"bark",T)
    ico(m,0,0,2.3,1.15,1.1,1.25,T); ico(m,0.6,0.3,1.75,0.7,0.65,0.7,T)
for x,y,s in [(-7.6,-3.0,1.0),(-8.6,1.2,0.95),(-8.4,7.0,1.0),(-5.4,9.6,1.0),(5.6,9.4,1.05),(7.6,4.4,1.0),(7.4,-1.6,0.95),(-7.4,-7.8,0.9),(7.6,-7.4,0.9),(5.2,1.8,0.85),(8.8,8.4,0.9),(-9.0,9.6,0.85),(4.6,-4.6,0.9),(-4.6,-5.2,0.85)]:
    tree(x,y,s)

def ground_at(x,y): return 0.0
INTERACT=(0.0,0.8)    # the court between the Hozomon and the incense burner
STAND=(2.2,1.0)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/senso-ji.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/senso-ji.json"
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
    objname=key if key.startswith("glow_") else "sensoji_"+key
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
