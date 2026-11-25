# Oze (twin plank boardwalks across the summer moor, day lilies and skunk cabbage, ponds, a mountain hut, Mt Shibutsu behind) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python oze.py
# Rebuilds content/landmarks/oze.blend and public/models/landmarks/oze.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/oze.glb"
BLEND=ROOT+"/content/landmarks/oze.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"moor":"7f9c4a","grassd":"5f7e3a","plank":"a8a090","post":"6b5a48","water":"3c5455","white":"f2f2ee","yellow":"e8b93a","leaf":"4f6e3c","leafd":"3f5a33","rock":"7d7a78","roof":"4e6b4a","glow_cream":"e8dcb0"}
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
rng=random.Random(22)
EXTRA_SOLIDS=[]
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the moor with Mt Shibutsu behind
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
S2=math.sqrt(0.5)
def to_xy(u,v): return (S2*(u+v),S2*(v-u))
def to_uv(x,y): return (S2*(x-y),S2*(x+y))
ROT=math.pi/4

# ---- Mt Shibutsu at the back corner: a rounded, forested mountain with bare grey rock toward the summit
MU,MV=-12.6,-1.6; MX,MY=to_xy(MU,MV); MR=7.6; MHT=5.0
NA=24; NK=9
def m_r(z,a):
    t=min(1.0,z/MHT)
    return (1.6+(MR-1.6)*(1-t)**0.8)*(1.0+0.06*math.sin(5*a+0.4)*(1-t)+0.03*math.sin(11*a))   # a broad dome, not a cone
levels=[MHT*(k/NK)**0.9*0.97 for k in range(NK+1)]
verts=[]; faces=[]; mats=[]
for k,z in enumerate(levels):
    for i in range(NA):
        a=2*math.pi*i/NA; r=m_r(z,a)
        x,y=MX+r*math.cos(a),MY+r*math.sin(a)
        de=FH-max(abs(x),abs(y)); x=max(-FH+0.1,min(FH-0.1,x)); y=max(-FH+0.1,min(FH-0.1,y))
        verts.append((x,y,(z-(0.25 if k==0 else 0.0))*smooth(-0.5,2.6,de) if k>0 else -0.25))
def rockline(a): return MHT*(0.58+0.07*math.sin(4*a+1.0)+0.05*math.sin(9*a))
for k in range(NK):
    for i in range(NA):
        j=(i+1)%NA; q=[k*NA+i,k*NA+j,(k+1)*NA+j,(k+1)*NA+i]
        zm=(levels[k]+levels[k+1])/2; a=2*math.pi*(i+0.5)/NA
        hh=((i*73856093)^(k*19349663))%7
        m="rock" if zm>rockline(a) else ("leaf" if hh==0 else "leafd")
        faces+=[[q[0],q[1],q[2]],[q[0],q[2],q[3]]]; mats+=[m,m]
top=NK*NA; c=len(verts); verts.append((MX,MY,levels[-1]+0.05))
for i in range(NA): faces.append([top+i,top+(i+1)%NA,c]); mats.append("rock")
emit(verts,faces,mats)
def on_mountain(x,y,pad=0.0): return math.hypot(x-MX,y-MY)<MR+pad

# ---- the moor: a sheet of bright summer grass over the marsh ground, ragged at its edges
pts=[]
for i in range(40):
    t=2*math.pi*i/40
    u=-0.4+10.4*math.cos(t)*(1+0.06*math.sin(5*t)); v=0.0+10.0*math.sin(t)*(1+0.06*math.sin(7*t+1))
    x,y=to_xy(u,v); x=max(-FH+0.6,min(FH-0.6,x)); y=max(-FH+0.6,min(FH-0.6,y))
    pts.append((x,y))
solid([[(x,y,-0.02) for x,y in pts],[(x,y,0.02) for x,y in pts]],"moor",mb=None)

# ---- the stream wandering across, and the ponds (ikeda) dotting the moor, with little floating islands
def st_u(v): return 2.4+0.9*math.sin(0.55*v+0.3)
def st_w(v): return 0.42*smooth(-9.2,-7.4,v)*(1-smooth(7.4,9.2,v))+0.03
rings=[]
for k in range(36):
    v=-9.2+18.4*k/35; u=st_u(v); w=st_w(v)
    a=to_xy(u-w,v); b=to_xy(u+w,v)
    rings.append([(a[0],a[1],-0.03),(b[0],b[1],-0.03),(b[0],b[1],0.06),(a[0],a[1],0.06)])
solid(rings,"water")
PONDS=[(5.6,-5.4,1.0,0.8),(-2.6,-3.0,1.2,0.9),(6.4,5.6,0.8,0.7),(-1.4,3.4,0.9,0.75),(0.4,-7.6,0.7,0.6),(-5.0,1.6,0.8,0.6)]
for u0,v0,ru,rv in PONDS:
    pp=[to_xy(u0+ru*(1+0.1*math.sin(3*t+u0))*math.cos(t),v0+rv*(1+0.1*math.sin(3*t+u0))*math.sin(t)) for t in [2*math.pi*i/11 for i in range(11)]]
    solid([[(x,y,-0.03) for x,y in pp],[(x,y,0.06) for x,y in pp]],"water")
    if ru>0.85:
        ix,iy=to_xy(u0+0.25*ru,v0-0.2*rv); ico("moor",0,0,0.05,0.3,0.24,0.06,dict(cx=ix,cy=iy))
def in_water(x,y,pad=0.0):
    u,v=to_uv(x,y)
    if -9.2<=v<=9.2 and abs(u-st_u(v))<st_w(v)+pad: return True
    for u0,v0,ru,rv in PONDS:
        if ((u-u0)/(ru+pad))**2+((v-v0)/(rv+pad))**2<=1.0: return True
    return False

# ---- the boardwalks: twin lanes of weathered planks laid side by side, one each way, low on short posts,
# straight out across the moor to a junction; one arm runs on to the lodge, the other toward the mountain
LINES=[[(11.0,0.6),(8.0,-0.6),(5.4,-0.2),(3.4,1.4),(1.2,1.2),(-0.8,0.6)],      # straight runs with angled turns, as the
       [(-0.8,0.6),(-2.4,1.6),(-3.0,3.0),(-2.6,4.2),(-3.6,5.4)],                 # real boardwalks wander across the moor
       [(-0.8,0.6),(-2.0,-0.8),(-3.4,-1.0),(-4.6,-2.6),(-6.4,-4.2)]]
ROUTE=[[l[i],l[i+1]] for l in LINES for i in range(len(l)-1)]
BH=0.2
def walk(p0,p1):
    (u0,v0),(u1,v1)=p0,p1; x0,y0=to_xy(u0,v0); x1,y1=to_xy(u1,v1)
    L=math.hypot(x1-x0,y1-y0); a=math.atan2(y1-y0,x1-x0); T=dict(cx=(x0+x1)/2,cy=(y0+y1)/2,rot=a)
    for lane in (-0.42,0.42):
        for pl in (-0.13,0.13): box("plank",0,lane+pl,BH-0.06,BH,L/2+0.3,0.115,T)
        n=max(1,int(L/1.1))
        for k in range(n+1):
            lx=-L/2+L*k/n; box("post",lx,lane,-0.1,BH-0.06,0.05,0.24,T)
    return (x0,y0,x1,y1)
SEGS=[walk(*s) for s in ROUTE]
def bw_dist(x,y):
    best=1e9
    for x0,y0,x1,y1 in SEGS:
        ex,ey=x1-x0,y1-y0; L2=ex*ex+ey*ey; t=max(0,min(1,((x-x0)*ex+(y-y0)*ey)/L2))
        best=min(best,math.hypot(x-x0-t*ex,y-y0-t*ey))
    return best

# ---- the mountain hut (yamagoya) at the end of the right-hand arm: two storeys of weathered timber, a green roof
LU,LV=-5.0,7.0; LX,LY=to_xy(LU,LV); TL=dict(cx=LX,cy=LY,rot=ROT)
box("post",0,0,-0.1,0.25,2.0,1.35,TL)
box("plank",0,0,0.25,2.35,1.8,1.15,TL)
box("post",0,0,1.25,1.33,1.85,1.2,TL)
for k in range(4):
    box("glow_window_%d"%k if k%2==0 else "post",-1.2+k*0.8,-1.16,0.7,1.05,0.22,0.02,TL)
    box("post",-1.2+k*0.8,-1.16,1.6,1.95,0.22,0.02,TL)
box("post",0,-1.19,0.25,1.1,0.3,0.02,TL)        # the door, proud of the window boards
extrude_x("roof",[(-1.6,2.3),(1.6,2.3),(1.6,2.42),(0,3.35),(-1.6,2.42)],-2.15,2.15,TL)
LDZ=0.25

# ---- flowers: yellow day lilies (Nikko-kisuge) in drifts across the moor, white skunk cabbage (mizubasho)
# along the stream; grass tussocks
def lily_patch(x,y,n,r):
    for k in range(n):
        a=rng.uniform(0,6.28); d=rng.uniform(0,r); px,py=x+d*math.cos(a),y+d*math.sin(a)
        prism("grassd",px,py,0.0,0.32,0.02,0.015,3,0)
        bipyr("yellow",px,py,0.36,0.07,0.3,0.42,4)
def skunk(x,y):
    T=dict(cx=x,cy=y,rot=rng.uniform(0,6.28))
    cone("white",ngon(0.09,0.02,4,0,0.0,0.0),(0.05,0.0,0.38),T)
    ico("leaf",0.12,0.1,0.08,0.16,0.08,0.05,T)
placed=[]
def free(x,y,d): return all(math.hypot(x-px,y-py)>=d+pr for px,py,pr in placed)
def ok(x,y,r):
    if abs(x)>FH-0.5-r or abs(y)>FH-0.5-r: return False
    if in_water(x,y,0.2+r) or bw_dist(x,y)<0.95+r or on_mountain(x,y,r): return False
    if math.hypot(x-LX,y-LY)<3.0+r: return False
    return free(x,y,r)
# the forest at the moor's edge: broadleaf crowns and white birches along the back and the sides
def broadleaf(x,y,s,birch=False):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    if birch:
        solid([ngon(0.09,-0.3,5),ngon(0.06,1.9,5,0,0.05,0)],"white",T)
        ico("leaf",0.05,0,2.2,0.65,0.6,0.8,T); return
    solid([ngon(0.16,-0.3,5),ngon(0.11,1.1,5,0,0.08,0)],"post",T)
    m=rng.choice(("leafd","leafd","leaf"))
    ico(m,0,0,2.0,1.15,1.05,0.9,T); ico(m,0.7,0.3,1.6,0.75,0.7,0.6,T)
n=0; tries=0
while n<22 and tries<5000:
    tries+=1; u=rng.uniform(-15.0,-5.5); v=rng.uniform(-11.0,11.0)
    if rng.random()<0.5: u,v=rng.uniform(-8.0,9.0),rng.choice((-1,1))*rng.uniform(8.6,11.0)   # down the sides too
    x,y=to_xy(u,v)
    if not ok(x,y,0.8) or abs(x)>FH-1.3 or abs(y)>FH-1.3: continue
    broadleaf(x,y,rng.uniform(0.85,1.1)); placed.append((x,y,0.8)); n+=1
n=0; tries=0
while n<7 and tries<3000:                                  # birches standing out on the moor's edge
    tries+=1; u=rng.uniform(-7.0,4.0); v=rng.choice((-1,1))*rng.uniform(5.5,8.5); x,y=to_xy(u,v)
    if not ok(x,y,0.5): continue
    broadleaf(x,y,rng.uniform(0.9,1.1),True); placed.append((x,y,0.5)); n+=1
n=0; tries=0
while n<16 and tries<4000:
    tries+=1; x,y=rng.uniform(-FH,FH),rng.uniform(-FH,FH)
    if not ok(x,y,0.6): continue
    lily_patch(x,y,6,0.55); placed.append((x,y,0.6)); n+=1
n=0; tries=0
while n<22 and tries<4000:
    tries+=1; v=rng.uniform(-8.0,8.0); u=st_u(v)+rng.choice((-1,1))*(st_w(v)+rng.uniform(0.25,0.6)); x,y=to_xy(u,v)
    if bw_dist(x,y)<1.0 or not free(x,y,0.12): continue
    skunk(x,y); placed.append((x,y,0.12)); n+=1
n=0; tries=0
while n<40 and tries<4000:
    tries+=1; x,y=rng.uniform(-FH,FH),rng.uniform(-FH,FH)
    if not ok(x,y,0.3): continue
    T=dict(cx=x,cy=y,rot=rng.uniform(0,6.28))
    ico("grassd",0,0,0.02,0.4,0.32,0.22,T); placed.append((x,y,0.3)); n+=1

def floor_at(x,y):
    if bw_dist(x,y)<=0.75: return BH
    u,v=to_uv(x,y); lu,lv=u-LU,v-LV
    if abs(lu)<=1.35 and abs(lv)<=2.0: return LDZ
    return 0.0
STAND=to_xy(10.4,0.36)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/oze.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=FH; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y): return floor_at(x,y)   # the boardwalks and the hut's plinth; the game draws the marsh ground beneath
ground=[[round(ground_at(-HALF+GSTEP*ix, -(-HALF+GSTEP*iz)),3) for ix in range(GN)] for iz in range(GN)]
CELL=0.3
solid_cells=set(); cellg={}
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
                    ck=(int((x+HALF)/CELL),int((y+HALF)/CELL)); g=cellg.get(ck)
                    if g is None: g=cellg[ck]=ground_at(-HALF+CELL*(ck[0]+0.5),-HALF+CELL*(ck[1]+0.5))
                    if z<g+BAND0 or z>g+BAND1: continue
                    if nz>0.92 and z<g+0.6: continue
                    solid_cells.add(ck)
solids=[[round(-HALF+CELL*(cx+0.5),2), round(-(-HALF+CELL*(cy+0.5)),2), 0.22] for cx,cy in sorted(solid_cells)]
for ix in range(int(2*HALF/0.6)+1):
    for iy in range(int(2*HALF/0.6)+1):
        x,y=-HALF+0.3+ix*0.6,-HALF+0.3+iy*0.6
        if in_water(x,y,-0.2) and floor_at(x,y)==0.0 and all(floor_at(x+dx,y+dy)==0.0 for dx,dy in ((0.5,0),(-0.5,0),(0,0.5),(0,-0.5))):
            EXTRA_SOLIDS.append((x,y,0.43))
solids+=[[round(x,2),round(-y,2),r] for x,y,r in EXTRA_SOLIDS]
INTERACT=to_xy(-0.8,0.6)   # the junction of the boardwalks
# STAND (set above): the start of the boardwalk
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]],"terrainSurface":True}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/oze.json"
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
    objname=key if key.startswith("glow_") else "oze_"+key
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
