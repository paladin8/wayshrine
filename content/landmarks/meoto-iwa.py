# Meoto Iwa, the wedded rocks landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python meoto-iwa.py
# Rebuilds content/landmarks/meoto-iwa.blend and public/models/landmarks/meoto-iwa.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/meoto-iwa.glb"
BLEND=ROOT+"/content/landmarks/meoto-iwa.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"terrain":"86a75e","darkstone":"7f7a74","stone":"a39e98","cream":"e8dcb0","snow":"f1f4f6","wood":"d1ab80","roof":"2a2424","foliage":"5f9a52","water":"3fb2bd","glow_cream":"e8dcb0"}
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
rng=random.Random(7)
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
EXTRA_SOLIDS=[]

# ---- the footprint: a small round shore in open water. The sea runs out to the edge all round at the
# region's water level (landmarkWaterLevel in terrain-grid.ts), so the model slots into the game's water.
# The land carries the shrine and a promenade facing the rocks, which stand in the sea off its shore.
LV=-0.6; FLOOR=LV-0.5
IC=(4.2,3.0); IRX,IRY=4.5,4.6   # keeps the outer 1.2 of the footprint open water
def isl_m(x,y):
    dx=(x-IC[0])/IRX; dy=(y-IC[1])/IRY; th=math.atan2(dy,dx)
    return math.hypot(dx,dy)/(1+0.07*math.sin(3*th+0.4)+0.05*math.sin(5*th+1.3)+0.03*math.sin(8*th+0.2))
def shore_pt(th,m):
    # the point at angle th (degrees) round the island where isl_m == m
    c,sn=math.cos(math.radians(th)),math.sin(math.radians(th)); lo,hi=0.0,12.0
    for _ in range(40):
        mid=(lo+hi)/2
        if isl_m(IC[0]+c*mid,IC[1]+sn*mid)<m: lo=mid
        else: hi=mid
    return (IC[0]+c*lo,IC[1]+sn*lo)
def H(x,y):
    m=isl_m(x,y)
    rise=0.35*smooth(4.0,8.5,y)*smooth(4.5,8.0,x)    # a slight rise at the back right for the shrine
    land=(LV+0.1)+(rise-(LV+0.1))*smooth(0.98,0.8,m)   # a short rocky beach down to the water
    k=smooth(0.98,1.05,m); return land*(1-k)+FLOOR*k

GS=0.8; NG=24
gv={}
for j in range(NG+1):
    for i in range(NG+1):
        x=-9.6+i*GS; y=-9.6+j*GS
        if 0<i<NG and 0<j<NG:
            x+=rng.uniform(-0.22,0.22); y+=rng.uniform(-0.22,0.22)
        z=H(x,y)
        if 0<i<NG and 0<j<NG and 0.8<=isl_m(x,y)<1.0: z+=rng.uniform(0.0,0.14)   # rocky shore
        gv[(i,j)]=(x,y,z)
gverts=[]; gid={}
for k,v in gv.items(): gid[k]=len(gverts); gverts.append(v)
def area2(a,b,c): return (b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1])
gf=[]; gm=[]
for j in range(NG):
    for i in range(NG):
        a,b,c,d4=(i,j),(i+1,j),(i+1,j+1),(i,j+1)
        tr=[(a,b,c),(a,c,d4)] if (i+j)%2==0 else [(a,b,d4),(b,c,d4)]
        for t3 in tr:
            P=[gv[k] for k in t3]
            if area2(*P)<=1e-4: continue
            cx=sum(p[0] for p in P)/3; cy=sum(p[1] for p in P)/3
            gf.append([gid[k] for k in t3]); gm.append("darkstone" if isl_m(cx,cy)>0.8 else "terrain")
emit(gverts,gf,gm,orient=False)
# the sea, just under the game's own water tiles: it fills any tile the game keeps as land along the shore
emit([(-9.6,-9.6,LV-0.04),(9.6,-9.6,LV-0.04),(9.6,9.6,LV-0.04),(-9.6,9.6,LV-0.04)],[[0,1,2,3]],["water"],orient=False)

# the landing: a short wooden jetty off the front of the shore, where the boat comes in
J0=shore_pt(-62,0.86); J1=shore_pt(-62,1.18); JD=LV+0.28
jx,jy=J1[0]-J0[0],J1[1]-J0[1]; JL=math.hypot(jx,jy); jh=math.atan2(jy,jx)
def jetty_d(x,y):
    t=max(0.0,min(1.0,((x-J0[0])*jx+(y-J0[1])*jy)/(JL*JL)))
    return math.hypot(x-(J0[0]+jx*t),y-(J0[1]+jy*t)), t
box("wood",0,0,JD-0.1,JD,JL/2+0.2,0.42,dict(cx=(J0[0]+J1[0])/2,cy=(J0[1]+J1[1])/2,rot=jh))
for k in range(4):
    t=k/3
    for sy in (-1,1):
        px=J0[0]+jx*t-math.sin(jh)*sy*0.36; py=J0[1]+jy*t+math.cos(jh)*sy*0.36
        prism("wood",px,py,FLOOR,JD+0.12,0.06,0.06,6,0)

# ---- craggy sea stacks: stacked irregular rings, so the flat shading breaks them into facets
def crag(cx,cy,rings,mat="darkstone",n=8,jit=0.22):
    ph=rng.uniform(0,6.28); out=[]
    for z,r,ox,oy in rings:
        ring=[]
        for i in range(n):
            a=ph+2*math.pi*i/n+rng.uniform(-0.15,0.15); rr_=r*rng.uniform(1-jit,1+jit)
            ring.append((cx+ox+rr_*math.cos(a),cy+oy+rr_*math.sin(a),z+rng.uniform(-0.08,0.08)))
        out.append(ring)
    solid(out,mat)
    return out
def ring_r(rings,z):
    # mean radius and centre offset of a crag's ring spec at height z
    for (z0,r0,x0,y0),(z1,r1,x1,y1) in zip(rings,rings[1:]):
        if z0<=z<=z1:
            t=(z-z0)/(z1-z0); return r0+(r1-r0)*t,x0+(x1-x0)*t,y0+(y1-y0)*t
    return rings[-1][1],rings[-1][2],rings[-1][3]

# the husband rock (tall, a little torii on its peak) and the wife rock, on the diagonal facing the camera
MX,MY=-6.55,-2.28; FX,FY=-2.35,1.82   # both moved out from the islet, along the line from its centre
MR=[(-1.3,1.75,0,0),(0.4,1.85,0,0),(1.6,1.6,0.1,0),(2.8,1.35,0.15,0.1),(3.9,1.1,0.1,0.15),(4.8,0.82,0.12,0.1),(5.45,0.45,0.1,0.1)]
FR=[(-1.3,1.3,0,0),(0.5,1.35,0,0),(1.4,1.1,0,0.05),(2.1,0.78,0.05,0.05),(2.55,0.32,0.05,0.05)]
MRO=crag(MX,MY,MR); FRO=crag(FX,FY,FR,n=7)
for (x,y,r) in [(MX+1.2,MY-1.3,0.45),(MX-1.5,MY+0.9,0.4),(FX+1.0,FY-0.9,0.32),(MX+0.2,MY-1.9,0.3)]:
    crag(x,y,[(-1.3,r*1.1,0,0),(0.0,r,0,0),(r*0.8,r*0.5,0,0)],n=6)
# tufts of green and the little torii on the husband rock's peak
tx,ty=MX+0.1,MY+0.1
for (ox,oy,r) in [(-0.25,0.2,0.32),(0.3,-0.15,0.26),(0.05,0.35,0.22)]: ico("foliage",tx+ox,ty+oy,5.45,r,r,r*0.6)
for sx in (-1,1): prism("wood",tx+sx*0.28,ty-0.15,5.2,6.05,0.05,0.045,6)
box("wood",tx,ty-0.15,5.82,5.88,0.36,0.03)
extrude_y("wood",[(tx-0.44,6.04),(tx+0.44,6.04),(tx+0.48,6.14),(tx-0.48,6.14)],ty-0.2,ty-0.1)

# the sacred rope (shimenawa): five straw strands sagging between rope bands wrapped round each rock
def tube(pts,r,mat,n=5):
    rings=[]
    for i,p in enumerate(pts):
        a=Vector(pts[max(i-1,0)]); b=Vector(pts[min(i+1,len(pts)-1)]); tdir=(b-a).normalized()
        up=Vector((0,0,1)); u=tdir.cross(up).normalized(); v=u.cross(tdir).normalized()
        rings.append([tuple(Vector(p)+r*(math.cos(2*math.pi*k/n)*u+math.sin(2*math.pi*k/n)*v)) for k in range(n)])
    solid(rings,mat)
def surf_r(rings,z,cx,cy,a):
    # distance from (cx, cy) to the crag's actual surface at height z, along the direction a
    zs=[sum(p[2] for p in r)/len(r) for r in rings]
    k=max(0,min(len(rings)-2,max(i for i in range(len(zs)-1) if zs[i]<=z) if z>=zs[0] else 0))
    t=max(0.0,min(1.0,(z-zs[k])/(zs[k+1]-zs[k])))
    poly=[(p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t) for p,q in zip(rings[k],rings[k+1])]
    dx,dy=math.cos(a),math.sin(a); best=0.0
    for (x0,y0),(x1,y1) in zip(poly,poly[1:]+poly[:1]):
        ex,ey=x1-x0,y1-y0; den=dx*ey-dy*ex
        if abs(den)<1e-9: continue
        u=((x0-cx)*ey-(y0-cy)*ex)/den; v=((x0-cx)*dy-(y0-cy)*dx)/den
        if u>0 and -1e-6<=v<=1+1e-6: best=max(best,u)
    return best
def band(rings,cx,cy,z0,z1,mat="cream",n=20,pad=0.07):
    # a rope band hugging the rock: each vertex sits just outside the outermost rock surface around its angle
    # (sampled either side, and a little above and below), so no bulge pokes through between vertices
    def r_at(z,a):
        d=math.pi/n
        return max(surf_r(rings,zz,cx,cy,aa) for zz in (z-0.1,z,z+0.1) for aa in (a-d,a-d/2,a,a+d/2,a+d))+pad
    def ring(z):
        out=[]
        for i in range(n):
            a=2*math.pi*i/n; r=r_at(z,a)/math.cos(math.pi/n)   # the chord between vertices stays outside the arc
            out.append((cx+r*math.cos(a),cy+r*math.sin(a),z))
        return out
    solid([ring(z0),ring(z1)],mat)
_,mox,moy=ring_r(MR,3.3); _,fox,foy=ring_r(FR,1.75)
MCX,MCY=MX+mox,MY+moy; FCX,FCY=FX+fox,FY+foy
band(MRO,MCX,MCY,3.12,3.48); band(FRO,FCX,FCY,1.58,1.92)
dx,dy=FX-MX,FY-MY; L=math.hypot(dx,dy); ux,uy=dx/L,dy/L
ra=surf_r(MRO,3.3,MCX,MCY,math.atan2(uy,ux))+0.08; rb=surf_r(FRO,1.75,FCX,FCY,math.atan2(-uy,-ux))+0.08
A0=(MCX+ux*ra,MCY+uy*ra); B0=(FCX-ux*rb,FCY-uy*rb)
ROPE=[]
for k,off in enumerate((-0.2,-0.1,0.0,0.1,0.2)):
    za,zb=3.3+off*0.7,1.75+off*0.6; sag=0.75-0.04*k
    pts=[]
    for i in range(11):
        t=i/10; pts.append((A0[0]+(B0[0]-A0[0])*t, A0[1]+(B0[1]-A0[1])*t, za+(zb-za)*t-sag*4*t*(1-t)))
    tube(pts,0.06,"cream"); ROPE.append(pts)
# paper streamers (shide) hanging from the lowest strand
for t in (0.25,0.45,0.65,0.82):
    i=round(t*10); x,y,z=ROPE[0][i]
    prof=[(-0.07,0),(0.07,0),(0.07,-0.12),(-0.02,-0.12),(-0.02,-0.2),(0.07,-0.2),(0.07,-0.36),(-0.07,-0.36),(-0.07,-0.24),(0.02,-0.24),(0.02,-0.16),(-0.07,-0.16)]
    T=dict(cx=x,cy=y,cz=z-0.05,rot=math.atan2(uy,ux)); extrude_y("snow",prof,-0.012,0.012,T)
# Frog Rock (Kaeru Iwa) near the shore
KX,KY=2.6,-2.4
crag(KX,KY,[(-1.3,0.95,0,0),(0.1,1.0,0,0),(0.55,0.75,0,-0.05),(0.85,0.4,0,-0.05)],n=7)
for sx in (-1,1): ico("darkstone",KX+sx*0.35,KY-0.4,0.82,0.2,0.2,0.18)

# ---- the shore: a paved promenade along the water, low stone posts, frog statues, lanterns
PROM=[shore_pt(-176+k*8.5,0.74) for k in range(10)]   # from the back of the shore round to the front, facing the rocks
for p,q in zip(PROM,PROM[1:]):
    mx,my=(p[0]+q[0])/2,(p[1]+q[1])/2; h=math.atan2(q[1]-p[1],q[0]-p[0]); Lp=math.hypot(q[0]-p[0],q[1]-p[1])
    box("stone",0,0,-0.05,0.06,Lp/2+0.12,0.62,dict(cx=mx,cy=my,rot=h),mt="cream")
    box("stone",0,0,0.0,0.45,0.07,0.07,dict(cx=mx-math.sin(h)*(-0.72),cy=my+math.cos(h)*(-0.72),rot=h))
def frog(cx,cy,rot,s=1.0):
    T=dict(cx=cx,cy=cy,rot=rot,s=s)
    box("stone",0,0,0.0,0.1,0.28,0.24,T)
    ico("stone",0,0,0.28,0.3,0.26,0.2,T)
    for sy in (-1,1): ico("stone",0.16,sy*0.11,0.44,0.08,0.08,0.07,T)
for k,(th,m) in enumerate([(-150,0.6),(-125,0.6),(-100,0.62),(-40,0.7),(10,0.74),(50,0.74),(-170,0.55)]):
    x,y=shore_pt(th,m); frog(x,y,math.radians(th)+math.pi,1.0+0.25*rng.random())

# ---- Futami Okitama Shrine: plain cypress hall in the Ise style, with a plain wooden torii
SX,SY=5.4,4.8; SZ=H(SX,SY)
box("stone",SX,SY,SZ-0.3,SZ+0.3,1.5,1.2)
box("wood",SX,SY,SZ+0.3,SZ+1.55,1.05,0.75)
for sx in (-1,1):
    for sy in (-1,1): prism("wood",SX+sx*1.0,SY+sy*0.7,SZ+0.3,SZ+1.6,0.08,0.08,6)
box("roof",SX,SY-0.77,SZ+0.45,SZ+1.35,0.35,0.03)
extrude_x("roof",[(SY-1.05,SZ+1.5),(SY+1.05,SZ+1.5),(SY+1.05,SZ+1.62),(SY,SZ+2.35),(SY-1.05,SZ+1.62)],SX-1.35,SX+1.35)   # straight gable
for sx in (-1,1):   # crossed finials (chigi) at the gable ends
    for sy in (-1,1):
        solid([rect(0.04,0.04,SZ+2.1,SX+sx*1.3,SY+sy*0.12),rect(0.04,0.04,SZ+2.75,SX+sx*1.3,SY-sy*0.35)],"wood")
for k in range(4): prism("wood",SX-0.9+0.6*k,SY,SZ+2.3,SZ+2.48,0.09,0.09,6,0)   # ridge logs (katsuogi)
def shinmei_torii(cx,cy,cz,s):
    T=dict(cx=cx,cy=cy,cz=cz,s=s)
    for sx in (-1,1): prism("wood",sx*0.9,0,-0.1,2.3,0.11,0.1,8,0,T)
    box("wood",0,0,1.85,2.0,1.12,0.07,T)
    box("wood",0,0,2.3,2.48,1.3,0.12,T)
shinmei_torii(SX,SY-2.3,H(SX,SY-2.3),0.85)

# ---- stone lanterns (fire boxes are separate glow_ objects)
def lantern(cx,cy,idx):
    T=dict(cx=cx,cy=cy)
    box("stone",0,0,-0.05,0.22,0.4,0.4,T)
    prism("stone",0,0,0.22,1.3,0.17,0.15,6,0,T)
    box("stone",0,0,1.3,1.48,0.38,0.38,T)
    box("glow_lantern_%d"%idx,0,0,1.48,1.92,0.27,0.27,T)
    solid([rect(0.62,0.62,1.92),rect(0.62,0.62,2.0),rect(0.14,0.14,2.3)],"stone",T)
    bipyr("stone",0,0,2.38,0.11,2.28,2.56,6,T)
lantern(*shore_pt(-176,0.66),1); lantern(*shore_pt(-62,0.66),2)

# coastal pines (cloud-pruned), leaning a little toward the sea
def pine(cx,cy,cz,s,ang):
    T=dict(cx=cx,cy=cy,cz=cz,rot=ang,s=s)
    solid([ngon(0.14,-0.25,5),ngon(0.11,0.9,5,0,0.25,0),ngon(0.08,1.55,5,0,0.7,0)],"wood",T)
    ico("foliage",0.8,0.0,1.7,0.9,0.8,0.3,T)
    ico("foliage",0.15,0.35,1.25,0.65,0.6,0.25,T)
    ico("foliage",1.05,-0.45,1.25,0.6,0.55,0.22,T)
    ico("foliage",0.45,-0.1,2.05,0.5,0.45,0.22,T)
for (th,m,sc,a) in [(-20,0.7,1.1,3.0),(25,0.72,1.0,2.8),(80,0.7,1.15,3.6),(125,0.68,1.0,4.2),(-85,0.72,0.9,2.4)]:
    x,y=shore_pt(th,m); pine(x,y,H(x,y),sc,a)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/meoto-iwa.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=9.6; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y):
    d,t=jetty_d(x,y)
    if d<0.45 and t>0.0: return JD
    return max(LV,H(x,y))   # open water at the region's level; the game draws it
ground=[[round(ground_at(-HALF+GSTEP*ix, -(-HALF+GSTEP*iz)),3) for ix in range(GN)] for iz in range(GN)]
for i in range(GN): ground[0][i]=ground[GN-1][i]=ground[i][0]=ground[i][GN-1]=LV     # the edge ring is open water
CELL=0.3
cellg={}
def cg(cx,cy):
    k=(cx,cy)
    if k not in cellg: cellg[k]=ground_at(-HALF+CELL*(cx+0.5), -HALF+CELL*(cy+0.5))
    return cellg[k]
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
                    if nz>0.92 and z<g+0.6: continue
                    solid_cells.add((cx,cy))
solids=[[round(-HALF+CELL*(cx+0.5),2), round(-(-HALF+CELL*(cy+0.5)),2), 0.22] for cx,cy in sorted(solid_cells)]
solids+=[[round(x,2),round(-y,2),r] for x,y,r in EXTRA_SOLIDS]
INTERACT=PROM[len(PROM)//2]   # the promenade, facing the rocks
STAND=(5.55,-1.05)   # on the shore beside the landing, clear of the posts and statues
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[round(INTERACT[0],2),round(-INTERACT[1],2)],"reach":3.6,"stand":[STAND[0],-STAND[1]]}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/meoto-iwa.json"
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
    objname=key if key.startswith("glow_") else "meoto_"+key
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
