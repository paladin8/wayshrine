# Horyu-ji (the Sai-in: middle gate, cloister, Golden Hall and five-storey pagoda) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python horyu-ji.py
# Rebuilds content/landmarks/horyu-ji.blend and public/models/landmarks/horyu-ji.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/horyu-ji.glb"
BLEND=ROOT+"/content/landmarks/horyu-ji.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"darkwood":"4a3426","timber":"8a5f3e","snow":"f1f4f6","tile":"6a625c","stone":"a39e98","sand":"e3d3a1","foliage":"5f9a52","blossom":"f2b6c4","wood":"d1ab80","bronze":"6f6650","glow_cream":"e8dcb0"}
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

def flared_roof(spec,mat="tile",ox=0.0,oy=0.0):
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
rng=random.Random(30)
H=lambda x,y: 0.0   # flat grounds; the game's terrain draws the grass (terrainSurface)
EXTRA_SOLIDS=[]

def irimoya(cx,cy,spec,gx,gy,zg0,zg1):
    """Hip-and-gable roof: a flared hip roof plus the dark gable boards under the ridge ends (ridge along x)."""
    flared_roof(spec,"tile",cx,cy)
    for sx in (-1,1):
        extrude_x("darkwood",[(cy-gy,zg0),(cy+gy,zg0),(cy,zg1)],cx+sx*gx-0.03,cx+sx*gx+0.03)
def posts(cx,cy,hx,hy,z0,z1,nx,ny,r=0.06):
    # dark posts round a white-walled storey, on the faces the game camera sees (front -y, right +x) and the corners
    for k in range(nx+1):
        x=cx-hx+2*hx*k/nx; box("darkwood",x,cy-hy-0.02,z0,z1,r,r)
    for k in range(1,ny+1):
        y=cy-hy+2*hy*k/ny; box("darkwood",cx+hx+0.02,y,z0,z1,r,r)
    box("darkwood",cx-hx,cy+hy,z0,z1,r,r)
def storey(cx,cy,hx,hy,z0,z1,nx,ny):
    box("timber",cx,cy,z0,z1,hx,hy)
    hb=min(0.22,(z1-z0)*0.28)                                    # white plaster just under the head beam
    box("snow",cx,cy,z1-0.12-hb,z1-0.12,hx+0.01,hy+0.01)
    posts(cx,cy,hx,hy,z0,z1,nx,ny)
    box("darkwood",cx,cy,z1-0.12,z1,hx+0.04,hy+0.04)            # head beam and brackets
    box("darkwood",cx,cy,z0,z0+0.08,hx+0.04,hy+0.04)            # sill
def podium(cx,cy,hx,hy,z1,step=0.12):
    box("stone",cx,cy,-0.05,z1-step,hx+step,hy+step); box("stone",cx,cy,z1-step,z1,hx,hy)

# ---- grounds: a gravel courtyard inside the cloister and a gravel approach to the middle gate
box("sand",0,-0.2,-0.02,0.03,7.2,5.4)
box("sand",0,-7.9,-0.02,0.03,0.75,1.55)

# ---- the five-storey pagoda (west): roofs shrinking strongly toward the top, a pent roof (mokoshi) round the
# ground storey and a tall bronze finial
PX,PY=-3.2,0.5
podium(PX,PY,1.25,1.25,0.35)
box("timber",PX,PY,0.35,0.95,1.12,1.12); posts(PX,PY,1.12,1.12,0.35,0.95,4,4,0.05)
flared_roof([(1.45,1.45,0.95,0.06),(1.45,1.45,1.01,0.06),(0.95,0.95,1.25,0.0)],"tile",PX,PY)
z=0.35
for i in range(5):
    b=0.85-0.09*i; r=1.68-0.18*i
    zb=z if i==0 else z-0.1
    zt=(1.6 if i==0 else z+0.55)
    storey(PX,PY,b,b,zb,zt,3,3)
    nb=0.85-0.09*(i+1)
    if i<4:
        flared_roof([(r,r,zt,0.3),(r,r,zt+0.1,0.3),(b*0.75+0.25,b*0.75+0.25,zt+0.38,0.06),(nb+0.04,nb+0.04,zt+0.48,0.0)],"tile",PX,PY)
        z=zt+0.48
    else:
        flared_roof([(r,r,zt,0.3),(r,r,zt+0.1,0.3),(0.42,0.42,zt+0.42,0.05),(0.12,0.12,zt+0.62,0.0)],"tile",PX,PY)
        z=zt+0.62
ZS=z
box("bronze",PX,PY,ZS-0.04,ZS+0.16,0.2,0.2)                        # roban
prism("bronze",PX,PY,ZS+0.16,ZS+0.3,0.18,0.12,8,0)                 # bowl
prism("bronze",PX,PY,ZS+0.3,ZS+2.3,0.035,0.03,6,0)                 # shaft
for k in range(9):                                                  # nine rings (kurin)
    zr=ZS+0.42+k*0.15; prism("bronze",PX,PY,zr,zr+0.05,0.17-0.006*k,0.17-0.006*k,8,0)
for k in range(4):                                                  # water flame (suien)
    a=k*math.pi/2; zf=ZS+1.85
    cone("bronze",[(PX+0.04*math.cos(a+1.57),PY+0.04*math.sin(a+1.57),zf),(PX-0.04*math.cos(a+1.57),PY-0.04*math.sin(a+1.57),zf),(PX+0.2*math.cos(a),PY+0.2*math.sin(a),zf+0.12)],(PX+0.08*math.cos(a),PY+0.08*math.sin(a),zf+0.32))
bipyr("bronze",PX,PY,ZS+2.36,0.07,ZS+2.28,ZS+2.5,6)                 # jewel (hoju)

# ---- the Golden Hall (Kondo, east): two storeys on a stone podium, a pent roof round the ground storey,
# deep first eaves, a railed upper storey and a hip-and-gable roof
KX,KY=2.9,0.3
podium(KX,KY,2.25,1.95,0.45)
box("timber",KX,KY,0.45,1.15,2.0,1.7); posts(KX,KY,2.0,1.7,0.45,1.15,6,5,0.05)
flared_roof([(2.35,2.05,1.15,0.08),(2.35,2.05,1.22,0.08),(1.55,1.3,1.5,0.0)],"tile",KX,KY)
storey(KX,KY,1.5,1.25,0.45,1.95,5,4)
flared_roof([(2.48,2.18,1.95,0.34),(2.48,2.18,2.07,0.34),(1.75,1.5,2.45,0.1),(1.12,0.92,2.62,0.0)],"tile",KX,KY)
# balcony with its railing round the upper storey
box("darkwood",KX,KY,2.5,2.58,1.28,1.08)
for (x0,x1,y0,y1) in [(-1.28,1.28,-1.08,-1.08),(1.28,1.28,-1.08,1.08)]:
    L=max(abs(x1-x0),abs(y1-y0))/2
    box("darkwood",KX+(x0+x1)/2,KY+(y0+y1)/2,2.76,2.82,L if x0!=x1 else 0.03,L if y0!=y1 else 0.03)
    for k in range(6):
        t=k/5; box("darkwood",KX+x0+(x1-x0)*t,KY+y0+(y1-y0)*t,2.58,2.8,0.025,0.025)
storey(KX,KY,1.0,0.82,2.55,3.35,4,3)
irimoya(KX,KY,[(2.02,1.72,3.35,0.36),(2.02,1.72,3.47,0.36),(1.3,1.02,3.95,0.12),(0.95,0.16,4.7,0.0)],0.92,0.88,3.97,4.66)

# ---- the middle gate (Chumon): two storeys, hip-and-gable roof, the cloister joining it on both sides
CX,CY=0.0,-5.6
podium(CX,CY,1.75,0.95,0.2)
storey(CX,CY,1.45,0.72,0.2,1.4,4,2)
box("darkwood",CX-0.36,CY-0.74,0.2,1.3,0.28,0.02); box("darkwood",CX+0.36,CY-0.74,0.2,1.3,0.28,0.02)   # doors
flared_roof([(2.1,1.35,1.4,0.26),(2.1,1.35,1.5,0.26),(1.35,0.68,1.8,0.06),(1.15,0.55,1.9,0.0)],"tile",CX,CY)
box("darkwood",CX,CY,1.86,1.94,1.3,0.66)
storey(CX,CY,1.15,0.58,1.86,2.55,4,2)
irimoya(CX,CY,[(1.95,1.28,2.55,0.28),(1.95,1.28,2.65,0.28),(1.15,0.7,2.98,0.08),(0.92,0.12,3.55,0.0)],0.9,0.62,3.0,3.52)

# ---- the lecture hall (Daikodo) closing the back of the cloister
DX,DY=0.0,5.75
podium(DX,DY,3.75,1.25,0.25)
storey(DX,DY,3.45,1.0,0.25,1.55,9,3)
irimoya(DX,DY,[(4.0,1.6,1.55,0.28),(4.0,1.6,1.65,0.28),(3.55,1.15,2.02,0.08),(3.1,0.14,2.7,0.0)],3.08,1.1,2.04,2.66)

# ---- the cloister (kairo): a roofed corridor, white outer wall with lattice windows, open posts inside
def kairo(x0,y0,x1,y1,out):
    alx=(y0==y1); L=(abs(x1-x0) if alx else abs(y1-y0))/2; mx=(x0+x1)/2; my=(y0+y1)/2
    ox,oy=out
    hx,hy=(L,0.45) if alx else (0.45,L)
    box("stone",mx,my,-0.05,0.1,hx+0.05,hy+0.05)
    wx,wy=mx+ox*0.42,my+oy*0.42
    box("timber",wx,wy,0.1,1.05,L if alx else 0.05,0.05 if alx else L)
    box("snow",wx,wy,0.78,0.97,L if alx else 0.06,0.06 if alx else L)
    box("darkwood",wx,wy,0.98,1.06,(L if alx else 0.07),(0.07 if alx else L))
    n=max(1,int(round(2*L/0.95)))
    for k in range(n+1):
        t=k/n
        px=x0+(x1-x0)*t; py=y0+(y1-y0)*t
        box("darkwood",px-ox*0.4,py-oy*0.4,0.1,1.02,0.05,0.05)
        if k<n and (oy<0 or ox>0):
            qx=x0+(x1-x0)*(t+0.5/n)+ox*0.47; qy=y0+(y1-y0)*(t+0.5/n)+oy*0.47
            box("darkwood",qx,qy,0.3,0.7,0.26 if alx else 0.02,0.02 if alx else 0.26)
    if alx: extrude_x("tile",[(my-0.68,1.02),(my+0.68,1.02),(my+0.68,1.1),(my,1.42),(my-0.68,1.1)],mx-L-0.25,mx+L+0.25)
    else: extrude_y("tile",[(mx-0.68,1.02),(mx+0.68,1.02),(mx+0.68,1.1),(mx,1.42),(mx-0.68,1.1)],my-L-0.25,my+L+0.25)
KW,KF,KB=7.2,-5.6,5.25
kairo(-KW,KF,-1.75,KF,(0,-1)); kairo(1.75,KF,KW,KF,(0,-1))
kairo(-KW,KF+0.45,-KW,KB-0.45,(-1,0)); kairo(KW,KF+0.45,KW,KB-0.45,(1,0))
kairo(-KW,KB,-3.75,KB,(0,1)); kairo(3.75,KB,KW,KB,(0,1))

# ---- lanterns: bronze ones in the courtyard before the hall and the pagoda, stone ones on the approach
def bronze_lantern(cx,cy,idx):
    prism("stone",cx,cy,0.0,0.18,0.3,0.3,8,math.pi/8)
    prism("bronze",cx,cy,0.18,1.0,0.07,0.07,8,0)
    prism("bronze",cx,cy,1.0,1.1,0.26,0.26,8,math.pi/8)
    prism("glow_lantern_%d"%idx,cx,cy,1.1,1.45,0.2,0.2,8,math.pi/8)
    cone("bronze",ngon(0.36,1.45,8,math.pi/8,cx,cy),(cx,cy,1.72))
    bipyr("bronze",cx,cy,1.78,0.06,1.72,1.86,6)
def stone_lantern(cx,cy,idx):
    T=dict(cx=cx,cy=cy)
    box("stone",0,0,-0.05,0.2,0.34,0.34,T)
    prism("stone",0,0,0.2,1.1,0.14,0.12,6,0,T)
    box("stone",0,0,1.1,1.24,0.32,0.32,T)
    box("glow_lantern_%d"%idx,0,0,1.24,1.6,0.22,0.22,T)
    solid([rect(0.52,0.52,1.6),rect(0.52,0.52,1.67),rect(0.12,0.12,1.94)],"stone",T)
    bipyr("stone",0,0,2.0,0.09,1.92,2.14,6,T)
bronze_lantern(KX,KY-3.0,1); bronze_lantern(PX,PY-3.0,2)
stone_lantern(-1.35,-7.3,3); stone_lantern(1.35,-7.3,4)

# ---- trees: pines along the approach and round the cloister, cherry trees in blossom at the front corners
def conifer(cx,cy,s,ph=0):
    T=dict(cx=cx,cy=cy,cz=0.0,s=s)
    prism("wood",0,0,-0.3,0.9,0.2,0.18,6,ph,T)
    cone("foliage",ngon(1.15,0.7,7,ph),(0,0,2.3),T)
    cone("foliage",ngon(0.9,1.6,7,ph+0.4),(0,0,3.1),T)
    cone("foliage",ngon(0.62,2.4,7,ph+0.8),(0,0,3.85),T)
def pine(cx,cy,s,rot):
    # a garden pine: a leaning trunk carrying flat layered pads
    T=dict(cx=cx,cy=cy,cz=0.0,s=s,rot=rot)
    solid([ngon(0.14,-0.2,6),ngon(0.12,1.2,6,0,0.25,0),ngon(0.09,2.1,6,0,0.1,0.1)],"wood",T)
    for (x,y,z,r) in [(0.1,0.1,2.2,0.95),(0.55,-0.1,1.55,0.75),(-0.35,0.25,1.3,0.6)]:
        ico("foliage",x,y,z,r,r*0.9,0.3,T)
def sakura(cx,cy,s):
    T=dict(cx=cx,cy=cy,s=s)
    solid([ngon(0.17,-0.3,6),ngon(0.13,1.0,6,0,0.15,0),ngon(0.09,1.5,6,0,0.05,0.1)],"wood",T)
    ico("blossom",0,0,1.95,1.25,1.15,0.85,T)
    ico("blossom",0.65,0.35,1.55,0.75,0.7,0.55,T)
    ico("blossom",-0.6,-0.3,1.6,0.7,0.65,0.5,T)
for a in [(-2.4,-7.0,0.75,0.4),(2.4,-8.4,0.7,2.1),(-2.7,-8.4,0.7,4.2),(-5.4,-7.4,0.8,1.0)]: pine(*a)
for a in [(-7.0,-7.6,0.9),(5.4,-7.4,0.85)]: sakura(*a)
for a in [(-8.5,-1.8,0.7,0.2),(-8.5,2.6,0.75,0.6),(-5.6,7.6,0.85,0.4),(-2.0,8.4,0.8,0.1),(2.4,8.3,0.85,0.7),(5.8,7.5,0.8,0.3)]: conifer(*a)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/horyu-ji.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=9.6; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y): return 0.0     # flat grounds; the halls and their podiums are solid, not walkable
ground=[[0.0 for ix in range(GN)] for iz in range(GN)]
CELL=0.3
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
                    if z<BAND0 or z>BAND1: continue
                    if nz>0.92 and z<0.6: continue
                    solid_cells.add((int((x+HALF)/CELL),int((y+HALF)/CELL)))
solids=[[round(-HALF+CELL*(cx+0.5),2), round(-(-HALF+CELL*(cy+0.5)),2), 0.22] for cx,cy in sorted(solid_cells)]
solids+=[[round(x,2),round(-y,2),r] for x,y,r in EXTRA_SOLIDS]
INTERACT=(0.0,-7.2)   # the approach in front of the middle gate
STAND=(0.0,-8.9)      # the front end of the approach
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]],"terrainSurface":True}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/horyu-ji.json"
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
    objname=key if key.startswith("glow_") else "horyuji_"+key
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
res={"tris":sum(stats.values()),"per_obj":stats,"materials":len(bpy.data.materials),"min":[round(v,3) for v in mn],"max":[round(v,3) for v in mx],"glb_bytes":os.path.getsize(GLB)}
json.dump(res,open("/tmp/lm_build.json","w"))
