# Kinkaku-ji (the Golden Pavilion) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python kinkaku-ji.py
# Rebuilds content/landmarks/kinkaku-ji.blend and public/models/landmarks/kinkaku-ji.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
HOME=os.path.expanduser("~")
ROOT=HOME+"/coding/wayshrine"
GLB=ROOT+"/public/models/landmarks/kinkaku-ji.glb"
BLEND=ROOT+"/content/landmarks/kinkaku-ji.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"terrain":"86a75e","gold":"e2b34c","water":"3c6f6c","shimmer":"b39445","roof":"2a2424","stone":"a39e98","cream":"e8dcb0","wood":"d1ab80","darkwood":"6e5442","snow":"f1f4f6","foliage":"5f9a52","vermilion":"d96b59","glow_cream":"e8dcb0"}
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
rng=random.Random(11)

# ---- mirror pond (Kyoko-chi): an irregular blob in front of the pavilion
PC=(-0.9,-1.8); PRX,PRY=5.6,4.6
WATER_Z=-0.18; BED_Z=-0.5
def pr(th): return 1+0.08*math.sin(3*th+1.0)+0.05*math.sin(5*th+2.0)
def pond_m(x,y):
    dx=(x-PC[0])/PRX; dy=(y-PC[1])/PRY
    return math.hypot(dx,dy)/pr(math.atan2(dy,dx))
def pond_pt(th,k=1.0):
    r=k*pr(th); return (PC[0]+PRX*r*math.cos(th), PC[1]+PRY*r*math.sin(th))
def ground(x,y): return BED_Z if pond_m(x,y)<0.97 else 0.0
H=lambda x,y: 0.0   # everything outside the pond sits on flat ground

# base slab sides (top at z=0, 1 unit below ground); the top surface is the garden grid
def octo(z,h=9.6,ch=1.2):
    # the full square footprint: no cut corners, so the model's ground meets the game's terrain all round
    return [(-h,-h,z),(h,-h,z),(h,h,z),(-h,h,z)]
solid([octo(-1.0),octo(0.0)],"stone",mb=None,mt=None)

# garden ground: jittered low-poly grid, flat at z=0, dipping to the pond bed
GS=0.8; NG=24
gv={}
for j in range(NG+1):
    for i in range(NG+1):
        x=-9.6+i*GS; y=-9.6+j*GS
        if 0<i<NG and 0<j<NG:
            x+=rng.uniform(-0.22,0.22); y+=rng.uniform(-0.22,0.22)
        gv[(i,j)]=(x,y,ground(x,y))
gverts=[]; gid={}
for k,v in gv.items(): gid[k]=len(gverts); gverts.append(v)
def area2(a,b,c): return (b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1])
gf=[]
for j in range(NG):
    for i in range(NG):
        a,b,c,d4=(i,j),(i+1,j),(i+1,j+1),(i,j+1)
        tr=[(a,b,c),(a,c,d4)] if (i+j)%2==0 else [(a,b,d4),(b,c,d4)]
        for t3 in tr:
            if area2(*[gv[k] for k in t3])>1e-4: gf.append([gid[k] for k in t3])
emit(gverts,gf,["terrain"]*len(gf),orient=False)
# water surface, larger than the pond so its edge tucks under the banks
NW=32
emit([pond_pt(2*math.pi*k/NW,1.18)+(WATER_Z,) for k in range(NW)],[list(range(NW))],["water"],orient=False)

def rock(cx,cy,cz,r):
    ico("stone",0,0,0,r*rng.uniform(0.95,1.25),r*rng.uniform(0.8,1.05),r*0.7,dict(cx=cx,cy=cy,cz=cz,rot=rng.uniform(0,6.28)))
def island(cx,cy,r,n=7):
    rs=[r*rng.uniform(0.8,1.15) for _ in range(n)]; ph=rng.uniform(0,6.28)
    ring=lambda k,z: [(cx+k*rs[i]*math.cos(ph+2*math.pi*i/n), cy+k*0.75*rs[i]*math.sin(ph+2*math.pi*i/n), z) for i in range(n)]
    solid([ring(1.0,BED_Z-0.05),ring(0.82,-0.02),ring(0.5,0.2)],"terrain")
def pine(cx,cy,cz,s,ang):
    # cloud-pruned garden pine: leaning trunk, flat foliage pads
    T=dict(cx=cx,cy=cy,cz=cz,rot=ang,s=s)
    solid([ngon(0.14,-0.25,5),ngon(0.11,0.9,5,0,0.25,0),ngon(0.08,1.55,5,0,0.7,0)],"wood",T)
    ico("foliage",0.8,0.0,1.7,0.9,0.8,0.3,T)
    ico("foliage",0.15,0.35,1.25,0.65,0.6,0.25,T)
    ico("foliage",1.05,-0.45,1.25,0.6,0.55,0.22,T)
    ico("foliage",0.45,-0.1,2.05,0.5,0.45,0.22,T)

# islands, rocks and pines in the pond
# the islands keep to the west half, leaving an open lane of water from the front shore to the pavilion
island(-3.0,-2.6,1.6); island(-4.6,-4.4,0.65)
pine(-3.4,-2.5,0.15,1.0,0.4); pine(-2.3,-2.9,0.15,0.75,2.6)
for (x,y,r) in [(-1.3,0.8,0.3),(-4.5,-4.3,0.3),(-5.4,-1.0,0.32)]: rock(x,y,WATER_Z,r)
# the pavilion's reflection: broken strips of muted gold on the water directly below it in the game view
# (the camera looks along +x/-y, so "below" on screen is toward the front-right of the pavilion's water face)
for k in range(14):
    d=0.45+0.32*k+rng.uniform(-0.06,0.06)                  # distance out from the facade, along the view
    for seg in range(3):
        x0=-1.4+1.75*seg+rng.uniform(-0.25,0.35); L=rng.uniform(0.45,1.25)*(1.0-0.045*k)
        cx,cy=x0+0.707*d,1.2-0.707*d; w=0.06+0.04*rng.random()
        ex,ey=0.707*L/2,0.707*L/2; nx,ny=0.707*w,-0.707*w          # laid level across the screen, as ripples are
        if pond_m(cx-ex,cy-ey)>0.9 or pond_m(cx+ex,cy+ey)>0.9 or rng.random()<0.25: continue
        emit([(cx-ex-nx,cy-ey-ny,WATER_Z+0.012),(cx+ex-nx,cy+ey-ny,WATER_Z+0.012),(cx+ex+nx,cy+ey+ny,WATER_Z+0.012),(cx-ex+nx,cy-ey+ny,WATER_Z+0.012)],[[0,1,2,3]],["shimmer"],orient=False)
for k in range(14):
    th=2*math.pi*k/14+rng.uniform(-0.12,0.12)
    if 35<math.degrees(th)%360<120: continue      # leave the pavilion's shore clear
    x,y=pond_pt(th,1.02); rock(x,y,-0.06,rng.uniform(0.32,0.5))
pine(-5.6,2.6,0.0,1.15,-0.75); pine(-6.4,-6.9,0.0,1.0,2.2)

# ---- Kinkaku (the Golden Pavilion): three storeys, the first partly over the water
PX,PY=1.0,3.6
def at(dx=0,dy=0): return (PX+dx,PY+dy)
def roofr(rings,lift): flared_roof([(hx,hy,z,lift*w) for (hx,hy,z),w in zip(rings,(1.0,1.0,0.35,0.0))],"roof",PX,PY)
# first floor (Hosui-in): dark aged wood, darker than the gold storeys above
box("stone",PX,PY,-0.55,0.25,3.0,2.4)
box("darkwood",PX,PY,0.25,0.4,2.8,2.2)
for xi in range(6):
    for yi in range(5):
        x=-2.5+xi; y=-1.9+0.95*yi
        if xi in (0,5) or yi in (0,4): box("roof",PX+x,PY+y,0.4,2.25,0.1,0.1)
box("darkwood",PX,PY,0.4,2.1,2.15,1.55)
box("darkwood",PX,PY,2.05,2.25,2.6,2.0)
roofr([(3.35,2.75,2.25),(3.35,2.75,2.4),(2.9,2.3,2.58),(2.45,1.85,2.85)],0.42)
# second floor (Choon-do): gold, with a balcony; short eaves so the gold shows from the game camera
box("gold",PX,PY,2.8,2.95,2.75,2.15)
box("gold",PX,PY,2.95,4.7,2.3,1.7)
for dx in (-1.5,0,1.5):
    for sy in (-1,1): box("wood",PX+dx,PY+sy*1.72,3.25,4.4,0.45,0.04)
for dy in (-0.8,0.8):
    for sx in (-1,1): box("wood",PX+sx*2.32,PY+dy,3.25,4.4,0.04,0.45)
for sy in (-1,1): box("gold",PX,PY+sy*2.12,2.95,3.3,2.75,0.04)
for sx in (-1,1): box("gold",PX+sx*2.72,PY,2.95,3.3,0.04,2.15)
box("gold",PX,PY,4.65,4.85,2.42,1.82)
roofr([(3.0,2.4,4.85),(3.0,2.4,4.98),(2.6,2.0,5.12),(1.85,1.35,5.35)],0.4)
# third floor (Kukyo-cho): gold, with wooden shutters like the second floor
box("gold",PX,PY,5.3,5.42,1.75,1.75)
for sy in (-1,1): box("gold",PX,PY+sy*1.72,5.42,5.65,1.75,0.04)
for sx in (-1,1): box("gold",PX+sx*1.72,PY,5.42,5.65,0.04,1.75)
box("gold",PX,PY,5.42,6.85,1.35,1.35)
for k in range(4):
    for dx in (-0.55,0.55): box("wood",dx,-1.37,5.7,6.6,0.4,0.04,dict(cx=PX,cy=PY,rot=k*math.pi/2))
box("gold",PX,PY,6.8,6.98,1.45,1.45)
roofr([(2.05,2.05,6.98),(2.05,2.05,7.1),(1.6,1.6,7.28),(0.18,0.18,7.95)],0.36)
# golden phoenix (hoo) on the peak
PZ=0.3
box("gold",PX,PY,7.6+PZ,7.95+PZ,0.1,0.1)
solid([rect(0.1,0.22,7.95+PZ,PX,PY),rect(0.07,0.16,8.2+PZ,PX,PY-0.04)],"gold")
cone("gold",rect(0.06,0.06,8.12+PZ,PX,PY-0.16),(PX,PY-0.32,8.5+PZ))
for sx in (-1,1):
    extrude_y("gold",[(PX+sx*0.06,8.0+PZ),(PX+sx*0.55,8.62+PZ),(PX+sx*0.3,8.04+PZ)],PY-0.08,PY+0.08)
extrude_x("gold",[(PY+0.12,7.98+PZ),(PY+0.55,8.45+PZ),(PY+0.35,7.98+PZ)],PX-0.05,PX+0.05)
# Sosei: the little fishing pavilion jutting over the water on the west side
AX,AY=PX-3.25,PY-1.4
for sx in (-1,1):
    for sy in (-1,1): box("darkwood",AX+sx*0.6,AY+sy*0.5,BED_Z-0.05,0.15,0.07,0.07)
box("darkwood",AX,AY,0.1,0.22,0.78,0.68)
box("darkwood",AX,AY,0.22,1.15,0.55,0.45)
flared_roof([(1.0,0.9,1.15,0.2),(1.0,0.9,1.27,0.2),(0.75,0.65,1.4,0.07),(0.45,0.2,1.75,0.0)],"roof",AX,AY)

# ---- stone lanterns (fire boxes are separate glow_ objects)
def lantern(cx,cy,idx):
    T=dict(cx=cx,cy=cy)
    box("stone",0,0,-0.05,0.22,0.4,0.4,T)
    prism("stone",0,0,0.22,1.3,0.17,0.15,6,0,T)
    box("stone",0,0,1.3,1.48,0.38,0.38,T)
    box("glow_lantern_%d"%idx,0,0,1.48,1.92,0.27,0.27,T)
    solid([rect(0.62,0.62,1.92),rect(0.62,0.62,2.0),rect(0.14,0.14,2.3)],"stone",T)
    bipyr("stone",0,0,2.38,0.11,2.28,2.56,6,T)
lantern(5.6,-5.0,1); lantern(4.7,0.2,2)

# stepping-stone path along the east bank to the pavilion
PP=[(7.2,-8.6),(7.2,-5.5),(6.6,-2.6),(5.9,0.0),(5.0,2.4),(4.4,4.4)]
def crm(p0,p1,p2,p3,t):
    return tuple(0.5*((2*p1[i])+(-p0[i]+p2[i])*t+(2*p0[i]-5*p1[i]+4*p2[i]-p3[i])*t*t+(-p0[i]+3*p1[i]-3*p2[i]+p3[i])*t**3) for i in (0,1))
dense=[]
for i in range(len(PP)-1):
    p0,p1,p2,p3=PP[max(i-1,0)],PP[i],PP[i+1],PP[min(i+2,len(PP)-1)]
    for k in range(20): dense.append(crm(p0,p1,p2,p3,k/20))
dense.append(PP[-1])
acc=0.3; nxt=0.0
for a,b in zip(dense,dense[1:]):
    seg=math.hypot(b[0]-a[0],b[1]-a[1]); acc+=seg
    if acc>=0.55:
        acc=0.0; h=math.atan2(b[1]-a[1],b[0]-a[0]); off=rng.uniform(-0.08,0.08)
        box("cream",0,0,-0.04,0.05,0.4*rng.uniform(0.85,1.15),0.24,
            dict(cx=b[0]-math.sin(h)*off,cy=b[1]+math.cos(h)*off,rot=h-math.pi/2+rng.uniform(-0.15,0.15)))

# ---- garden trees behind the pavilion (kept off the camera-side corner)
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
for a in [(-6.6,6.4,1.1,0),(-4.0,8.2,1.0,0.3),(-1.2,8.6,0.95,0.6),(6.0,7.8,1.0,0.2)]: conifer(*a)
for a in [(-7.2,3.0,1.0),(2.6,8.6,0.9),(7.4,5.0,0.9),(-7.4,-5.8,0.9)]: roundtree(*a)
for a in [(5.4,-8.2,0.8),(8.2,-2.8,0.8),(-3.0,-8.0,0.8),(3.6,6.9,0.7)]: bush(*a)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/kinkaku-ji.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=9.6; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y):
    # Flat garden at 0; in the pond the water level, so the game's terrain (0.2 lower) sits under the water.
    return WATER_Z if pond_m(x,y)<1.0 else 0.0
ground=[[round(ground_at(-HALF+GSTEP*ix, -(-HALF+GSTEP*iz)),3) for ix in range(GN)] for iz in range(GN)]
CELL=0.3
cellg={}
def cg(cx,cy):
    k=(cx,cy)
    if k not in cellg: cellg[k]=ground_at(-HALF+CELL*(cx+0.5), -HALF+CELL*(cy+0.5))
    return cellg[k]
# Solids baked from the geometry: anything in a band 0.35..1.6 above the local ground (cells over Blender x, y).
solid=set()
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
                    solid.add((cx,cy))
solids=[[round(-HALF+CELL*(cx+0.5),2), round(-(-HALF+CELL*(cy+0.5)),2), 0.22] for cx,cy in sorted(solid)]
# The pond itself is not walkable: cover it (and its sloping bank) with coarser discs.
PSTEP=0.6; PR=0.43
for iy in range(int(2*HALF/PSTEP)):
    for ix in range(int(2*HALF/PSTEP)):
        x=-HALF+PSTEP*(ix+0.5); y=-HALF+PSTEP*(iy+0.5)
        if pond_m(x,y)<1.04: solids.append([round(x,2),round(-y,2),PR])
INTERACT=(4.5,3.2)    # end of the stepping-stone path, beside the pavilion
STAND=(7.0,-8.4)      # start of the path, front-right corner
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]]}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/kinkaku-ji.json"
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
    objname=key if key.startswith("glow_") else "kinkaku_"+key
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
