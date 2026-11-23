# Kushiro Shitsugen (the river meandering through golden reed beds, red-crowned cranes dancing, a boardwalk out to a log cabin deck) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python kushiro-shitsugen.py
# Rebuilds content/landmarks/kushiro-shitsugen.blend and public/models/landmarks/kushiro-shitsugen.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/kushiro-shitsugen.glb"
BLEND=ROOT+"/content/landmarks/kushiro-shitsugen.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"water":"4b6b68","reed":"b5a46a","reedg":"6f8a4a","wood":"9a7350","woodd":"5a4334","foliage":"5f7a45","leafd":"476236","bark":"4e3a30","white":"f2f2ee","black":"26262a","red":"c8373a","glow_cream":"e8dcb0"}
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
rng=random.Random(21)
EXTRA_SOLIDS=[]
FH=11.2   # footprint half-width (the sidecar's half): the middle size, a wide wetland scene
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
S2=math.sqrt(0.5)
# axes: u runs toward the viewer (+X/-Y), v across (+X/+Y, screen right)
def to_xy(u,v): return (S2*(u+v),S2*(v-u))
def to_uv(x,y): return (S2*(x-y),S2*(x+y))
ROT=math.pi/4

# ---- the Kushiro river meandering across the marsh, fading into the reed beds before either edge, with oxbow
# ponds where old bends were cut off
def ch_u(v): return -1.2+2.6*math.sin(0.42*v+0.5)
def ch_w(v): return (0.75+0.2*math.sin(0.9*v))*smooth(-10.0,-7.6,v)*(1-smooth(7.6,10.0,v))+0.04
rings=[]
VS=[-10.0+20.0*k/47 for k in range(48)]
for v in VS:
    u=ch_u(v); w=ch_w(v)
    a=to_xy(u-w,v); b=to_xy(u+w,v)
    rings.append([(a[0],a[1],-0.05),(b[0],b[1],-0.05),(b[0],b[1],0.06),(a[0],a[1],0.06)])
solid(rings,"water")
PONDS=[(-6.2,-4.6,1.5,0.9,0.5),(4.6,6.2,1.3,0.8,-0.6),(-5.6,6.4,1.1,0.75,0.2),(5.2,-6.8,1.0,0.7,0.9)]   # (u,v,ru,rv,angle)
for u0,v0,ru,rv,ang in PONDS:
    pts=[]
    for i in range(12):
        t=2*math.pi*i/12; r=1+0.12*math.sin(3*t+u0)
        du,dv=ru*r*math.cos(t),rv*r*math.sin(t)
        du,dv=du*math.cos(ang)-dv*math.sin(ang),du*math.sin(ang)+dv*math.cos(ang)
        pts.append(to_xy(u0+du,v0+dv))
    solid([[(x,y,-0.05) for x,y in pts],[(x,y,0.06) for x,y in pts]],"water")
def in_water(x,y,pad=0.0):
    u,v=to_uv(x,y)
    if -10.0<=v<=10.0 and abs(u-ch_u(v))<ch_w(v)+pad: return True
    for u0,v0,ru,rv,ang in PONDS:
        du,dv=u-u0,v-v0; du,dv=du*math.cos(-ang)-dv*math.sin(-ang),du*math.sin(-ang)+dv*math.cos(-ang)
        if (du/(ru+pad))**2+(dv/(rv+pad))**2<=1.0: return True
    return False

# ---- the boardwalk out across the marsh to an observation deck with a log cabin beside the river
BW=[to_xy(u,v) for u,v in [(11.2,2.6),(8.2,2.6),(6.4,0.6),(4.2,0.6),(2.6,2.2)]]
BWH=0.3; BWW=0.55
for (x0,y0),(x1,y1) in zip(BW,BW[1:]):
    L=math.hypot(x1-x0,y1-y0); a=math.atan2(y1-y0,x1-x0)
    T=dict(cx=(x0+x1)/2,cy=(y0+y1)/2,rot=a)
    box("wood",0,0,BWH-0.08,BWH,L/2+BWW,BWW,T)
    n=max(1,int(L/1.2))
    for k in range(n+1):
        lx=-L/2+L*k/n
        for sy in (-1,1): box("woodd",lx,sy*(BWW-0.08),-0.1,BWH-0.08,0.05,0.05,T)
DU,DV=1.2,2.0; DX,DY=to_xy(DU,DV); TD=dict(cx=DX,cy=DY,rot=ROT)
DZ=0.4
box("wood",0,0,DZ-0.1,DZ,2.0,1.5,TD)
for x in (-1.9,-0.95,0.0,0.95,1.9):
    for y in (-1.4,1.4): box("woodd",x,y,-0.1,DZ-0.1,0.06,0.06,TD)
for (x0,y0,x1,y1) in [(-2.0,-1.5,2.0,-1.5),(-2.0,1.5,-0.3,1.5),(-2.0,-1.5,-2.0,1.5),(2.0,-1.5,2.0,0.2)]:   # railing; open toward the boardwalk
    L=max(abs(x1-x0),abs(y1-y0))/2
    box("woodd",(x0+x1)/2,(y0+y1)/2,DZ+0.55,DZ+0.62,L+0.03 if y0==y1 else 0.03,0.03 if y0==y1 else L+0.03,TD)
    n=max(1,int(2*L/0.5))
    for k in range(n+1):
        t=k/n; box("woodd",x0+(x1-x0)*t,y0+(y1-y0)*t,DZ,DZ+0.6,0.025,0.025,TD)
# the log cabin at the back of the deck: stacked logs, a steep dark roof, a lit window
CXl,CYl=0.9,0.55
for k in range(6):
    z=DZ+k*0.2
    box("wood" if k%2==0 else "woodd",CXl,CYl,z,z+0.2,0.85,0.6,TD)
box("woodd",CXl,CYl-0.61,DZ,DZ+0.95,0.22,0.02,TD)                        # door
box("glow_window",CXl+0.5,CYl-0.61,DZ+0.5,DZ+0.85,0.18,0.02,TD)
cx,cy=xf([(CXl,CYl,0)],**TD)[0][:2]
extrude_x("black",[(-0.95,DZ+1.15),(0.95,DZ+1.15),(0.95,DZ+1.27),(0,DZ+2.1),(-0.95,DZ+1.27)],-1.1,1.1,dict(cx=cx,cy=cy,rot=ROT))
box("woodd",0,0,DZ+1.85,DZ+2.35,0.09,0.09,dict(cx=cx+0.35,cy=cy+0.35))   # stovepipe
def floor_at(x,y):
    u,v=to_uv(x,y)
    lu,lv=u-DU,v-DV
    if abs(lv)<=2.0 and abs(lu)<=1.5: return DZ
    for (x0,y0),(x1,y1) in zip(BW,BW[1:]):
        ex,ey=x1-x0,y1-y0; L2=ex*ex+ey*ey; t=max(0,min(1,((x-x0)*ex+(y-y0)*ey)/L2))
        if math.hypot(x-x0-t*ex,y-y0-t*ey)<=BWW: return BWH
    return 0.0
def bw_dist(x,y):
    best=1e9
    for (x0,y0),(x1,y1) in zip(BW,BW[1:]):
        ex,ey=x1-x0,y1-y0; L2=ex*ex+ey*ey; t=max(0,min(1,((x-x0)*ex+(y-y0)*ey)/L2))
        best=min(best,math.hypot(x-x0-t*ex,y-y0-t*ey))
    return best

# ---- red-crowned cranes: the main pair displays, while the others wade or feed.
CRANES=[(-3.6,-0.8,0.9,"dance"),(-3.2,0.4,-2.3,"dance"),(2.8,-4.4,2.2,"feed"),(3.4,-3.4,0.4,"stand"),(-6.8,2.0,-0.6,"stand"),(-7.4,3.0,0.8,"feed"),(6.6,-1.2,2.8,"stand")]

# ---- reed beds: golden mounds of reeds with seed heads standing above them, and alder trees dotted over the marsh
placed=[(to_xy(u,v)[0],to_xy(u,v)[1],1.7) for u,v,_,_ in CRANES]+[(DX,DY,2.8)]
def free(x,y,d): return all(math.hypot(x-px,y-py)>=d+pr for px,py,pr in placed)
def ok(x,y,r):
    if abs(x)>FH-0.4-r or abs(y)>FH-0.4-r: return False
    if in_water(x,y,0.25+r) or bw_dist(x,y)<BWW+0.35+r: return False
    return free(x,y,r)
# the forest edge along the far side: the broadleaf woods round the marsh (oak, alder, birch), billowing crowns
# standing thick at the footprint's back and thinning into alder scrub where the marsh begins
def broadleaf(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    if rng.random()<0.25:                                  # a white birch
        solid([ngon(0.1,-0.3,5),ngon(0.07,1.9,5,0,0.05,0)],"white",T)
        ico("foliage",0.05,0,2.25,0.75,0.7,0.85,T); ico("foliage",0.35,0.25,1.75,0.45,0.4,0.45,T)
        return
    solid([ngon(0.17,-0.3,5),ngon(0.12,1.2,5,0,0.08,0)],"bark",T)
    m=rng.choice(("leafd","leafd","foliage"))
    ico(m,0,0,2.1,1.25,1.15,0.95,T)
    ico(m,0.75,0.35,1.65,0.8,0.75,0.65,T)
    ico("foliage" if m=="leafd" else "leafd",-0.6,-0.4,1.75,0.75,0.7,0.6,T)
def shrub(x,y,s):
    ico("foliage",0,0,0.25,0.75,0.65,0.5,dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28)))
n=0; tries=0
while n<17 and tries<4000:
    tries+=1
    u=rng.uniform(-15.5,-6.8); v=rng.uniform(-11.0,11.0); x,y=to_xy(u,v)
    edge=-u-6.8                                       # how far into the forest band
    if rng.random()>min(1.0,0.25+edge/4.0): continue  # thicker toward the back
    if not ok(x,y,0.85) or abs(x)>FH-1.4 or abs(y)>FH-1.4: continue
    broadleaf(x,y,rng.uniform(0.85,1.15)); placed.append((x,y,0.85)); n+=1
n=0; tries=0
while n<10 and tries<3000:
    tries+=1
    u=rng.uniform(-9.5,-5.2); v=rng.uniform(-10.5,10.5); x,y=to_xy(u,v)
    if not ok(x,y,0.6): continue
    shrub(x,y,rng.uniform(0.8,1.2)); placed.append((x,y,0.6)); n+=1
def alder(x,y,s):
    T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.11,-0.3,5),ngon(0.08,1.4,5,0,0.1,0),ngon(0.05,2.0,5,0,0.0,0.1)],"bark",T)
    ico("foliage",0.05,0.05,2.15,0.75,0.7,0.55,T); ico("foliage",0.45,-0.2,1.7,0.5,0.45,0.4,T)
n=0; tries=0
while n<9 and tries<2000:
    tries+=1; x,y=rng.uniform(-FH,FH),rng.uniform(-FH,FH)
    if to_uv(x,y)[0]>2.0 and rng.random()<0.6: continue   # most alders near the forest side
    if not ok(x,y,0.9): continue
    alder(x,y,rng.uniform(0.8,1.1)); placed.append((x,y,0.9)); n+=1
def mound(x,y,r):
    T=dict(cx=x,cy=y,rot=rng.uniform(0,6.28))
    m="reed" if rng.random()<0.75 else "reedg"
    ico(m,0,0,0.05,r,r*rng.uniform(0.6,0.9),0.26,T)                       # the dense lower stems
    for k in range(7):                                                      # tall blades fanning out of it
        a=rng.uniform(0,6.28); d=rng.uniform(0,r*0.7); lean=rng.uniform(0.05,0.25)
        bx,by=d*math.cos(a),d*math.sin(a)
        cone(m if k%3 else "reed",ngon(0.045,0.15,3,a,bx,by),(bx+lean*math.cos(a),by+lean*math.sin(a),rng.uniform(0.75,1.25)),T)
n=0; tries=0
while n<54 and tries<6000:
    tries+=1; x,y=rng.uniform(-FH,FH),rng.uniform(-FH,FH); r=rng.uniform(0.7,1.3)
    if not ok(x,y,r*0.8): continue
    mound(x,y,r); placed.append((x,y,r*0.8)); n+=1
# single reed clumps along the water's edge
n=0; tries=0
while n<70 and tries<6000:
    tries+=1; x,y=rng.uniform(-FH,FH),rng.uniform(-FH,FH)
    if not in_water(x,y,0.55) or in_water(x,y,0.12) or bw_dist(x,y)<BWW+0.5 or not free(x,y,0.15): continue
    if abs(x)>FH-0.6 or abs(y)>FH-0.6: continue
    T=dict(cx=x,cy=y)
    for k in range(3):
        a=2.1*k+rng.uniform(0,1); d=0.08
        cone("reedg" if rng.random()<0.5 else "reed",ngon(0.04,-0.05,4,0,d*math.cos(a),d*math.sin(a)),(d*math.cos(a)*2.5,d*math.sin(a)*2.5,rng.uniform(0.6,0.95)),T)
    placed.append((x,y,0.15)); n+=1
STAND=to_xy(10.4,2.6)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/kushiro-shitsugen.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=FH; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y): return floor_at(x,y)   # the boardwalk and the deck; the game draws the marsh ground beneath
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
INTERACT=(DX,DY)     # the observation deck
# STAND (set above): the start of the boardwalk
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]],"terrainSurface":True}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/kushiro-shitsugen.json"
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
    objname=key if key.startswith("glow_") else "kushiro_"+key
    me=bpy.data.meshes.new(objname); me.from_pydata(vs,[],fs); me.validate(); me.update()
    for p in me.polygons: p.use_smooth=False
    me.materials.append(getmat(matname))
    ob=bpy.data.objects.new(objname,me); col.objects.link(ob)
    stats[objname]=sum(len(p.vertices)-2 for p in me.polygons)
    allv+= [v.co.copy() for v in me.vertices]
# ---- Crane articulation. Keep these parts out of the static terrain/collider bake.
FPS=24
CYCLE=18
scene=bpy.context.scene
scene.name="Kushiro Cranes"
scene.render.fps=FPS
scene.frame_end=1+CYCLE*FPS

def joint(name,parent=None,at=(0,0,0)):
    ob=bpy.data.objects.new(name,None)
    col.objects.link(ob)
    ob.parent=parent
    ob.location=at
    return ob

def bird_part(pivot,draw):
    global B
    static=B
    B={}
    try:
        draw()
        for key,(vs,fs) in B.items():
            name=pivot.name+"_"+key
            me=bpy.data.meshes.new(name)
            me.from_pydata(vs,[],fs)
            me.update()
            me.materials.append(getmat(key))
            ob=bpy.data.objects.new(name,me)
            col.objects.link(ob)
            ob.parent=pivot
            stats[name]=sum(len(face)-2 for face in fs)
    finally:
        B=static

def pulse(t,start,rise,fall,end):
    return smooth(start,rise,t)*(1-smooth(fall,end,t))

def animate_crane(index,u,v,face,pose):
    name=f"crane_{index}"
    x,y=to_xy(u,v)
    actor=joint(name,at=(x,y,0))
    actor.scale=(1.5,)*3
    # The landmark loader follows these colliders as the birds move.
    actor["collisionRadius"]=0.19
    actor["collisionHalfLength"]=0.18
    body=joint(name+"_body",actor,(0,0,0.62))
    def torso():
        ico("white",0,0,0,0.34,0.18,0.18)
        ico("black",-0.28,0,0.018,0.16,0.14,0.10)
    bird_part(body,torso)

    neck=joint(name+"_neck",body,(0.22,0,0.028))
    def throat():
        solid([rect(0.053,0.046,-0.02),rect(0.035,0.035,0.39,0.145,0)],"black")
        ico("white",0.171,0,0.417,0.092,0.068,0.071)
        box("red",0.166,0,0.459,0.482,0.047,0.031)
        cone("black",ngon(0.024,0.411,4,0,0.237,0),(0.402,0,0.388))
        for side in (-1,1): ico("black",0.211,side*0.052,0.432,0.017,0.013,0.016)
    bird_part(neck,throat)

    wings=[]
    legs=[]
    for side,label in ((-1,"left"),(1,"right")):
        wing=joint(name+"_wing_"+label,body,(0.075,side*0.125,0.065))
        def feathers():
            panel=[(0.09,0,0),(-0.035,side*0.68,0.05),(-0.44,side*0.46,-0.048),(-0.28,0,-0.022)]
            solid([panel,[(a,b,c+0.027) for a,b,c in panel]],"white")
            tip=[(-0.035,side*0.68,0.05),(-0.23,side*0.72,0.016),(-0.49,side*0.47,-0.044),(-0.33,side*0.38,-0.043)]
            solid([tip,[(a,b,c+0.035) for a,b,c in tip]],"black")
        bird_part(wing,feathers)
        wings.append((wing,side))

        thigh=joint(name+"_leg_"+label,actor,(-0.012,side*0.061,0.51))
        shin=joint(name+"_shin_"+label,thigh,(0,0,-0.234))
        bird_part(thigh,lambda: prism("black",0,0,-0.243,0.025,0.018,0.021,4))
        def foot():
            prism("black",0,0,-0.289,0.009,0.012,0.016,4)
            box("black",0.043,0,-0.295,-0.276,0.052,0.023)
        bird_part(shin,foot)
        legs.append((thigh,shin,side))

    hop_height=0.75 if pose=="dance" else 1.0
    for f in range(1,scene.frame_end+1,2):
        t=(f-1)/FPS
        cycle=math.tau*t/CYCLE
        offset=index*0.36
        if pose=="dance":
            show=max(pulse(t,0.78+offset,1.20+offset,3.20+offset,4.05+offset),
                     pulse(t,10.50+offset,11.05+offset,12.76+offset,13.62+offset))
            beat=(t-offset)*math.tau*1.68
            hop=show*max(0,math.sin(beat-0.19))**2
            distance=0.115*show*math.sin(beat*0.5)
            spread=show*(0.71+0.29*math.sin(beat))
            turn=show*0.14*math.sin(beat*0.54)
            dip=show*(0.10+0.42*max(0,-math.sin(beat))**2)
            stride=show*0.32*math.sin(beat)
        else:
            departure=3.5+index*0.58
            returning=12.8+index*0.20
            out=smooth(departure,departure+1.78,t)
            back=smooth(returning,returning+1.78,t)
            distance=0.52*(out-back)
            step=max(math.sin(math.pi*out),math.sin(math.pi*back))
            stride=0.46*step*math.sin(math.tau*(out-back)*2.2)
            hop=0.057*step*abs(math.sin(math.tau*(out-back)*2.2))
            spread=0.05*step
            turn=0.12*math.sin(cycle*2+offset) + 0.21*(out-back)
            feed=max(pulse(t,1.3+offset,2.2+offset,2.6+offset,3.4+offset),
                     pulse(t,8.02+offset,8.84+offset,9.53+offset,10.42+offset))
            dip=(0.52+1.06*feed) if pose=="feed" else (0.12+0.85*feed)
        actor.location=(x+distance*math.cos(face),y+distance*math.sin(face),hop*hop_height*actor.scale.z)
        actor.rotation_euler.z=face+turn
        actor.keyframe_insert(data_path="location",frame=f)
        actor.keyframe_insert(data_path="rotation_euler",index=2,frame=f)
        body.rotation_euler.y=0.045*math.sin(cycle*3+offset)*math.sin(cycle)+0.08*dip
        body.keyframe_insert(data_path="rotation_euler",index=1,frame=f)
        neck.rotation_euler.y=0.10+dip+0.058*math.sin(cycle*4+offset)
        neck.rotation_euler.z=0.13*math.sin(cycle*3+offset)
        neck.keyframe_insert(data_path="rotation_euler",frame=f)
        for wing,side in wings:
            wing.rotation_euler.x=side*(-0.50+1.51*spread)
            wing.rotation_euler.z=side*(1.10-0.95*spread)
            wing.keyframe_insert(data_path="rotation_euler",frame=f)
        for thigh,shin,side in legs:
            lift=max(0,side*stride)
            thigh.rotation_euler.y=side*stride
            shin.rotation_euler.y=-0.57*lift-0.36*hop
            thigh.keyframe_insert(data_path="rotation_euler",index=1,frame=f)
            shin.keyframe_insert(data_path="rotation_euler",index=1,frame=f)

for index,crane in enumerate(CRANES,1):
    animate_crane(index,*crane)
scene.frame_set(1)

mn=[min(v[i] for v in allv) for i in range(3)]; mx=[max(v[i] for v in allv) for i in range(3)]
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', export_yup=True, export_apply=True,
    export_cameras=False, export_lights=False, export_extras=True, export_animations=True,
    export_animation_mode='SCENE', export_anim_scene_split_object=False, export_anim_slide_to_zero=True,
    export_materials='EXPORT')
clr=min(math.hypot(s[0]-STAND[0],s[1]+STAND[1])-s[2] for s in solids)
res={"stand_clear":round(clr,3),"tris":sum(stats.values()),"per_obj":stats,"materials":len(bpy.data.materials),"min":[round(v,3) for v in mn],"max":[round(v,3) for v in mx],"glb_bytes":os.path.getsize(GLB)}
json.dump(res,open("/tmp/lm_build.json","w"))
