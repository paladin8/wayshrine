# Hirosaki Castle in winter (the keep on its stone wall over the moat, the vermilion bridge, snow) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python hirosaki-castle.py
# Rebuilds content/landmarks/hirosaki-castle.blend and public/models/landmarks/hirosaki-castle.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/hirosaki-castle.glb"
BLEND=ROOT+"/content/landmarks/hirosaki-castle.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"snow":"f1f4f6","plaster":"e8e4dc","tile":"4f5458","stone":"a39e98","darkstone":"7f7a74","vermilion":"d96b59","water":"3fb2bd","bark":"4e3a30","roof":"2a2424","foliage":"4f8a55","glow_cream":"e8dcb0"}
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
rng=random.Random(36)
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


# ---- the grounds: snow all round, the inner moat (L-shaped, in front of and beside the inner bailey) inside a
# snow rim, the inner bailey (honmaru) raised on battered stone walls, the keep on its south-east corner
WATER_Z=-0.25; BED_Z=-0.7; HM=1.7
MS=(-8.5,4.75,-1.75,0.55)     # south moat x0,x1,y0,y1 (the inner edge runs under the wall)
ME=(4.75,7.0,-1.75,7.9)       # east moat
HMP=[(-7.0,0.95),(4.35,0.95),(4.35,7.6),(-5.4,7.6),(-7.0,6.0)]   # honmaru outline (top edge)
def in_rect(x,y,r,pad=0.0): return r[0]-pad<=x<=r[1]+pad and r[2]-pad<=y<=r[3]+pad
def in_moat(x,y): return in_rect(x,y,MS) or in_rect(x,y,ME)
def in_poly(x,y,P):
    c=False; n=len(P)
    for i in range(n):
        (x0,y0),(x1,y1)=P[i],P[(i+1)%n]
        if (y0>y)!=(y1>y) and x<x0+(y-y0)*(x1-x0)/(y1-y0): c=not c
    return c
def in_honmaru(x,y): return in_poly(x,y,HMP)
def H(x,y):
    if in_rect(x,y,MS,-0.25) or in_rect(x,y,ME,-0.25): return BED_Z
    return 0.0

GS=0.8; NG=24
gv={}
for j in range(NG+1):
    for i in range(NG+1):
        x=-9.6+i*GS; y=-9.6+j*GS
        s_=abs(x)+abs(y)
        if s_>18.0:
            e=(s_-18.0)/2; x-=math.copysign(e,x); y-=math.copysign(e,y)
        gv[(i,j)]=(x,y,H(x,y))
gverts=[]; gid={}
for k,v in gv.items(): gid[k]=len(gverts); gverts.append(v)
def area2(a,b,c): return (b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1])
gf=[]; gm=[]
for j in range(NG):
    for i in range(NG):
        a,b,c,d4=(i,j),(i+1,j),(i+1,j+1),(i,j+1)
        for t3 in [(a,b,c),(a,c,d4)]:
            P=[gv[k] for k in t3]
            if area2(*P)<=1e-4: continue
            zc=sum(p[2] for p in P)/3
            gf.append([gid[k] for k in t3]); gm.append("darkstone" if zc<-0.02 else "snow")
emit(gverts,gf,gm,orient=False)
def octo(z,h=9.6,ch=1.2):
    a=h-ch
    return [(-a,-h,z),(a,-h,z),(h,-a,z),(h,a,z),(a,h,z),(-a,h,z),(-h,a,z),(-h,-a,z)]
solid([octo(-1.0),octo(0.0)],"stone",mb=None,mt=None)
# moat water, and stone revetments along its outer banks
emit([(MS[0],MS[2],WATER_Z),(MS[1],MS[2],WATER_Z),(MS[1],MS[3],WATER_Z),(MS[0],MS[3],WATER_Z)],[[0,1,2,3]],["water"],orient=False)
emit([(ME[0],ME[2],WATER_Z),(ME[1],ME[2],WATER_Z),(ME[1],ME[3],WATER_Z),(ME[0],ME[3],WATER_Z)],[[0,1,2,3]],["water"],orient=False)
box("stone",(MS[0]+ME[1])/2,MS[2]-0.08,BED_Z,0.06,(ME[1]-MS[0])/2+0.08,0.1)
box("stone",ME[1]+0.08,(ME[2]+ME[3])/2,BED_Z,0.06,0.1,(ME[3]-ME[2])/2)
box("stone",(ME[0]+ME[1])/2,ME[3]+0.08,BED_Z,0.06,(ME[1]-ME[0])/2+0.18,0.1)
box("stone",MS[0]-0.08,(MS[2]+MS[3])/2,BED_Z,0.06,0.1,(MS[3]-MS[2])/2)

# the honmaru: stone walls with the concave ishigaki profile, flaring outward as they go down into the moat
# (near vertical at the top), snow on top
def offs(P,d):
    # outline pushed outward by d (convex enough for this shape: offset each vertex along its bisector)
    n=len(P); out=[]
    for i in range(n):
        p0,p1,p2=Vector((*P[i-1],0)),Vector((*P[i],0)),Vector((*P[(i+1)%n],0))
        e0=(p1-p0).normalized(); e1=(p2-p1).normalized()
        n0=Vector((e0.y,-e0.x,0)); n1=Vector((e1.y,-e1.x,0))
        b=(n0+n1).normalized(); s=d/max(0.3,b.dot(n0))
        out.append((p1.x+b.x*s,p1.y+b.y*s))
    return out
area=sum(HMP[i][0]*HMP[(i+1)%len(HMP)][1]-HMP[(i+1)%len(HMP)][0]*HMP[i][1] for i in range(len(HMP)))
SG=1 if area>0 else -1        # offs() pushes outward along the right-hand normal of a counter-clockwise outline
rings=[]
ZW=BED_Z; DW=1.2
def wall_d(t): return DW*(1-t)**2
for k in range(7):
    t=k/6; rings.append([(x,y,ZW+(HM-ZW)*t) for x,y in offs(HMP,SG*wall_d(t))])
solid(rings,"stone",mt="snow")
for t in (0.3,0.62):                                              # coursing lines in the stone
    z=ZW+(HM-ZW)*t; r=[(x,y,z) for x,y in offs(HMP,SG*(wall_d(t)+0.02))]
    solid([r,[(x,y,z+0.05) for x,y,_ in r]],"darkstone",mb=None,mt=None)

# ---- the keep (tenshu): three storeys of white plaster under dark copper roofs carrying snow, a big gable on
# the top roof facing the moat, plover gables on the lower roofs, dark lattice windows
KX,KY=1.8,3.15
frus("stone",KX,KY,HM-0.05,HM+0.4,2.62,2.23,2.44,2.05); box("snow",KX,KY,HM+0.4,HM+0.43,2.44,2.05)
Z1=HM+0.4
S=[(2.07,1.67,1.7),(1.72,1.38,1.42),(1.4,1.13,1.3)]
zs=[Z1]
for hx,hy,h in S: zs.append(zs[-1]+h)
for i,(hx,hy,h) in enumerate(S):
    z0=zs[i] if i==0 else zs[i]-0.25
    box("plaster",KX,KY,z0,zs[i+1],hx,hy)
    box("tile",KX,KY,zs[i+1]-0.1,zs[i+1],hx+0.03,hy+0.03)
    windows(KX,KY,hx,hy,zs[i] if i==0 else zs[i]-0.05,zs[i+1],4-i if i<2 else 3,3-i if i<2 else 2)
def snowcap(hx,hy,z,top):
    flared_roof([(hx,hy,z,0.1),(top[0],top[1],top[2],0.0)],"snow",KX,KY)
for i in range(2):
    hx,hy,h=S[i]; nhx,nhy,_=S[i+1]
    skirt(hx,hy,zs[i+1],nhx,nhy,zs[i+1]+0.36,KX,KY,o=0.62)
    snowcap(hx+0.4,hy+0.4,zs[i+1]+0.22,(nhx+0.06,nhy+0.06,zs[i+1]+0.4))
# plover gables on the first roof (front and right) and a bay on the second
gable(KX+0.6,KY-S[0][1]-0.25,zs[1]+0.06,0.0,0.6,0.55,0.55)
gable(KX+S[0][0]+0.25,KY+0.2,zs[1]+0.06,math.pi/2,0.55,0.5,0.55)
gable(KX-0.45,KY-S[1][1]-0.2,zs[2]+0.06,0.0,0.5,0.45,0.45)
# top roof: hip-and-gable, ridge running front to back, the gable facing the moat
hx,hy,h=S[2]; zt=zs[3]
flared_roof([(hx+0.58,hy+0.58,zt,0.3),(hx+0.58,hy+0.58,zt+0.1,0.3),(hx*0.62,hy+0.1,zt+0.5,0.08),(0.14,hy*0.62,zt+1.15,0.0)],"tile",KX,KY)
flared_roof([(hx*0.62+0.03,hy+0.13,zt+0.53,0.06),(0.17,hy*0.62+0.03,zt+1.18,0.0)],"snow",KX,KY)
for sy,rot in ((-1,0.0),(1,math.pi)):
    gable(KX,KY+sy*(hy*0.62-0.05),zt+0.5,rot,hx*0.62-0.05,0.62,0.12)
ZR=zt+1.18
for sy in (-1,1):                                                   # shachi on the ridge ends
    extrude_x("roof",[(KY+sy*(hy*0.62)+sy*py,ZR+pz) for py,pz in [(-0.1,0.0),(0.12,0.0),(0.16,0.2),(0.05,0.4),(0.0,0.22),(-0.12,0.33)]],KX-0.05,KX+0.05)

# ---- the gate where the bridge reaches the wall, and the vermilion Gejo bridge over the south moat
BX=-2.7; BY0=MS[2]-0.2; BY1=0.06; BDZ=0.32
def on_bridge(x,y,pad=0.0): return abs(x-BX)<0.5+pad and BY0-pad<=y<=BY1+0.4+pad
def bridge_z(y):
    t=max(0.0,min(1.0,(y-BY0)/(BY1-BY0))); return BDZ+0.3*math.sin(math.pi*t)
NB=8
for k in range(NB):
    y0=BY0+(BY1-BY0)*k/NB; y1=BY0+(BY1-BY0)*(k+1)/NB
    z0=bridge_z(y0); z1=bridge_z(y1)
    extrude_x("bark",[(y0,z0-0.1),(y1,z1-0.1),(y1,z1),(y0,z0)],BX-0.48,BX+0.48)
    extrude_x("snow",[(y0,z0),(y1,z1),(y1,z1+0.04),(y0,z0+0.04)],BX-0.4,BX+0.4)
for sx in (-1,1):
    for k in range(NB+1):
        y=BY0+(BY1-BY0)*k/NB; z=bridge_z(y)
        box("vermilion",BX+sx*0.46,y,z-0.1,z+0.48,0.04,0.04)
    for k in range(NB):
        y0=BY0+(BY1-BY0)*k/NB; y1=BY0+(BY1-BY0)*(k+1)/NB
        extrude_x("vermilion",[(y0,bridge_z(y0)+0.4),(y1,bridge_z(y1)+0.4),(y1,bridge_z(y1)+0.47),(y0,bridge_z(y0)+0.47)],BX+sx*0.46-0.05,BX+sx*0.46+0.05)
        extrude_x("vermilion",[(y0,bridge_z(y0)+0.18),(y1,bridge_z(y1)+0.18),(y1,bridge_z(y1)+0.22),(y0,bridge_z(y0)+0.22)],BX+sx*0.46-0.03,BX+sx*0.46+0.03)
    for k in (2,4,6):
        y=BY0+(BY1-BY0)*k/NB; box("bark",BX+sx*0.35,y,BED_Z,bridge_z(y)-0.1,0.07,0.07)
# gate (yaguramon) set into the wall at the bridge's end
GZ0=BDZ; GY=BY1+0.75
box("stone",BX,BY1+0.35,BED_Z,BDZ,1.25,0.4,mt="snow")     # stone landing at the water for the gate
box("plaster",BX,GY,GZ0,HM+1.0,1.15,0.75)
box("bark",BX,GY-0.76,GZ0,GZ0+1.15,0.5,0.02)
box("roof",BX,GY-0.77,GZ0+1.15,GZ0+1.25,0.62,0.02)
windows(BX,GY,1.15,0.75,HM+0.15,HM+1.0,3,2)
flared_roof([(1.55,1.15,HM+1.0,0.25),(1.55,1.15,HM+1.1,0.25),(1.05,0.6,HM+1.45,0.06),(0.8,0.1,HM+1.9,0.0)],"tile",BX,GY)
flared_roof([(1.07,0.63,HM+1.48,0.06),(0.83,0.13,HM+1.93,0.0)],"snow",BX,GY)

# ---- snow lanterns (yuki-doro) along the path and the moat bank, candles glowing inside
def snow_lantern(cx,cy,idx):
    box("snow",cx,cy,0.0,0.5,0.3,0.3)
    box("snow",cx,cy,0.5,0.62,0.24,0.24)
    box("glow_lantern_%d"%idx,cx,cy,0.62,0.9,0.2,0.2)
    solid([rect(0.38,0.38,0.9),rect(0.38,0.38,0.98),rect(0.1,0.1,1.2)],"snow",dict(cx=cx,cy=cy))
for i,(x,y) in enumerate([(BX-1.1,-3.9),(BX+1.1,-3.9),(BX-1.1,-5.8),(BX+1.1,-5.8),(8.6,0.6),(8.6,3.8)],1): snow_lantern(x,y,i)
box("stone",BX,-5.3,-0.02,0.03,0.55,3.35)           # trodden path to the bridge

# ---- trees in winter: bare cherry trees holding snow along the moat, snow-laden pines on the honmaru
def winter_sakura(cx,cy,s,z=0.0):
    T=dict(cx=cx,cy=cy,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.16,-0.2,6),ngon(0.12,0.9,6,0,0.12,0)],"bark",T)
    for a,l,t in [(0.3,1.0,0.7),(2.4,0.9,0.8),(4.3,1.0,0.6)]:
        tip=(0.12+l*math.cos(a),l*math.sin(a),0.9+t)
        solid([ngon(0.08,0.85,5,0,0.12,0),ngon(0.03,tip[2],5,0,tip[0],tip[1])],"bark",T)
        ico("snow",tip[0]*0.8,tip[1]*0.8,tip[2]-0.05,0.5,0.45,0.22,T)
    ico("snow",0.1,0,1.75,0.6,0.55,0.25,T)
def snow_pine(cx,cy,s,z=0.0,ph=0.0):
    T=dict(cx=cx,cy=cy,cz=z,s=s)
    prism("bark",0,0,-0.3,0.9,0.2,0.18,6,ph,T)
    for (r,zb,zt,p) in [(1.15,0.7,2.3,ph),(0.9,1.6,3.1,ph+0.4),(0.62,2.4,3.85,ph+0.8)]:
        cone("foliage",ngon(r,zb,7,p),(0,0,zt),T)
        cone("snow",ngon(r*0.55,zb+(zt-zb)*0.45+0.04,7,p),(0,0,zt+0.04),T)
for a in [(-5.6,-4.0,0.95),(-4.4,-6.4,0.85),(0.6,-4.0,0.9),(3.2,-4.1,0.85),(8.7,5.9,0.8),(8.6,-3.9,0.8),(-8.6,-3.4,0.8)]: winter_sakura(*a)
for (x,y,s,p) in [(-4.4,4.4,0.85,0.3),(-1.8,5.9,0.8,0.7),(-5.6,2.4,0.75,0.1),(0.9,6.6,0.75,0.5),(-2.8,2.6,0.6,0.9)]: snow_pine(x,y,s,HM,p)
for (x,y,s,p) in [(-7.6,-6.4,0.75,0.2),(5.8,-6.8,0.6,0.6)]: snow_pine(x,y,s,0.0,p)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/hirosaki-castle.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=9.6; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
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
INTERACT=(BX,BY0-0.9)           # the foot of the bridge
STAND=(BX,-7.7)                 # on the path to the bridge
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[round(INTERACT[0],2),round(-INTERACT[1],2)],"reach":3.6,"stand":[STAND[0],-STAND[1]]}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/hirosaki-castle.json"
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
    objname=key if key.startswith("glow_") else "hirosaki_"+key
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
