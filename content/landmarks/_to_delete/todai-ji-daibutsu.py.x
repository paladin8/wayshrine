# the Great Buddha of Nara (Todai-ji Daibutsuden) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python todai-ji-daibutsu.py
# Rebuilds content/landmarks/todai-ji-daibutsu.blend and public/models/landmarks/todai-ji-daibutsu.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
GLB=ROOT+"/public/models/landmarks/todai-ji-daibutsu.glb"
BLEND=ROOT+"/content/landmarks/todai-ji-daibutsu.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"vermilion":"d96b59","roof":"2a2424","stone":"a39e98","cream":"e8dcb0","wood":"d1ab80","foliage":"5f9a52","darkwood":"6e5442","bronze":"5e5244","gold":"e2b34c","glow_cream":"e8dcb0","glow_gold":"e2b34c"}
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
rng=random.Random(3)
H=lambda x,y: 0.0
FLOORS=[]   # (x0,x1,y0,y1,top): surfaces the player walks on, for the game sidecar
EXTRA_SOLIDS=[]   # [x, y, r] in Blender coordinates: blockers not covered by geometry
GLOWMAT={"glow_halo":"glow_gold"}
def ell(rx,ry,z,n=8,ox=0.0,oy=0.0,ph=math.pi/8):
    return [(ox+rx*math.cos(ph+2*math.pi*i/n), oy+ry*math.sin(ph+2*math.pi*i/n), z) for i in range(n)]

# The terrain supplies the grass under the courtyard and along its edges.
# ---- courtyard: gravel, stone path on the axis
box("cream",0,-5.4,-0.05,0.02,7.0,4.0)
box("stone",0,-6.0,-0.05,0.045,0.9,3.4)

# ---- Daibutsuden (Great Buddha Hall)
KW=3.0   # half-width of the curved gable (karahafu) lifted into the front eave
def kara(x,bm): return bm*max(0.0,math.cos(0.5*math.pi*min(1.0,abs(x)/KW)))**1.3
def roof_rings(spec,ox,oy,bump,rec=None):
    sg=[(-1,-1),(1,-1),(1,1),(-1,1)]; TS=[i/8 for i in range(8)]
    rings=[]
    rec=rec or [0.0]*len(spec)
    for (hx,hy,z,lift),bm,rc in zip(spec,bump,rec):
        cs=[(-hx,-hy),(hx,-hy),(hx,hy),(-hx,hy)]; r=[]
        for k in range(4):
            (x0,y0),(x1,y1)=cs[k],cs[(k+1)%4]
            for t in TS:
                x=x0+(x1-x0)*t; y=y0+(y1-y0)*t
                if t==0.0: x+=sg[k][0]*0.45*lift; y+=sg[k][1]*0.45*lift
                zz=z+lift*abs(2*t-1)**2.5
                if k==0 and t>0: zz+=kara(x,bm); y+=kara(x,rc)     # the curved gable, cut back over the Buddha
                r.append((ox+x,oy+y,zz))
        rings.append(r)
    return rings
def flared_roof_b(spec,mat,ox,oy,bump,rec=None):
    """flared_roof with the front eave lifted into a curved gable (karahafu) over the middle;
    bump[i] is the extra lift of ring i at the front centre."""
    rings=roof_rings(spec,ox,oy,bump,rec)
    n=len(rings[0]); verts=[p for r in rings for p in r]; faces=[]
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

box("stone",0,2.6,-0.05,0.5,6.0,4.0)                 # platform (kidan), y -1.4..6.6
FLOORS.append((-6.0,6.0,-1.4,6.6,0.5))
for i in range(3):
    y0=-2.6+0.4*i; top=0.5*(i+1)/3
    box("stone",0,(y0-1.4)/2,-0.05,top,2.0,(-1.4-y0)/2,mt="cream")
    FLOORS.append((-2.0,2.0,y0,-1.4,top))
BAY=10.0/7; COLX=[-5.0+BAY*k for k in range(8)]      # seven bays; the middle three stand open
OPEN=COLX[5]                                          # half-width of the opening (2.14)
for sx in (-1,1):
    box("cream",sx*(OPEN+5.0)/2,3.075,0.5,6.0,(5.0-OPEN)/2,2.925)   # side blocks of the hall body
    box("darkwood",sx*(OPEN-0.04),1.575,0.5,6.0,0.06,1.43)          # dark lining inside the opening
box("darkwood",0,4.5,0.5,6.0,OPEN,1.5)                # back wall behind the Buddha
for k in (0,1,2,5,6,7): box("darkwood",COLX[k],0.1,0.5,5.95,0.13,0.13)
for xc in (-4.29,-2.86,2.86,4.29):
    box("darkwood",xc,0.11,0.5,2.6,0.55,0.04)         # doors
    box("darkwood",xc,0.11,3.9,5.0,0.55,0.04)         # lattice windows
# skirt roof (mokoshi) around the body, interrupted by the opening
for sx in (-1,1):
    x0,x1=sorted((sx*OPEN,sx*5.85))
    extrude_x("roof",[(-0.75,2.9),(0.15,3.48),(0.15,3.6),(-0.75,3.02)],x0,x1)
    extrude_y("roof",[(sx*5.85,2.9),(sx*5.0,3.48),(sx*5.0,3.6),(sx*5.85,3.02)],-0.75,6.85)
extrude_x("roof",[(6.85,2.9),(6.0,3.48),(6.0,3.6),(6.85,3.02)],-5.85,5.85)
# main roof: wide and flared, its front eave lifted into a gilded curved gable (karahafu) over the opening,
# high enough that the game camera sees the Buddha's face beneath it; gilded shibi on the ridge
# The front eave is also cut back over the opening, so the face and the raised hand read together from the approach
RSPEC=[(6.0,3.9,5.9,0.4),(6.0,3.9,6.05,0.4),(5.2,3.1,6.4,0.15),(3.6,0.28,7.6,0.0)]; RBUMP=[2.0,2.0,1.0,0.0]; RREC=[1.7,1.7,0.6,0.0]
flared_roof_b(RSPEC,"roof",0.0,3.0,RBUMP,RREC)
eave=[p for p in roof_rings(RSPEC,0.0,3.0,RBUMP,RREC)[0][1:8] if abs(p[0])<=KW+0.01]
solid([[(x,y-0.07,z-0.06),(x,y+0.06,z-0.06),(x,y+0.06,z+0.17),(x,y-0.07,z+0.17)] for x,y,z in eave],"gold")
box("roof",0,3.0,7.53,7.76,3.75,0.2)
for sx in (-1,1):
    extrude_x("gold",[(2.72,7.7),(3.28,7.7),(3.32,7.95),(3.12,8.17),(2.96,7.97),(2.74,8.08)],sx*3.6-0.08,sx*3.6+0.08)

# ---- the Great Buddha (Vairocana), seated on a lotus pedestal just inside the opening
prism("bronze",0,1.0,0.5,0.8,1.95,1.9,8,math.pi/8)
prism("gold",0,1.0,0.8,1.25,1.7,1.95,8,0.0)          # lotus petals
T=dict(cx=0,cy=1.0,cz=1.25,s=0.9)
solid([ell(2.0,1.35,0.0,8,0,-0.15),ell(1.95,1.3,0.75,8,0,-0.15),ell(1.5,1.0,1.0,8,0,-0.05)],"bronze",T)   # crossed legs
solid([ell(1.3,0.85,0.8,8,0,0.2),ell(1.4,0.88,2.35,8,0,0.2),ell(0.75,0.55,2.8,8,0,0.25)],"bronze",T)    # robed body and shoulders
prism("bronze",0,0.25,2.75,3.05,0.5,0.5,8,0,T)
solid([ell(0.75,0.75,2.95,8,0,0.12),ell(0.95,0.95,3.45,8,0,0.12),ell(0.92,0.92,3.95,8,0,0.15)],"bronze",T)  # face
solid([ell(0.98,0.98,3.85,8,0,0.17),ell(0.95,0.95,4.35,8,0,0.2),ell(0.66,0.66,4.7,8,0,0.22)],"roof",T)       # curled hair
solid([ell(0.52,0.52,4.62,8,0,0.22),ell(0.46,0.46,4.95,8,0,0.22),ell(0.18,0.18,5.12,8,0,0.22)],"roof",T)     # ushnisha
for sx in (-1,1): box("bronze",sx*0.98,0.15,3.05,4.0,0.07,0.16,T)     # long earlobes
solid([rect(0.18,0.18,1.6,-1.3,0.05),rect(0.16,0.16,2.45,-1.35,-0.45)],"bronze",T)   # right forearm, raised
box("bronze",-1.35,-0.52,2.4,3.05,0.22,0.08,T)                                        # open palm
solid([rect(0.17,0.17,1.7,1.3,0.1),rect(0.16,0.16,0.95,1.25,-0.75)],"bronze",T)      # left forearm on the knee
box("bronze",1.25,-1.0,0.85,1.05,0.26,0.2,T)
for x in [OPEN*(-1+2*i/10) for i in range(11)]: EXTRA_SOLIDS.append([x,0.0,0.3])   # keep the player out of the hall

# ---- great bronze octagonal lantern on the axis
LX,LY=0.0,-4.4
prism("stone",LX,LY,-0.05,0.25,0.75,0.75,8,math.pi/8)
prism("stone",LX,LY,0.25,0.45,0.55,0.5,8,math.pi/8)
prism("bronze",LX,LY,0.45,1.5,0.2,0.18,8,math.pi/8)
prism("bronze",LX,LY,1.5,1.65,0.55,0.55,8,math.pi/8)
prism("glow_lantern_1",LX,LY,1.65,2.35,0.45,0.45,8,math.pi/8)
solid([ngon(0.85,2.35,8,math.pi/8,LX,LY),ngon(0.85,2.45,8,math.pi/8,LX,LY),ngon(0.2,2.85,8,math.pi/8,LX,LY)],"bronze")
bipyr("bronze",LX,LY,3.0,0.14,2.85,3.25,6)

# ---- stone lanterns (fire boxes are separate glow_ objects)
def lantern(cx,cy,idx):
    T=dict(cx=cx,cy=cy)
    box("stone",0,0,-0.05,0.22,0.4,0.4,T)
    prism("stone",0,0,0.22,1.3,0.17,0.15,6,0,T)
    box("stone",0,0,1.3,1.48,0.38,0.38,T)
    box("glow_lantern_%d"%idx,0,0,1.48,1.92,0.27,0.27,T)
    solid([rect(0.62,0.62,1.92),rect(0.62,0.62,2.0),rect(0.14,0.14,2.3)],"stone",T)
    bipyr("stone",0,0,2.38,0.11,2.28,2.56,6,T)
lantern(-4.6,-6.4,2); lantern(4.6,-6.4,3)

# ---- cloisters (kairo) along both sides of the courtyard
for sx in (-1,1):
    x=sx*7.6; L=(9.1-1.2)/2; yc=-(9.1+1.2)/2
    box("stone",x,yc,-0.05,0.15,0.6,L)
    box("cream",sx*8.1,yc,0.15,1.9,0.08,L)
    for k in range(7):
        y=-9.0+k*1.3; box("vermilion",sx*7.15,y,0.15,1.95,0.1,0.1); box("vermilion",sx*8.1,y,0.15,1.95,0.11,0.11)
    box("vermilion",sx*7.15,yc,1.85,2.0,0.1,L)
    x0,x1=sorted((sx*6.85,sx*8.35))
    extrude_y("roof",[(x0,1.95),(x1,1.95),(x1,2.07),(x,2.6),(x0,2.07)],-9.1,-1.2)
    for k in range(21): EXTRA_SOLIDS.append([x,-9.0+k*0.39,0.5])

# ---- trees behind and beside the hall
def conifer(cx,cy,s,ph=0):
    g=H(cx,cy); T=dict(cx=cx,cy=cy,cz=g,s=s)
    prism("wood",0,0,-0.3,0.9,0.2,0.18,6,ph,T)
    cone("foliage",ngon(1.15,0.7,7,ph),(0,0,2.3),T)
    cone("foliage",ngon(0.9,1.6,7,ph+0.4),(0,0,3.1),T)
    cone("foliage",ngon(0.62,2.4,7,ph+0.8),(0,0,3.85),T)
def roundtree(cx,cy,s):
    g=H(cx,cy); T=dict(cx=cx,cy=cy,cz=g,s=s)
    prism("wood",0,0,-0.3,1.3,0.22,0.18,6,0,T)
    ico("foliage",0,0,2.15,1.25,1.25,1.05,T)
    ico("foliage",0.55,-0.35,1.6,0.8,0.8,0.65,T)
def bush(cx,cy,s):
    ico("foliage",0,0,0.3,0.75,0.75,0.55,dict(cx=cx,cy=cy,cz=H(cx,cy),s=s))
for a in [(-8.0,7.4,1.0,0),(-8.2,3.0,0.9,0.4),(4.6,8.2,0.95,0.2),(-5.0,8.3,0.9,0.7)]: conifer(*a)
for a in [(8.0,5.5,0.9),(8.4,1.6,0.8),(1.4,8.6,0.8)]: roundtree(*a)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/todai-ji-daibutsu.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=9.6; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y):
    h=0.0
    for x0,x1,y0,y1,top in FLOORS:
        if x0<=x<=x1 and y0<=y<=y1: h=max(h,top)
    return h
ground=[[round(ground_at(-HALF+GSTEP*ix, -(-HALF+GSTEP*iz)),3) for ix in range(GN)] for iz in range(GN)]
CELL=0.3
cellg={}
def cg(cx,cy):
    k=(cx,cy)
    if k not in cellg: cellg[k]=ground_at(-HALF+CELL*(cx+0.5), -HALF+CELL*(cy+0.5))
    return cellg[k]
# Solids baked from the geometry: anything in a band 0.35..1.6 above the local ground (cells over Blender x, y).
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
                    cx=int((x+HALF)/CELL); cy=int((y+HALF)/CELL)
                    g=cg(cx,cy)
                    if z<g+BAND0 or z>g+BAND1: continue
                    if nz>0.92 and z<g+0.6: continue   # flat ground-level surfaces
                    solid_cells.add((cx,cy))
solids=[[round(-HALF+CELL*(cx+0.5),2), round(-(-HALF+CELL*(cy+0.5)),2), 0.22] for cx,cy in sorted(solid_cells)]
solids+=[[round(x,2),round(-y,2),r] for x,y,r in EXTRA_SOLIDS]
INTERACT=(0.0,-3.0)   # in front of the hall steps, past the bronze lantern
STAND=(0.0,-8.8)      # the courtyard entrance on the axis
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]],
      "terrainSurface":True}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/todai-ji-daibutsu.json"
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
    matname=GLOWMAT.get(key,"glow_cream") if key.startswith("glow_") else key
    objname=key if key.startswith("glow_") else "todaiji_"+key
    me=bpy.data.meshes.new(objname); me.from_pydata(vs,[],fs); me.validate(); me.update()
    for p in me.polygons: p.use_smooth=False
    me.materials.append(getmat(matname))
    ob=bpy.data.objects.new(objname,me); col.objects.link(ob)
    stats[objname]=sum(len(p.vertices)-2 for p in me.polygons)
    allv+= [v.co.copy() for v in me.vertices]
# ---- Nara deer, with separate pivots for the neck, legs and tail
FPS=24
DEER_END=38*FPS+1
HOOF_HEIGHT=0.023
LEG_LENGTH=0.44
def empty(name, parent=None, location=(0,0,0)):
    obj=bpy.data.objects.new(name,None)
    col.objects.link(obj)
    obj.parent=parent
    obj.location=location
    return obj

def deer_part(pivot, draw):
    # Keep moving geometry out of the static mesh buckets and the solid sidecar.
    global B
    landmark=B
    B={}
    draw()
    for material,(vs,fs) in B.items():
        name=pivot.name+"_"+material
        me=bpy.data.meshes.new(name)
        me.from_pydata(vs,[],fs)
        me.materials.append(getmat(material))
        obj=bpy.data.objects.new(name,me)
        col.objects.link(obj)
        obj.parent=pivot
        stats[name]=sum(len(face)-2 for face in fs)
    B=landmark

def tilt(obj,axis,angle,frame):
    obj.rotation_euler[axis]=math.radians(angle)
    obj.keyframe_insert(data_path="rotation_euler",index=axis,frame=frame)

def idle_pose(obj,axis,frames,offsets):
    for offset in offsets:
        for frame,angle in frames:
            tilt(obj,axis,angle,frame+offset)
    tilt(obj,axis,0,1)
    tilt(obj,axis,0,DEER_END)

def walk(body,legs,start,origin,destination,yaw):
    # Turn, then stroll for less than three seconds. The diagonal legs move
    # out of phase, and the stance portion of each step keeps the hoof down.
    heading=math.atan2(destination[1]-origin[1],destination[0]-origin[0])
    heading=yaw+math.remainder(heading-yaw,math.tau)
    first=start+16
    duration=64
    body.rotation_euler.z=yaw
    body.keyframe_insert(data_path="rotation_euler",index=2,frame=start)
    body.rotation_euler.z=heading
    body.keyframe_insert(data_path="rotation_euler",index=2,frame=first)

    distance=math.dist(origin,destination)
    strides=round(distance/0.50)
    stance_distance=0.6*distance/(strides*body.scale.x)
    for elapsed in range(0,duration+1,2):
        t=elapsed/duration
        ease=t*t*(3-2*t)
        frame=first+elapsed
        body.location.x=origin[0]+(destination[0]-origin[0])*ease
        body.location.y=origin[1]+(destination[1]-origin[1])*ease
        body.keyframe_insert(data_path="location",frame=frame)
        ramp=min(1,ease*12,(1-ease)*12)
        for leg,height,offset in legs:
            phase=(strides*ease+offset)%1
            # Through stance the foot travels backward relative to the body.
            # Return it forward through a lifted swing over the last 40%.
            swing=max(0,(phase-0.6)/0.4)
            stride=(0.5-phase/0.6) if phase<0.6 else (-0.5+swing)
            angle=-math.asin(stride*ramp*stance_distance/LEG_LENGTH)
            lift=0.09*math.sin(math.pi*swing)*ramp
            tilt(leg,1,math.degrees(angle),frame)
            leg.location.z=height+lift-LEG_LENGTH*(1-math.cos(angle))
            leg.keyframe_insert(data_path="location",index=2,frame=frame)
    return heading

def deer(index,home,rot,scale,offset,stop,outbound,returning):
    body=empty(f"deer_{index}",location=(*home,HOOF_HEIGHT))
    body.rotation_euler.z=rot
    body.scale=(scale,)*3
    body["collisionRadius"]=0.26
    body["collisionHalfLength"]=0.28

    def draw_body():
        box("wood",0,0,0.42,0.74,0.38,0.15)

    def draw_head():
        solid([rect(0.08,0.08,0),rect(0.06,0.06,0.33,0.18,0)],"wood")
        box("wood",0.28,0,0.30,0.44,0.14,0.07)
        for sy in (-1,1):
            cone("wood",rect(0.03,0.025,0.43,0.22,sy*0.05),(0.18,sy*0.17,0.55))

    deer_part(body,draw_body)
    neck=empty(body.name+"_neck",body,(0.32,0,0.62))
    tail=empty(body.name+"_tail",body,(-0.36,0,0.68))
    deer_part(neck,draw_head)
    deer_part(tail,lambda: box("cream",-0.06,0,-0.08,0.04,0.08,0.06))
    legs=[]
    for name,x,y,phase in [("front_left",0.27,-0.09,0),("front_right",0.27,0.09,0.5),
                           ("hind_left",-0.27,-0.09,0.75),("hind_right",-0.27,0.09,0.25)]:
        leg=empty(body.name+"_"+name,body,(x,y,LEG_LENGTH))
        deer_part(leg,lambda: box("wood",0,0,-LEG_LENGTH,0.02,0.045,0.045))
        legs.append((leg,LEG_LENGTH,phase))

    pauses=(outbound*FPS+90,) if offset is None else (offset,outbound*FPS+90)
    idle_pose(neck,1,[(20,0),(38,12),(58,65),(70,59),(82,66),(108,0),(140,-7),(164,0)],pauses)
    idle_pose(legs[0][0],1,[(36,0),(50,-22),(67,-12),(89,0)],pauses)
    idle_pose(tail,2,[(15,0),(26,24),(35,-20),(46,0),(120,0),(132,-25),(144,22),(156,0)],pauses)
    for frame in (1,DEER_END):
        body.keyframe_insert(data_path="location",frame=frame)
        body.keyframe_insert(data_path="rotation_euler",index=2,frame=frame)
        for leg,_,_ in legs:
            tilt(leg,1,0,frame)
            leg.keyframe_insert(data_path="location",index=2,frame=frame)

    heading=walk(body,legs,outbound*FPS,home,stop,rot)
    heading=walk(body,legs,returning*FPS,stop,home,heading)
    body.keyframe_insert(data_path="rotation_euler",index=2,frame=returning*FPS+80)
    body.rotation_euler.z=heading+math.remainder(rot-heading,math.tau)
    body.keyframe_insert(data_path="rotation_euler",index=2,frame=returning*FPS+100)
    body.keyframe_insert(data_path="rotation_euler",index=2,frame=DEER_END)

scene=bpy.context.scene
scene.render.fps=FPS
scene.frame_end=DEER_END
# Separate routes keep the deer clear of one another, the lanterns and the stairs.
routes=[
    ((2.8,-5.8),2.5,1,None,(2.4,-7.25),4,24),
    ((-3.2,-3.4),0.4,1,34,(-4.9,-3.7),12,29),
    ((3.9,-2.4),-2.2,0.9,65,(5.65,-3.5),16,33),
    ((-2.4,-7.4),-0.9,0.95,20,(-2.9,-8.55),10,21),
]
for index,args in enumerate(routes,1):
    deer(index,*args)
scene.frame_set(1)
mn=[min(v[i] for v in allv) for i in range(3)]; mx=[max(v[i] for v in allv) for i in range(3)]
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', export_yup=True, export_apply=True,
    export_cameras=False, export_lights=False, export_extras=True, export_animations=True, export_animation_mode='SCENE', export_materials='EXPORT')
res={"tris":sum(stats.values()),"per_obj":stats,"materials":len(bpy.data.materials),"min":[round(v,3) for v in mn],"max":[round(v,3) for v in mx],"glb_bytes":os.path.getsize(GLB)}
json.dump(res,open("/tmp/lm_build.json","w"))
