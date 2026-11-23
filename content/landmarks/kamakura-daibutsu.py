# Kamakura Daibutsu (the bronze Great Buddha of Kotoku-in, seated in the open before a wooded hill) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python kamakura-daibutsu.py
# Rebuilds content/landmarks/kamakura-daibutsu.blend and public/models/landmarks/kamakura-daibutsu.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/kamakura-daibutsu.glb"
BLEND=ROOT+"/content/landmarks/kamakura-daibutsu.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"bronze":"6c8d7c","bronze_dk":"3b4e45","stone":"9a958c","pave":"cfc8b8","white":"efeae0","wood":"5a4232","roof":"5d6662","foliage":"4f7a45","maple":"c2603a","hill":"55804a","bark":"4e3a30","glow_cream":"e8dcb0"}
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
rng=random.Random(27)
EXTRA_SOLIDS=[]; NOSOLID={"foliage","maple"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=9.6   # footprint half-width (the sidecar's half): a single feature, the open-air Buddha in its court
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0
def water_disc(x,y): return False

def ell(rx,ry,z,ox=0.0,oy=0.0,n=14):
    return [(ox+rx*math.cos(2*math.pi*i/n),oy+ry*math.sin(2*math.pi*i/n),z) for i in range(n)]
def tube(mat,pts,rs,n=8):
    """A bent limb through pts, each ring square to the local direction."""
    rings=[]
    for k,p in enumerate(pts):
        a=pts[max(k-1,0)]; b=pts[min(k+1,len(pts)-1)]
        d=Vector(b)-Vector(a); d.normalize()
        u=d.cross(Vector((0,0,1))) if abs(d.z)<0.95 else d.cross(Vector((1,0,0)))
        u.normalize(); w=d.cross(u)
        rings.append([tuple(Vector(p)+rs[k]*(math.cos(2*math.pi*i/n)*u+math.sin(2*math.pi*i/n)*w)) for i in range(n)])
    solid(rings,mat)

# ---- the gravel court and the stone walk to the Buddha
box("pave",0,-2.6,-0.04,0.03,6.2,6.0)
box("stone",0,-5.6,-0.04,0.05,0.8,3.0)

# ---- the Great Buddha (Amida), bronze gone green, seated in meditation on a low lotus pedestal on two granite tiers;
# he sits in the open, with the foundation stones of his long-lost hall around him
SX,SY=0.0,1.9
SK=1.32   # the statue and its plinth are drawn at unit size, then scaled about their centre
N0={m:len(v[0]) for m,v in B.items()}
box("stone",SX,SY,-0.05,0.38,3.0,2.6)
box("stone",SX,SY,0.38,0.78,2.55,2.2)
prism("bronze_dk",SX,SY-0.15,0.78,0.88,2.15,2.3,16,0)            # the lotus pedestal
prism("bronze_dk",SX,SY-0.15,0.88,0.98,2.3,2.2,16,math.pi/16)
B0=0.98
# crossed legs, wide and low, the robe falling over them
solid([ell(2.05,1.4,B0,SX,SY-0.35),ell(2.15,1.5,B0+0.3,SX,SY-0.38),ell(1.95,1.38,B0+0.65,SX,SY-0.32),ell(1.3,1.0,B0+0.85,SX,SY-0.15)],"bronze")
# torso, upright with the shoulders rounded, the robe over both of them
solid([ell(1.25,0.85,B0+0.6,SX,SY+0.2),ell(1.32,0.85,B0+1.6,SX,SY+0.2),ell(1.48,0.86,B0+2.2,SX,SY+0.22),
       ell(1.12,0.74,B0+2.55,SX,SY+0.22),ell(0.5,0.45,B0+2.78,SX,SY+0.18)],"bronze")
tube("bronze_dk",[(SX-0.75,SY-0.62,B0+2.25),(SX-0.25,SY-0.68,B0+1.75),(SX+0.2,SY-0.68,B0+1.15)],[0.05,0.05,0.05],4)   # the hem of the robe across the chest
# arms down to the lap, hands in the meditation mudra, thumbs touching
for sx in (-1,1):
    tube("bronze",[(SX+sx*1.28,SY+0.25,B0+2.15),(SX+sx*1.5,SY+0.05,B0+1.25),(SX+sx*1.05,SY-0.5,B0+0.88),(SX+sx*0.4,SY-0.78,B0+0.86)],[0.4,0.42,0.33,0.26])
box("bronze",SX,SY-0.72,B0+0.72,B0+1.0,0.55,0.32)
for sx in (-1,1): tube("bronze_dk",[(SX+sx*0.32,SY-1.0,B0+0.98),(SX+sx*0.24,SY-1.04,B0+1.22),(SX+sx*0.04,SY-1.04,B0+1.26)],[0.08,0.08,0.07],6)
# the head, large and bowed a touch forward, with its snail-shell curls, the topknot, the long ears and the urna
HX,HY,HZ=SX,SY-0.02,B0+3.38
solid([ell(0.72*math.sin(p),0.75*math.sin(p),HZ+0.84*math.cos(p),HX,HY,14) for p in [math.radians(d) for d in (172,150,120,90,62,36,14)]],"bronze")
for pd,cnt in ((26,8),(46,13),(66,16),(86,18)):                # the curls, in rows, the face left bare
    p=math.radians(pd)
    for k in range(cnt):
        a=2*math.pi*(k+0.5*(pd//20%2))/cnt
        if pd>40 and math.sin(a)<-0.5: continue
        ico("bronze_dk",HX+0.74*math.sin(p)*math.cos(a),HY+0.77*math.sin(p)*math.sin(a),HZ+0.86*math.cos(p),0.11,0.11,0.1)
ico("bronze_dk",HX,HY+0.05,HZ+0.86,0.34,0.34,0.3)               # the topknot (ushnisha)
for k in range(7): ico("bronze_dk",HX+0.3*math.cos(k*0.9),HY+0.05+0.3*math.sin(k*0.9),HZ+0.94,0.09,0.09,0.08)
for sx in (-1,1): frus("bronze",HX+sx*0.74,HY+0.02,HZ-0.72,HZ+0.12,0.07,0.16,0.06,0.2)   # the long ears
frus("bronze",HX,HY-0.7,HZ-0.32,HZ+0.03,0.09,0.06,0.04,0.05)   # the nose
for sx in (-1,1): box("bronze_dk",HX+sx*0.27,HY-0.67,HZ+0.0,HZ+0.04,0.17,0.04)   # the lowered eyes
box("bronze_dk",HX,HY-0.66,HZ-0.46,HZ-0.43,0.14,0.04)           # the mouth
ico("bronze_dk",HX,HY-0.74,HZ+0.24,0.05,0.04,0.05)               # the urna

SC={m:len(v[0]) for m,v in B.items()}
for m,(bv,bf) in B.items():
    for i in range(N0.get(m,0),len(bv)):
        x,y,z=bv[i]; bv[i]=(SX+SK*(x-SX),SY+SK*(y-SY),SK*z) if z>0.0 else (SX+SK*(x-SX),SY+SK*(y-SY),z)

# ---- the offering table before him: a pair of bronze lotus vases and the incense burner
OX,OY=0.0,-2.75
box("stone",OX,OY,-0.05,0.55,1.6,0.42)
for sx in (-1,1):
    prism("bronze_dk",OX+sx*1.15,OY,0.55,0.75,0.2,0.14,8); prism("bronze_dk",OX+sx*1.15,OY,0.75,1.25,0.14,0.26,8)
    tube("bronze_dk",[(OX+sx*1.15,OY,1.2),(OX+sx*1.15,OY,1.9)],[0.03,0.03],4)
    prism("bronze_dk",OX+sx*1.15,OY,1.85,2.05,0.08,0.28,8)        # the lotus bloom
prism("bronze_dk",OX,OY,0.55,0.95,0.3,0.42,8); box("glow_incense",OX,OY,0.95,1.0,0.3,0.3)
for a in range(4): box("bronze_dk",OX+0.33*math.cos(a*math.pi/2+math.pi/4),OY+0.33*math.sin(a*math.pi/2+math.pi/4),0.95,1.25,0.03,0.03)
flared_roof([(0.48,0.48,1.25,0.1),(0.48,0.48,1.3,0.1),(0.06,0.06,1.6,0.0)],"bronze_dk",OX,OY)

# ---- the foundation stones of the hall that a tsunami took in 1498
FS=[(x,y) for x in (-5.0,5.0) for y in (-2.2,-0.2,1.8,3.8,5.8)]+[(x,6.0) for x in (-3.3,-1.65,0.0,1.65,3.3)]
for x,y in FS: prism("stone",x,y,-0.05,0.16,0.36,0.3,7,rng.uniform(0,1))

# ---- the Niomon at the entrance: plain dark timber under a grey tiled roof
GY=-8.2
box("stone",0,GY,-0.05,0.12,2.0,0.9)
for x in (-1.75,-0.6,0.6,1.75):
    for y in (-0.6,0.6): box("wood",x,GY+y,0.12,2.15,0.1,0.1)
for sx in (-1,1):
    box("wood",sx*1.18,GY,0.12,0.4,0.55,0.62); box("white",sx*1.18,GY+0.4,0.4,1.95,0.52,0.02)  # the guardians' bays
box("wood",0,GY,1.95,2.2,1.9,0.72)
flared_roof([(2.5,1.45,2.2,0.24),(2.5,1.45,2.3,0.24),(1.5,0.55,2.75,0.05),(1.25,0.1,3.0,0.0)],"roof",0,GY)
box("roof",0,GY,2.95,3.08,1.3,0.12)

# ---- low halls round the court: the long Kangetsu-do side hall to the west, and the office by the gate
def hall(cx,cy,hx,hy,h,gi):
    box("stone",cx,cy,-0.05,0.12,hx+0.1,hy+0.1)
    box("white",cx,cy,0.12,h,hx,hy)
    n=max(2,int(2*hy/1.0))
    for k in range(n+1): box("wood",cx+hx+0.01,cy-hy+2*hy*k/n,0.12,h,0.04,0.06)
    box("wood",cx+hx+0.01,cy,0.12,0.45,0.03,hy)
    box("glow_hall_%d"%gi,cx+hx+0.02,cy,0.55,h-0.25,0.01,hy-0.3)
    flared_roof([(hx+0.55,hy+0.55,h,0.12),(hx+0.55,hy+0.55,h+0.08,0.12),(hx*0.35,hy-0.2,h+0.95,0.0)],"roof",cx,cy)
hall(-7.3,0.2,1.1,3.4,1.5,0)

# ---- the wooded hill behind him (pines and maples on a green rise) and trees round the court
def pine(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.15,-0.3,5),ngon(0.1,2.1,5,0,0.12,0)],"bark",T)
    for zc,r,dx in ((2.3,1.05,0.15),(1.75,0.8,-0.35),(2.85,0.65,0.3)):
        ico("foliage",dx,0.1,zc,r,r*0.9,r*0.42,T)
def maple(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.13,-0.3,5),ngon(0.09,1.2,5)],"bark",T)
    ico("maple",0,0,1.8,0.95,0.9,0.8,T); ico("maple",0.45,0.25,1.45,0.6,0.55,0.5,T)
box("hill",0,8.0,-0.05,0.5,8.6,1.4)
solid([rect(8.6,1.4,0.5,0,8.0),rect(8.2,0.8,1.6,0,8.4),rect(6.8,0.35,2.4,0,8.7)],"hill")
for k in range(12):
    x=-8.0+16.0*k/11+rng.uniform(-0.4,0.4)
    pine(x,7.9+rng.uniform(-0.5,0.6),rng.uniform(0.95,1.2)) if k%3 else maple(x,7.6,1.0)
for x,y,s,f in [(-5.6,5.6,1.0,pine),(5.4,5.4,1.0,maple),(6.8,2.2,0.95,pine),(-8.4,-5.0,0.9,pine),(-5.6,-7.5,0.85,maple),
                (8.2,-1.6,0.9,maple),(7.8,-7.8,0.85,pine),(-8.5,4.6,0.9,maple),(5.4,-6.6,0.9,maple),(3.4,-7.7,0.8,pine),(-3.4,-7.7,0.8,pine),(7.2,-4.6,0.85,pine)]:
    f(x,y,s)

def ground_at(x,y): return 0.0
INTERACT=(0.0,-3.7)   # before the offering table
STAND=(1.8,-4.4)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/kamakura-daibutsu.json and read by the world layer (see docs/landmarks.md).
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
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/kamakura-daibutsu.json"
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
    objname=key if key.startswith("glow_") else "daibutsu_"+key
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
