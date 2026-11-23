# Koyasan Okunoin (the cemetery path under giant cedars, moss-grown gorinto, the Gobyo-bashi and the Torodo hall of lamps) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python koyasan-okunoin.py
# Rebuilds content/landmarks/koyasan-okunoin.blend and public/models/landmarks/koyasan-okunoin.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/koyasan-okunoin.glb"
BLEND=ROOT+"/content/landmarks/koyasan-okunoin.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"stone":"8f8b84","stoned":"6b6862","moss":"6f7f4a","pave":"b2ada3","wood":"6e4c36","roof":"3c3836","cedar":"2f4a35","bark":"4e3a30","red":"c4473a","water":"4b6b68","glow_cream":"e8dcb0"}
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
rng=random.Random(19)
EXTRA_SOLIDS=[]
FH=11.2   # footprint half-width (the sidecar's half): the middle size, a precinct
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
S2=math.sqrt(0.5)
# axes: u runs down the approach toward the viewer (+X/-Y), v across it (+X/+Y, screen right)
def to_xy(u,v): return (S2*(u+v),S2*(v-u))
def to_uv(x,y): return (S2*(x-y),S2*(x+y))
ROT=math.pi/4     # local +x along v, local -y toward the viewer (+u)
CL=FH-0.1
def clampxy(x,y): return (max(-CL,min(CL,x)),max(-CL,min(CL,y)))

# ---- the approach: a stone-paved path winding up through the cemetery to the Gobyo-bashi bridge
def path_v(u): return 2.6*smooth(-1.0,11.0,u)+0.5*math.sin(0.45*u)*smooth(-3.0,2.0,u)
PW=0.95
US=[-5.4+(16.0+5.4)*k/31 for k in range(32)]
def ribbon(mat,vfun,w0,w1,z0,z1,us):
    rings=[]
    for u in us:
        c=vfun(u)
        a=clampxy(*to_xy(u,c+w0)); b=clampxy(*to_xy(u,c+w1))
        rings.append([(a[0],a[1],z0),(b[0],b[1],z0),(b[0],b[1],z1),(a[0],a[1],z1)])
    solid(rings,mat)
ribbon("pave",path_v,-PW,PW,-0.05,0.04,[u for u in US if u>=-2.0])
def path_dist(x,y):
    u,v=to_uv(x,y)
    if u<-2.0: return abs(v)+(-2.0-u)
    return abs(v-path_v(u))

# ---- the Tamagawa stream across the approach, with wooden sotoba standing in it beside the bridge
SU=-3.0
def stream_u(v): return SU+0.35*math.sin(0.5*v+0.4)
SW=0.5
rings=[]
VS=[-7.6+15.2*k/27 for k in range(28)]
for v in VS:
    u=stream_u(v); w=SW*smooth(-7.6,-6.0,v)*(1-smooth(6.0,7.6,v))+0.05
    a=to_xy(u-w,v); b=to_xy(u+w,v)
    rings.append([(a[0],a[1],-0.04),(b[0],b[1],-0.04),(b[0],b[1],0.07),(a[0],a[1],0.07)])
solid(rings,"water")
def in_water(x,y,pad=0.0):
    u,v=to_uv(x,y)
    if not(-7.4<=v<=7.4): return False
    return abs(u-stream_u(v))<SW+pad
def stone(cx,cy,s,m="stoned"):
    T=dict(cx=cx,cy=cy,rot=rng.uniform(0,6.28),s=s)
    ico(m,0,0,0.12,0.5,0.4,0.3,T)
for v in (-7.4,-6.9,-6.3,6.3,6.9,7.4,-4.6,4.2):
    x,y=to_xy(stream_u(v)+rng.uniform(-0.7,0.7),v); stone(x,y,rng.uniform(0.6,0.95),"moss" if rng.random()<0.5 else "stoned")
for k in range(9):                                     # sotoba: tall thin wooden tablets in a row in the water
    v=-1.9-0.3*k; u=stream_u(v)
    x,y=to_xy(u,v); box("wood",0,0,-0.05,0.9+0.25*(k%3),0.06,0.02,dict(cx=x,cy=y,rot=ROT))
# the bridge: a low stone span with mossy balustrades
BX,BY=to_xy(SU,0.0); TB=dict(cx=BX,cy=BY,rot=ROT)
BDZ=0.28
box("pave",0,0,-0.08,BDZ,1.05,1.3,TB)
for sx in (-1,1):
    box("stone",sx*1.0,0,BDZ,BDZ+0.45,0.07,1.3,TB)
    box("moss",sx*1.0,0,BDZ+0.45,BDZ+0.52,0.09,1.32,TB)
    for sy in (-1,1): box("stone",sx*1.0,sy*1.3,-0.05,BDZ+0.68,0.12,0.12,TB); box("moss",sx*1.0,sy*1.3,BDZ+0.68,BDZ+0.76,0.14,0.14,TB)

# ---- the Torodo, the Hall of Lamps, on its stone platform at the end of the approach: dark timber, a deep
# roof, and rows of lanterns glowing under the eaves
HU=-8.0; HX,HY=to_xy(HU,0.0); TH=dict(cx=HX,cy=HY,rot=ROT)
PZ=0.55
box("stone",0,0.3,-0.1,PZ,2.9,1.9,TH)                        # platform: local y along -u (back), front edge at local y=-1.6
for k in range(4):                                       # steps up the front
    box("stone",0,-1.7-0.2*k,-0.1,PZ*(4-k)/4,1.4,0.1,TH)
box("wood",0,0.7,PZ,PZ+1.7,2.2,1.05,TH)
for x in (-2.0,-1.0,0.0,1.0,2.0): box("roof",x,-0.36,PZ,PZ+1.7,0.07,0.07,TH)        # front posts
for x in (-2.2,2.2):
    for y in (-0.36,1.7): box("roof",x,y,PZ,PZ+1.7,0.08,0.08,TH)
for row,z in ((0,PZ+0.75),(1,PZ+1.12)):                       # the hanging lanterns along the front, lit
    for k in range(9):
        box("glow_lantern_%d"%(row*9+k),-1.92+k*0.48,-0.6,z,z+0.24,0.13,0.11,TH)
box("roof",0,0.7,PZ+1.7,PZ+1.82,2.35,1.2,TH)
box("roof",0,-0.6,PZ+1.46,PZ+1.56,2.15,0.05,TH)                       # the beam the lanterns hang from
def hall_roof():
    spec=[(3.0,1.85,PZ+1.82,0.28),(3.0,1.85,PZ+1.94,0.28),(2.1,1.0,PZ+2.55,0.08),(1.75,0.3,PZ+3.15,0.0)]
    before=len(B.get("roof",([],[]))[0])
    flared_roof(spec,"roof",0.0,0.0)
    bv=B["roof"][0]
    for i in range(before,len(bv)):            # into the hall's frame
        x,y,z=bv[i]; bv[i]=xf([(x,y+0.7,z)],**TH)[0]
hall_roof()
for sx in (-1,1):                                        # stone lanterns either side of the steps
    T=dict(cx=HX,cy=HY,rot=ROT)
    lx,ly=xf([(sx*1.9,-2.6,0)],**T)[0][:2]
    prism("stone",lx,ly,-0.05,0.18,0.3,0.3,6,0); prism("stone",lx,ly,0.18,0.85,0.09,0.09,6,0)
    prism("stone",lx,ly,0.85,0.95,0.24,0.24,6,0); prism("glow_lamp_%d"%(1 if sx<0 else 2),lx,ly,0.95,1.22,0.15,0.15,6,0)
    cone("moss",ngon(0.34,1.22,6,0,lx,ly),(lx,ly,1.5))

# ---- the cemetery: moss-grown gorinto (five-ring stupas), headstones, family plots, stone lanterns, a tier of
# red-bibbed jizo, all under giant cedars
def gorinto(cx,cy,s,z=0.0):
    T=dict(cx=cx,cy=cy,cz=z,rot=rng.uniform(-0.3,0.3)+ROT,s=s)
    box("stoned",0,0,-0.05,0.42,0.26,0.26,T)                                  # earth (cube)
    bipyr("stone",0,0,0.62,0.23,0.42,0.82,6,T)                                # water (sphere)
    solid([rect(0.3,0.3,0.8),rect(0.3,0.3,0.9),rect(0.06,0.06,1.12)],"moss",T)   # fire (roof)
    bipyr("stone",0,0,1.16,0.14,1.1,1.24,6,T)                                 # wind (crescent)
    cone("stone",ngon(0.09,1.22,6),(0,0,1.42),T)                             # void (jewel)
def headstone(cx,cy,s):
    T=dict(cx=cx,cy=cy,rot=ROT+rng.uniform(-0.2,0.2),s=s)
    box("stone",0,0,-0.05,0.18,0.3,0.24,T); box("stoned",0,0,0.18,1.15,0.15,0.13,T); box("moss",0,0,1.15,1.21,0.17,0.15,T)
def lantern(cx,cy,s,gi=None):
    T=dict(cx=cx,cy=cy,s=s,rot=ROT)       # square stone lanterns
    prism("stone",0,0,-0.05,0.15,0.3,0.3,4,math.pi/4,T); prism("stoned",0,0,0.15,0.75,0.1,0.1,4,math.pi/4,T)
    prism("stone",0,0,0.75,0.84,0.26,0.26,4,math.pi/4,T); prism("glow_lamp_%d"%gi if gi else "stoned",0,0,0.84,1.06,0.17,0.17,4,math.pi/4,T)
    cone("moss",ngon(0.38,1.06,4,math.pi/4),(0,0,1.3),T)
def plot(cx,cy,s):
    T=dict(cx=cx,cy=cy,rot=ROT+rng.uniform(-0.15,0.15),s=s)
    for sy in (-1,1): box("stone",0,sy*0.85,-0.05,0.3,1.0,0.07,T)
    box("stone",-0.95,0,-0.05,0.3,0.07,0.85,T); box("stone",0.95,0,-0.05,0.3,0.07,0.85,T)
    box("moss",0,0,-0.05,0.06,0.9,0.78,T)
    box("stoned",0,0.35,0.0,1.25,0.2,0.16,T); box("stone",0,0.35,1.25,1.33,0.24,0.2,T)
    gorinto(*xf([(-0.55,0.3,0)],**T)[0][:2],0.6*s)
placed=[]
def free(x,y,d): return all(math.hypot(x-px,y-py)>=d for px,py,_ in placed)
def blocked(x,y,r):
    u,v=to_uv(x,y)
    if abs(x)>FH-0.5-r or abs(y)>FH-0.5-r: return True
    if path_dist(x,y)<PW+0.35+r: return True
    if in_water(x,y,0.5+r): return True
    if HU-2.4<u<HU+3.4 and abs(v)<3.6+r: return True          # the hall, its platform and steps
    if abs(u-SU)<1.9 and abs(v)<1.9: return True
    return False
# giant cedars first
CEDARS=[(-1.0,6.2),(-1.4,-6.6),(3.0,-6.4),(3.4,6.6),(6.6,0.0),(-5.2,-5.6),(-6.0,6.0),(8.2,-7.0),(-10.0,-1.2),(-11.0,3.0),(0.8,9.0),(5.0,-8.6),(-3.4,-8.4),(9.6,3.6),(-12.2,-2.0),(-9.0,4.2),(-9.0,-4.2),(-11.6,0.0),(-7.2,6.0),(-6.4,-6.6),(7.4,-5.4),(5.8,5.2),(0.0,5.2),(9.6,-5.6),(-4.6,-4.2),(11.2,4.4),(0.5,-12.2),(0.5,10.2),(-3.0,-10.0),(-3.5,9.6)]
for u,dv in CEDARS:
    v=path_v(u)+dv if u>-2 else dv
    x,y=to_xy(u,v)
    if blocked(x,y,0.4) or not free(x,y,2.2) or abs(x)>FH-1.6 or abs(y)>FH-1.6: continue   # canopy inside the footprint
    placed.append((x,y,0.45))
    s=rng.uniform(0.9,1.0); T=dict(cx=x,cy=y,s=s)
    prism("bark",0,0,-0.3,5.4,0.36,0.28,7,rng.uniform(0,1),T)
    for (r,zb,zt) in [(1.5,4.4,6.9),(1.15,6.0,8.4),(0.75,7.5,9.8)]:
        cone("cedar",ngon(r,zb,7,rng.uniform(0,1)),(0,0,zt),T)
# stone lanterns lining the approach in pairs, some lit
gi=3
for k,u in enumerate((9.4,7.0,4.6,2.2,-0.2)):
    for side in (-1,1):
        x,y=to_xy(u,path_v(u)+side*(PW+0.5))
        if not free(x,y,0.9) or in_water(x,y,0.4): continue
        lit=(k+(side>0))%2==0
        lantern(x,y,1.0,gi if lit else None); gi+=1 if lit else 0
        placed.append((x,y,0.4))
# the jizo tier, to the right of the hall steps
JU,JV=-5.2,4.8; JX,JY=to_xy(JU,JV); TJ=dict(cx=JX,cy=JY,rot=ROT)
for k,(hx,hy,z0,z1) in enumerate([(1.3,0.9,-0.05,0.3),(1.0,0.6,0.3,0.6),(0.7,0.3,0.6,0.9)]):
    box("stone",0,0.3*k,z0,z1,hx,hy,TJ)
    n=[5,4,3][k]
    for j in range(n):
        lx=-hx+0.25+j*(2*hx-0.5)/max(1,n-1); ly=0.3*k-hy+0.2
        jx,jy=xf([(lx,ly,0)],**TJ)[0][:2]
        prism("stone",jx,jy,z1,z1+0.32,0.09,0.08,6,0); ico("stone",jx,jy,z1+0.4,0.08,0.08,0.09)
        box("red",lx,ly-0.06,z1+0.15,z1+0.3,0.1,0.04,TJ); prism("red",jx,jy,z1+0.45,z1+0.52,0.085,0.07,6,0)
placed.append((JX,JY,1.6))
# fill along the approach
tries=0
while tries<3000 and len(placed)<80:
    tries+=1
    u=rng.uniform(-9.5,14.0); side=rng.choice((-1,1)); d=rng.uniform(PW+0.8,PW+6.5)
    v=(path_v(u) if u>-2 else 0.0)+side*d
    x,y=to_xy(u,v)
    r=rng.random(); kind="g" if r<0.4 else ("h" if r<0.62 else ("p" if r<0.78 else ("l" if r<0.92 else "m")))
    rad={"g":0.45,"h":0.4,"p":1.3,"l":0.4,"m":0.5}[kind]
    if blocked(x,y,rad) or not free(x,y,rad+0.45): continue
    placed.append((x,y,rad))
    if kind=="g": gorinto(x,y,rng.uniform(0.8,1.4))
    elif kind=="h": headstone(x,y,rng.uniform(0.8,1.2))
    elif kind=="p": plot(x,y,rng.uniform(0.85,1.0))
    elif kind=="l":
        lit=False
        lantern(x,y,rng.uniform(0.9,1.1),gi if lit else None); gi+=1 if lit else 0
    else: stone(x,y,rng.uniform(0.7,1.1),"moss")
# moss underfoot through the graves
for x,y,rad in placed:
    if rad<1.0 and rng.random()<0.4:
        T=dict(cx=x,cy=y,rot=rng.uniform(0,6.28))
        solid([ngon(rad+0.45,-0.05,7,0),ngon(rad+0.45,0.02,7,0)],"moss",T)

# walkable floors: the bridge deck, the hall platform and its steps
def floor_at(x,y):
    u,v=to_uv(x,y)
    if abs(u-SU)<=1.05 and abs(v)<=0.95: return BDZ
    if HU-2.2<=u<=HU+1.6 and abs(v)<=2.9: return PZ                            # platform (local y -1.6..2.2 maps to u)
    if HU+1.6<u<=HU+2.4 and abs(v)<=1.4: return PZ*(HU+2.4-u)/0.8
    return 0.0
STAND=to_xy(10.6,path_v(10.6))

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/koyasan-okunoin.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=FH; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y): return floor_at(x,y)   # the bridge deck, the hall platform and its steps; the game draws the ground
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
INTERACT=to_xy(HU+1.0,0.0)   # the veranda of the Torodo
# STAND (set above): the foot of the approach
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]],"terrainSurface":True}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/koyasan-okunoin.json"
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
    objname=key if key.startswith("glow_") else "oku_"+key
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
