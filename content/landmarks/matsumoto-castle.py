# Matsumoto Castle (the black 'crow castle': keep, small keep, turrets and moon-viewing pavilion over its moat) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python matsumoto-castle.py
# Rebuilds content/landmarks/matsumoto-castle.blend and public/models/landmarks/matsumoto-castle.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/matsumoto-castle.glb"
BLEND=ROOT+"/content/landmarks/matsumoto-castle.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"terrain":"86a75e","foliage":"4f8a55","black":"2e2e33","plaster":"e8e4dc","tile":"6a6e74","stone":"a39e98","darkstone":"7f7a74","vermilion":"d96b59","water":"3fb2bd","bark":"4e3a30","glow_cream":"e8dcb0"}
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
rng=random.Random(10)
H=lambda x,y: 0.0   # flat grounds; the game's terrain draws the grass (terrainSurface)
EXTRA_SOLIDS=[]

def rr(hx,hy,z,ox,oy,ch=0.8):
    return [(ox-hx+ch,oy-hy,z),(ox+hx-ch,oy-hy,z),(ox+hx,oy-hy+ch,z),(ox+hx,oy+hy-ch,z),
            (ox+hx-ch,oy+hy,z),(ox-hx+ch,oy+hy,z),(ox-hx,oy+hy-ch,z),(ox-hx,oy-hy+ch,z)]
def windows(cx,cy,hx,hy,z0,z1,nf,ns):
    # small dark windows on the faces the game camera sees (front -y, right +x)
    zc0,zc1=z0+(z1-z0)*0.38,z0+(z1-z0)*0.38+0.24
    for k in range(nf):
        x=cx-hx+2*hx*(k+0.5)/nf; box("roof",x,cy-hy-0.02,zc0,zc1,0.1,0.03)
    for k in range(ns):
        y=cy-hy+2*hy*(k+0.5)/ns; box("roof",cx+hx+0.02,y,zc0,zc1,0.03,0.1)
def gable(cx,cy,zb,rot,w,h,depth):
    # triangular "plover" gable (chidori-hafu): white plaster face under a grey bargeboard
    T=dict(cx=cx,cy=cy,cz=zb,rot=rot)
    extrude_y("snow",[(-w,0),(w,0),(0,h)],0.1,-depth,T)
    extrude_y("tile",[(-w-0.14,-0.04),(0,h+0.13),(w+0.14,-0.04),(w-0.04,-0.04),(0,h-0.03),(-w+0.04,-0.04)],0.12,-(depth+0.1),T)
def kara(cx,cy,zb,rot,w,h,depth):
    # undulating curved gable (kara-hafu)
    T=dict(cx=cx,cy=cy,cz=zb,rot=rot)
    lo=[(-w,0),(-0.6*w,0.25*h),(-0.25*w,0.75*h),(0,0.85*h),(0.25*w,0.75*h),(0.6*w,0.25*h),(w,0)]
    extrude_y("snow",lo,0.1,-depth,T)
    hi=[(w+0.16,-0.06),(0.62*w,0.25*h+0.14),(0.25*w,0.75*h+0.14),(0,0.85*h+0.15),(-0.25*w,0.75*h+0.14),(-0.62*w,0.25*h+0.14),(-w-0.16,-0.06)]
    extrude_y("tile",[(x,z) for x,z in lo]+hi,0.12,-(depth+0.1),T)
def shachi(cx,cy,z,axis_x=True):
    prof=[(-0.1,0.0),(0.12,0.0),(0.16,0.2),(0.05,0.4),(0.0,0.22),(-0.12,0.33)]
    if axis_x:
        for sx in (-1,1): extrude_y("gold",[(cx+sx*(0.0)+sx*0+px*sx,z+pz) for px,pz in prof],cy-0.06,cy+0.06)
def ridge_shachi(cx,cy,hx,z):
    for sx in (-1,1):
        extrude_y("gold",[(cx+sx*hx+sx*px,z+pz) for px,pz in [(-0.1,0.0),(0.12,0.0),(0.16,0.2),(0.05,0.4),(0.0,0.22),(-0.12,0.33)]],cy-0.06,cy+0.06)
def skirt(hx,hy,z1,nhx,nhy,nz0,cx,cy,o=0.45):
    # shallow eaves, so the white walls show from the game camera
    flared_roof([(hx+o,hy+o,z1,0.25),(hx+o,hy+o,z1+0.1,0.25),(hx+o*0.45,hy+o*0.45,z1+0.22,0.08),(nhx+0.05,nhy+0.05,nz0+0.02,0.0)],"tile",cx,cy)



# ---- the grounds: lawn all round, a wide moat in front of the castle inside a grass rim, the castle complex on a
# stone base whose front rises straight out of the water
FH=11.2   # footprint half-width (the sidecar's half): the whole complex and its moat need the room
WATER_Z=-0.25; BED_Z=-0.75; HM=1.5
MS=(-9.6,9.0,-4.9,-1.1)        # the moat x0,x1,y0,y1 (its inner edge runs under the base's front wall)
HMP=[(-5.4,-1.4),(4.8,-1.4),(4.8,2.8),(-5.4,2.8)]   # the base outline (top edge), counter-clockwise
def in_rect(x,y,r,pad=0.0): return r[0]-pad<=x<=r[1]+pad and r[2]-pad<=y<=r[3]+pad
def in_moat(x,y): return in_rect(x,y,MS)
def in_poly(x,y,P):
    c=False; n=len(P)
    for i in range(n):
        (x0,y0),(x1,y1)=P[i],P[(i+1)%n]
        if (y0>y)!=(y1>y) and x<x0+(y-y0)*(x1-x0)/(y1-y0): c=not c
    return c
def in_honmaru(x,y): return in_poly(x,y,HMP)
def H(x,y):
    if in_rect(x,y,MS,-0.25): return BED_Z
    return 0.0
GS=0.8; NG=int(round(2*FH/GS))
gv={}
for j in range(NG+1):
    for i in range(NG+1):
        x=-FH+i*GS; y=-FH+j*GS; gv[(i,j)]=(x,y,H(x,y))
gverts=[]; gid={}
for k,v in gv.items(): gid[k]=len(gverts); gverts.append(v)
gf=[]; gm=[]
for j in range(NG):
    for i in range(NG):
        a,b,c,d4=(i,j),(i+1,j),(i+1,j+1),(i,j+1)
        for t3 in [(a,b,c),(a,c,d4)]:
            P=[gv[k] for k in t3]
            zc=sum(p[2] for p in P)/3
            gf.append([gid[k] for k in t3]); gm.append("darkstone" if zc<-0.02 else "terrain")
emit(gverts,gf,gm,orient=False)
solid([[(-FH,-FH,-1.0),(FH,-FH,-1.0),(FH,FH,-1.0),(-FH,FH,-1.0)],[(-FH,-FH,0.0),(FH,-FH,0.0),(FH,FH,0.0),(-FH,FH,0.0)]],"darkstone",mb=None,mt=None)
emit([(MS[0],MS[2],WATER_Z),(MS[1],MS[2],WATER_Z),(MS[1],MS[3],WATER_Z),(MS[0],MS[3],WATER_Z)],[[0,1,2,3]],["water"],orient=False)
box("stone",(MS[0]+MS[1])/2,MS[2]-0.08,BED_Z,0.06,(MS[1]-MS[0])/2+0.08,0.1)       # stone-lined outer bank
for x in (MS[0]-0.08,MS[1]+0.08): box("stone",x,(MS[2]+MS[3])/2,BED_Z,0.06,0.1,(MS[3]-MS[2])/2)
for (x0,x1) in [(MS[0],-6.6),(5.9,MS[1])]: box("stone",(x0+x1)/2,MS[3]+0.08,BED_Z,0.06,(x1-x0)/2,0.1)

# the stone base (ishigaki): concave, flaring outward as it goes down, lawn on top
def offs(P,d):
    n=len(P); out=[]
    for i in range(n):
        p0,p1,p2=Vector((*P[i-1],0)),Vector((*P[i],0)),Vector((*P[(i+1)%n],0))
        e0=(p1-p0).normalized(); e1=(p2-p1).normalized()
        n0=Vector((e0.y,-e0.x,0)); n1=Vector((e1.y,-e1.x,0))
        b=(n0+n1).normalized(); s=d/max(0.3,b.dot(n0))
        out.append((p1.x+b.x*s,p1.y+b.y*s))
    return out   # pushed outward along the right-hand normal of a counter-clockwise outline
ZW=BED_Z; DW=1.0
def wall_d(t): return DW*(1-t)**2
solid([[(x,y,ZW+(HM-ZW)*k/6) for x,y in offs(HMP,wall_d(k/6))] for k in range(7)],"stone",mt="terrain")
for t in (0.32,0.64):
    z=ZW+(HM-ZW)*t; r=[(x,y,z) for x,y in offs(HMP,wall_d(t)+0.02)]
    solid([r,[(x,y,z+0.05) for x,y,_ in r]],"darkstone",mb=None,mt=None)

# ---- the towers: black lacquered boards below a white plaster band under each grey roof
def storey(cx,cy,hx,hy,z0,z1):
    box("black",cx,cy,z0,z1,hx,hy)
    box("plaster",cx,cy,z1-min(0.45,(z1-z0)*0.36),z1-0.04,hx+0.012,hy+0.012)
def gable_b(cx,cy,zb,rot,w,h,depth):
    # a plover gable (chidori-hafu): black boards under a grey bargeboard edged in white
    T=dict(cx=cx,cy=cy,cz=zb,rot=rot)
    extrude_y("black",[(-w,0),(w,0),(0,h)],0.1,-depth,T)
    extrude_y("tile",[(-w-0.14,-0.04),(0,h+0.13),(w+0.14,-0.04),(w-0.04,-0.04),(0,h-0.03),(-w+0.04,-0.04)],0.12,-(depth+0.1),T)
    extrude_y("plaster",[(-w-0.02,0.0),(0,h+0.02),(w+0.02,0.0),(w-0.04,0.0),(0,h-0.05),(-w+0.04,0.0)],-depth-0.02,-depth-0.04,T)
def kara_b(cx,cy,zb,rot,w,h,depth):
    # a curved gable (kara-hafu)
    T=dict(cx=cx,cy=cy,cz=zb,rot=rot)
    lo=[(-w,0),(-0.6*w,0.25*h),(-0.25*w,0.75*h),(0,0.85*h),(0.25*w,0.75*h),(0.6*w,0.25*h),(w,0)]
    extrude_y("black",lo,0.1,-depth,T)
    hi=[(w+0.16,-0.06),(0.62*w,0.25*h+0.14),(0.25*w,0.75*h+0.14),(0,0.85*h+0.15),(-0.25*w,0.75*h+0.14),(-0.62*w,0.25*h+0.14),(-w-0.16,-0.06)]
    extrude_y("tile",[(x,z) for x,z in lo]+hi,0.12,-(depth+0.1),T)
def tower(cx,cy,S,z0,o=0.3,top_ridge_x=True):
    zs=[z0]
    for hx,hy,h in S: zs.append(zs[-1]+h)
    for i,(hx,hy,h) in enumerate(S):
        storey(cx,cy,hx,hy,zs[i] if i==0 else zs[i]-0.2,zs[i+1])
        if i<len(S)-1:
            nhx,nhy,_=S[i+1]; skirt(hx,hy,zs[i+1],nhx,nhy,zs[i+1]+0.3,cx,cy,o=o)
    hx,hy,_=S[-1]; zt=zs[-1]
    if top_ridge_x: spec=[(hx+o,hy+o,zt,0.28),(hx+o,hy+o,zt+0.1,0.28),(hx+0.1,hy*0.6,zt+0.45,0.08),(hx*0.55,0.12,zt+1.0,0.0)]
    else: spec=[(hx+o,hy+o,zt,0.28),(hx+o,hy+o,zt+0.1,0.28),(hx*0.6,hy+0.1,zt+0.45,0.08),(0.12,hy*0.55,zt+1.0,0.0)]
    flared_roof(spec,"tile",cx,cy)
    return zs
# main keep (daitenshu): five roofs, gables layered up the front and the right side
KX,KY=0.0,0.7
box("stone",KX,KY,HM-0.05,HM+0.25,2.35,1.95,mt="terrain")
S=[(2.2,1.8,1.55),(1.9,1.55,1.25),(1.62,1.32,1.15),(1.36,1.1,1.1),(1.12,0.92,1.15)]
zs=tower(KX,KY,S,HM+0.25,top_ridge_x=False)
gable_b(KX-0.9,KY-S[0][1]-0.25,zs[1]+0.06,0.0,0.62,0.6,0.5)
gable_b(KX+0.9,KY-S[0][1]-0.25,zs[1]+0.06,0.0,0.62,0.6,0.5)
kara_b(KX,KY-S[1][1]-0.2,zs[2]+0.05,0.0,0.75,0.55,0.4)
gable_b(KX,KY-S[2][1]-0.2,zs[3]+0.05,0.0,0.8,0.7,0.45)
gable_b(KX+S[1][0]+0.2,KY,zs[2]+0.05,math.pi/2,0.6,0.55,0.45)
gable_b(KX+S[3][0]+0.2,KY,zs[4]+0.05,math.pi/2,0.5,0.5,0.4)
hx,hy,_=S[-1]
for sy,rot in ((-1,0.0),(1,math.pi)): gable_b(KX,KY+sy*(hy*0.55-0.05),zs[-1]+0.45,rot,hx*0.6-0.05,0.55,0.1)
# the small keep (Inui-kotenshu) on the left, linked by a two-storey passage tower (watari-yagura)
IX,IY=-4.05,1.0
box("stone",IX,IY,HM-0.05,HM+0.15,1.35,1.15,mt="terrain")
tower(IX,IY,[(1.2,1.0,1.25),(1.0,0.84,1.05),(0.82,0.68,1.0)],HM+0.15,o=0.28)
storey(-2.45,0.9,0.45,0.85,HM,HM+1.25); storey(-2.45,0.9,0.38,0.75,HM+1.05,HM+2.05)
skirt(0.45,0.85,HM+1.25,0.38,0.75,HM+1.5,-2.45,0.9,o=0.25)
flared_roof([(0.65,1.05,HM+2.05,0.18),(0.65,1.05,HM+2.15,0.18),(0.4,0.6,HM+2.4,0.05),(0.12,0.45,HM+2.7,0.0)],"tile",-2.45,0.9)
# the Tatsumi turret and the open moon-viewing pavilion (Tsukimi-yagura) with its red railing, on the right
tower(3.05,0.45,[(0.85,0.8,1.25),(0.7,0.66,1.0)],HM+0.1,o=0.28)
TX,TY=4.15,0.1; TZ=HM+0.25
box("black",TX,TY,HM,TZ,0.62,0.85)
for sx in (-1,1):
    for sy in (-1,0,1): box("black",TX+sx*0.55,TY+sy*0.75,TZ,TZ+0.95,0.05,0.05)
for (x0,y0,x1,y1) in [(-0.6,-0.83,0.6,-0.83),(0.6,-0.83,0.6,0.83)]:
    L=max(abs(x1-x0),abs(y1-y0))/2
    box("vermilion",TX+(x0+x1)/2,TY+(y0+y1)/2,TZ+0.4,TZ+0.48,L if x0!=x1 else 0.03,L if y0!=y1 else 0.03)
    for k in range(5):
        t=k/4; box("vermilion",TX+x0+(x1-x0)*t,TY+y0+(y1-y0)*t,TZ,TZ+0.45,0.025,0.025)
flared_roof([(1.0,1.2,TZ+0.95,0.22),(1.0,1.2,TZ+1.05,0.22),(0.6,0.75,TZ+1.3,0.06),(0.15,0.45,TZ+1.65,0.0)],"tile",TX,TY)

# ---- the red Uzumi bridge over the moat on the left, to the lawn beside the castle
BX=-7.8; BY0=MS[2]-0.2; BY1=MS[3]+0.2; BDZ=0.1
def on_bridge(x,y,pad=0.0): return abs(x-BX)<0.5+pad and BY0-pad<=y<=BY1+pad
def bridge_z(y):
    t=max(0.0,min(1.0,(y-BY0)/(BY1-BY0))); return BDZ+0.45*math.sin(math.pi*t)
NB=10
for k in range(NB):
    y0=BY0+(BY1-BY0)*k/NB; y1=BY0+(BY1-BY0)*(k+1)/NB; z0=bridge_z(y0); z1=bridge_z(y1)
    extrude_x("vermilion",[(y0,z0-0.1),(y1,z1-0.1),(y1,z1),(y0,z0)],BX-0.48,BX+0.48)
for sx in (-1,1):
    for k in range(NB+1):
        y=BY0+(BY1-BY0)*k/NB; z=bridge_z(y); box("vermilion",BX+sx*0.46,y,z-0.1,z+0.48,0.04,0.04)
    for k in range(NB):
        y0=BY0+(BY1-BY0)*k/NB; y1=BY0+(BY1-BY0)*(k+1)/NB
        extrude_x("vermilion",[(y0,bridge_z(y0)+0.4),(y1,bridge_z(y1)+0.4),(y1,bridge_z(y1)+0.47),(y0,bridge_z(y0)+0.47)],BX+sx*0.46-0.05,BX+sx*0.46+0.05)
    for k in (3,7):
        y=BY0+(BY1-BY0)*k/NB; box("bark",BX+sx*0.35,y,BED_Z,bridge_z(y)-0.1,0.07,0.07)

# ---- the bank: a path along the moat, stone lanterns, and trees round the grounds
box("stone",-1.0,-6.0,-0.02,0.03,8.6,0.5)
box("stone",BX,-7.2,-0.02,0.03,0.5,1.4)
def stone_lantern(cx,cy,idx):
    T=dict(cx=cx,cy=cy)
    box("stone",0,0,-0.05,0.2,0.34,0.34,T)
    prism("stone",0,0,0.2,1.1,0.14,0.12,6,0,T)
    box("stone",0,0,1.1,1.24,0.32,0.32,T)
    box("glow_lantern_%d"%idx,0,0,1.24,1.6,0.22,0.22,T)
    solid([rect(0.52,0.52,1.6),rect(0.52,0.52,1.67),rect(0.12,0.12,1.94)],"stone",T)
    bipyr("stone",0,0,2.0,0.09,1.92,2.14,6,T)
stone_lantern(-6.6,-5.5,1); stone_lantern(-9.0,-5.5,2)
def pine(cx,cy,s,rot):
    T=dict(cx=cx,cy=cy,cz=0.0,s=s,rot=rot)
    solid([ngon(0.14,-0.2,6),ngon(0.12,1.2,6,0,0.25,0),ngon(0.09,2.1,6,0,0.1,0.1)],"bark",T)
    for (x,y,z,r) in [(0.1,0.1,2.2,0.95),(0.55,-0.1,1.55,0.75),(-0.35,0.25,1.3,0.6)]:
        ico("foliage",x,y,z,r,r*0.9,0.3,T)
def roundtree(cx,cy,s):
    T=dict(cx=cx,cy=cy,cz=0.0,s=s)
    prism("bark",0,0,-0.3,1.3,0.22,0.18,6,0,T)
    ico("foliage",0,0,2.15,1.25,1.25,1.05,T)
    ico("foliage",0.55,-0.35,1.6,0.8,0.8,0.65,T)
for a in [(-9.8,-8.0,0.85,0.4),(2.8,-8.4,0.8,2.2),(8.8,-7.8,0.85,4.0),(-6.0,-9.0,0.75,1.2)]: pine(*a)
for a in [(-8.6,2.6,1.0),(-9.4,7.6,0.95),(-5.6,6.8,1.0),(-1.6,7.4,0.9),(2.6,7.0,1.0),(6.8,6.6,0.95),(9.4,3.4,0.9),(7.8,0.4,0.85),(-8.8,-0.2,0.8),(-3.6,9.6,0.9),(5.0,9.6,0.9),(9.6,8.8,0.85)]: roundtree(*a)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/matsumoto-castle.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=FH; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y):
    if on_bridge(x,y): return bridge_z(y)
    if in_moat(x,y): return WATER_Z          # the game's terrain sits under the water
    if in_honmaru(x,y): return HM
    return 0.0
ground=[[round(ground_at(-HALF+GSTEP*ix, -(-HALF+GSTEP*iz)),3) for ix in range(GN)] for iz in range(GN)]
for i in range(GN): ground[0][i]=ground[GN-1][i]=ground[i][0]=ground[i][GN-1]=0.0    # the edge ring is the base height
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
# the moat is not walkable (except along the bridge): cover it with coarser discs
PSTEP=0.6; PR=0.43
for iy in range(int(2*HALF/PSTEP)):
    for ix in range(int(2*HALF/PSTEP)):
        x=-HALF+PSTEP*(ix+0.5); y=-HALF+PSTEP*(iy+0.5)
        if in_moat(x,y) and not on_bridge(x,y,0.5): solids.append([round(x,2),round(-y,2),PR])
solids+=[[round(x,2),round(-y,2),r] for x,y,r in EXTRA_SOLIDS]
INTERACT=(0.0,-6.0)             # the moat bank facing the keep
STAND=(-4.6,-6.0)               # on the path along the moat bank
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[round(INTERACT[0],2),round(-INTERACT[1],2)],"reach":3.6,"stand":[STAND[0],-STAND[1]]}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/matsumoto-castle.json"
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
    objname=key if key.startswith("glow_") else "matsumoto_"+key
    me=bpy.data.meshes.new(objname); me.from_pydata(vs,[],fs); me.validate(); me.update()
    for p in me.polygons: p.use_smooth=False
    me.materials.append(getmat(matname))
    ob=bpy.data.objects.new(objname,me); col.objects.link(ob)
    stats[objname]=sum(len(p.vertices)-2 for p in me.polygons)
    allv+= [v.co.copy() for v in me.vertices]
mn=[min(v[i] for v in allv) for i in range(3)]; mx=[max(v[i] for v in allv) for i in range(3)]
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', export_yup=True, export_apply=True,
    export_cameras=False, export_lights=False, export_extras=True, export_materials='EXPORT')
res={"tris":sum(stats.values()),"per_obj":stats,"materials":len(bpy.data.materials),"min":[round(v,3) for v in mn],"max":[round(v,3) for v in mx],"glb_bytes":os.path.getsize(GLB)}
json.dump(res,open("/tmp/lm_build.json","w"))
