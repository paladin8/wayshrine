# Izumo Taisha (the Kagura-den and its giant shimenawa, the tall taisha-zukuri honden with its crossed chigi, Yakumo-yama behind) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python izumo-taisha.py
# Rebuilds content/landmarks/izumo-taisha.blend and public/models/landmarks/izumo-taisha.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/izumo-taisha.glb"
BLEND=ROOT+"/content/landmarks/izumo-taisha.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"wood":"6b4a32","roof":"6f9a8a","barkroof":"6e5444","straw":"d9c07a","strawdk":"a88f52","white":"f0ede6","stone":"9a958c","pave":"cdc8bc","bronze":"5f6a55","pine":"3a6338","bark":"4e3a30","glow_cream":"e8dcb0"}
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
rng=random.Random(37)
EXTRA_SOLIDS=[]; NOSOLID={"pine"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the Kagura-den and the great hall under the mountain
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0
def water_disc(x,y): return False

def tube(mat,pts,rs,n=6):
    rings=[]
    for k,p in enumerate(pts):
        a=pts[max(k-1,0)]; b=pts[min(k+1,len(pts)-1)]
        d=Vector(b)-Vector(a); d.normalize()
        u=d.cross(Vector((0,0,1))) if abs(d.z)<0.95 else d.cross(Vector((1,0,0)))
        u.normalize(); w=d.cross(u)
        rings.append([tuple(Vector(p)+rs[k]*(math.cos(2*math.pi*i/n)*u+math.sin(2*math.pi*i/n)*w)) for i in range(n)])
    solid(rings,mat)

# ---- the gravel approach, a bronze torii, pines along it, the court before the halls
box("pave",0,-7.6,-0.04,0.03,1.15,3.6)
box("pave",0,0.6,-0.04,0.03,4.4,4.6)
for sx in (-1,1): prism("bronze",sx*1.45,-8.8,-0.05,2.9,0.13,0.12,10)
box("bronze",0,-8.8,2.25,2.37,1.75,0.08); box("bronze",0,-8.8,2.8,2.95,2.0,0.13)
for sx in (-1,1): box("bronze",sx*2.05,-8.8,2.92,3.02,0.06,0.15)

# ---- the Kagura-den: dark timber under a great copper gable, and under its front eave the giant shimenawa,
# thick as a tree, twisted, hung with three huge straw tassels and paper streamers
KX,KY=0.0,-1.6
box("stone",KX,KY,-0.05,0.3,3.0,2.2)
box("wood",KX,KY+0.4,0.3,2.3,2.7,1.5)
for x in (-2.6,-1.3,0.0,1.3,2.6): prism("wood",KX+x,KY-1.75,0.3,2.45,0.12,0.12,8)
for sx in (-1,1): prism("wood",KX+sx*2.85,KY-2.45,0.3,2.5,0.11,0.11,8); box("wood",KX+sx*2.85,KY-2.1,2.32,2.45,0.08,0.4)
box("wood",KX,KY-1.75,2.25,2.5,2.75,0.15)
box("glow_kagura",KX,KY-1.1,0.5,2.0,2.2,0.01)
flared_roof([(3.5,2.75,2.5,0.2),(3.5,2.75,2.62,0.2),(2.8,2.05,3.2,0.04),(2.6,1.85,3.3,0.0)],"roof",KX,KY)
extrude_y("roof",[(-2.25,3.1),(-1.1,3.95),(0,4.75),(1.1,3.95),(2.25,3.1),(2.05,3.05),(1.0,3.8),(0,4.5),(-1.0,3.8),(-2.05,3.05)],KY-2.3,KY+2.2)
extrude_y("wood",[(-2.0,3.12),(2.0,3.12),(0,4.5)],KY-2.12,KY-2.0)
extrude_y("strawdk",[(-0.2,3.9),(0.2,3.9),(0,4.35)],KY-2.33,KY-2.37)
for sy in (-1,1): 
    for sx in (-1,1): tube("roof",[(KX+sx*0.75,KY+sy*2.25,4.15),(KX-sx*0.22,KY+sy*2.25,5.25)],[0.06,0.06],4)
RY=KY-2.45; RL=2.6
P=[(KX+x,RY,1.9-0.18*(1-(x/RL)**2)) for x in [-RL+2*RL*k/14 for k in range(15)]]
R=[0.18+0.55*(1-(x/RL)**2)**0.8 for x in [-RL+2*RL*k/14 for k in range(15)]]
tube("straw",P,R,10)
for j in range(3):                                            # the strands' twist
    pts=[]; rs=[]
    for k in range(29):
        x=-RL+0.15+2*(RL-0.15)*k/28; r=0.18+0.55*(1-(x/RL)**2)**0.8; a=2.6*x+j*2*math.pi/3
        z=1.9-0.18*(1-(x/RL)**2)
        pts.append((KX+x,RY+r*0.97*math.cos(a),z+r*0.97*math.sin(a))); rs.append(0.045+0.02*r)
    tube("strawdk",pts,rs,4)
for x in (-1.3,0.0,1.3):                                      # the hanging tassels (komo)
    zt=1.9-0.18*(1-(x/RL)**2)-0.25
    zt-=0.15; prism("straw",KX+x,RY,zt-1.0,zt,0.42,0.14,10); prism("strawdk",KX+x,RY,zt-1.08,zt-0.98,0.44,0.42,10)
    prism("strawdk",KX+x,RY,zt-0.25,zt-0.15,0.18,0.17,8)
for x in (-1.95,-0.65,0.65,1.95):                             # shide, the zigzag paper streamers
    zt=1.9-0.18*(1-(x/RL)**2)-0.3
    for k in range(3): box("white",KX+x+(0.06 if k%2 else -0.06),RY-0.02,zt-0.25*(k+1),zt-0.25*k,0.07,0.01)

# ---- the main hall (honden), taisha-zukuri: tall on its posts, a steep bark-thatched gable facing us, huge crossed
# chigi and three katsuogi, the roofed stair at its right, inside its fence and gate
HX,HY=0.4,5.8; F=2.1
for x in (-1.15,0.0,1.15):
    for y in (-1.15,0.0,1.15): prism("wood",HX+x,HY+y,-0.05,F,0.12 if (x or y) else 0.2,0.12 if (x or y) else 0.2,8)
box("wood",HX,HY,F-0.1,F,1.65,1.65)
for k in range(9):
    t=-1.6+0.4*k; box("wood",HX+t,HY-1.6,F,F+0.4,0.03,0.03); box("wood",HX-1.6,HY+t,F,F+0.4,0.03,0.03)
box("wood",HX,HY-1.6,F+0.35,F+0.41,1.62,0.03); box("wood",HX-1.6,HY,F+0.35,F+0.41,0.03,1.62); box("wood",HX+1.6,HY,F+0.35,F+0.41,0.03,1.62)
box("wood",HX,HY,F,F+2.05,1.25,1.25)
box("white",HX-0.35,HY-1.26,F+0.2,F+1.5,0.4,0.01)
E=F+1.9; RZ=F+4.4
prof=[(-2.0,E),(-1.35,E+0.85),(-0.7,E+1.7),(0.0,RZ),(0.7,E+1.7),(1.35,E+0.85),(2.0,E)]
extrude_y("barkroof",prof+[(x*0.92,z-0.28) for x,z in reversed(prof)],HY-1.9,HY+1.9)
extrude_y("wood",[(-1.25,F+2.05),(1.25,F+2.05),(0,RZ-0.3)],HY-1.26,HY+1.26)
box("barkroof",HX,HY,RZ-0.12,RZ+0.12,0.22,1.95)
for y in (-0.9,0.0,0.9): tube("wood",[(HX-0.32,HY+y,RZ+0.22),(HX+0.32,HY+y,RZ+0.22)],[0.09,0.09],6)
for sy in (-1,1):
    for sx in (-1,1): tube("wood",[(HX+sx*1.95,HY+sy*1.92,E),(HX-sx*0.55,HY+sy*1.92,RZ+1.25)],[0.08,0.08],4)
# its roofed stair, up the right of the front
for k in range(6): box("wood",HX+0.75,HY-2.9+0.22*k,-0.05,F*(k+1)/6,0.32,0.11)
for sx in (-1,1): prism("wood",HX+0.75+sx*0.38,HY-3.0,-0.05,F+1.2,0.05,0.05,6)
extrude_y("barkroof",[(HX+0.2,F+1.15),(HX+0.75,F+1.55),(HX+1.3,F+1.15),(HX+1.2,F+1.08),(HX+0.75,F+1.42),(HX+0.3,F+1.08)],HY-3.2,HY-1.6)
# the fence round it and its gate
FX0,FX1,FY0,FY1=HX-2.7,HX+2.7,HY-3.6,HY+2.6
for (ax,ay),(bx,by) in (((FX0,FY0),(HX-0.9,FY0)),((HX+0.9,FY0),(FX1,FY0)),((FX1,FY0),(FX1,FY1)),((FX0,FY1),(FX1,FY1)),((FX0,FY0),(FX0,FY1))):
    box("wood",(ax+bx)/2,(ay+by)/2,-0.05,1.1,max(0.05,abs(bx-ax)/2),max(0.05,abs(by-ay)/2))
for sx in (-1,1): prism("wood",HX+sx*0.85,FY0,-0.05,1.9,0.1,0.1,8)
box("wood",HX,FY0,1.75,1.9,1.0,0.12)
extrude_x("barkroof",[(FY0-0.55,1.85),(FY0,2.35),(FY0+0.55,1.85),(FY0+0.45,1.78),(FY0,2.2),(FY0-0.45,1.78)],HX-1.25,HX+1.25)

# ---- Yakumo-yama behind, dark with forest; pines along the approach; lanterns
for c,rx,ry,rz in [((-7.4,8.8),2.8,1.9,3.0),((-3.2,9.5),2.2,1.5,3.6),((4.6,9.4),2.6,1.6,3.3),((8.4,8.0),2.2,2.0,2.6),((-9.0,4.8),1.8,2.2,2.3)]:
    ico("pine",c[0],c[1],-0.2,rx,ry,rz); ico("pine",c[0]+0.6,c[1]-0.4,1.4,rx*0.6,ry*0.6,rz*0.6)
def pine(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    tube("bark",[(x,y,-0.3),(x+0.3*s,y,1.4*s),(x+0.1*s,y+0.25*s,2.6*s)],[0.17*s,0.14*s,0.1*s],5)
    for zc,r,dx,dy in ((2.7,1.15,0.2,0.2),(2.0,0.85,-0.55,-0.1),(3.25,0.7,0.35,0.3)): ico("pine",dx,dy,zc,r,r*0.9,r*0.4,T)
def shrub(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    ico("pine",0,0,0.5,0.85,0.75,0.55,T); ico("pine",0.45,0.2,0.38,0.55,0.5,0.4,T)
for x,y,s in [(-3.0,-9.8,0.9),(-3.2,-7.4,1.0),(-4.0,-4.8,1.0),(-6.6,-2.0,1.05),(-7.2,2.6,1.0),(-5.6,6.8,0.95),(3.0,-9.8,0.85),(6.8,2.0,1.0),(7.0,5.8,0.95),(9.0,-0.6,0.9)]:
    pine(x,y,s)
for x,y,s in [(3.0,-6.6,0.9),(5.4,-4.4,1.0),(7.4,-7.6,0.9),(4.6,-9.0,0.85),(8.6,-4.0,0.9),(-6.0,-8.0,0.9),(-8.6,-5.2,0.9)]:
    shrub(x,y,s)
for k,y in enumerate((-6.2,-10.4)):
    for sx in (-1,1):
        x=sx*1.55; box("stone",x,y,-0.05,0.5,0.1,0.1); box("stone",x,y,0.5,0.56,0.18,0.18)
        box("glow_lantern_%d_%d"%(k,sx+1),x,y,0.56,0.8,0.12,0.12); flared_roof([(0.25,0.25,0.8,0.04),(0.25,0.25,0.85,0.04),(0.03,0.03,1.05,0.0)],"stone",x,y)

def ground_at(x,y): return 0.0
INTERACT=(0.0,-4.9)   # under the shimenawa, before the Kagura-den
STAND=(0.5,-5.4)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/izumo-taisha.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/izumo-taisha.json"
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
    objname=key if key.startswith("glow_") else "izumo_"+key
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
