# Kappa-bashi, Kamikochi (the timber suspension bridge over the clear Azusa river, the Hotaka peaks behind) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python kappa-bashi.py
# Rebuilds content/landmarks/kappa-bashi.blend and public/models/landmarks/kappa-bashi.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/kappa-bashi.glb"
BLEND=ROOT+"/content/landmarks/kappa-bashi.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"rock":"7d7a78","snow":"eef2f3","forest":"4f6a43","gravel":"c9c3b6","water":"5aa8a8","wood":"9a7a55","darkwood":"4e3a2e","roof":"3a3634","pine":"3d5a3f","larch":"c9a845","plaster":"e6e0d2","glow_cream":"e8dcb0"}
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
rng=random.Random(17)
EXTRA_SOLIDS=[]; FLOORS=[]
FH=11.2   # footprint half-width (the sidecar's half): the middle size
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
S2=math.sqrt(0.5)
# valley axes: u runs down the river toward the viewer (+X/-Y), v across it (+X/+Y, screen right)
def to_xy(u,v): return (S2*(u+v),S2*(v-u))
def to_uv(x,y): return (S2*(x-y),S2*(x+y))
ROT=math.pi/4     # local +x across the river (v), local -y toward the viewer (+u)

def bed_c(u): return 0.6*math.sin(0.33*u+0.4)   # the river's centre line across the valley

# ---- the Hotaka range behind the valley: a faceted heightfield of grey peaks, snow in the high gullies,
# forest on the lower slopes, falling to nothing at the footprint edge
def hsh(i,j,k=0):
    n=(i*73856093)^(j*19349663)^(k*83492791); n=(n<<13)^n
    return ((n*(n*n*15731+789221)+1376312589)&0x7fffffff)/0x7fffffff
def peaks(v): return 0.85*(6.6+2.4*math.exp(-((v-1.0)/2.8)**2)+1.5*math.exp(-((v+4.2)/2.2)**2)+0.9*math.exp(-((v-5.2)/1.8)**2)+0.45*math.sin(1.9*v+0.7))
GSM=0.8; NM=int(round(2*FH/GSM))
def mtn(ix,iy):
    x=-FH+ix*GSM; y=-FH+iy*GSM; u,v=to_uv(x,y)
    u0=-5.2+0.9*math.sin(0.55*v+0.6)+0.5*math.sin(1.3*v)            # a ragged foot, not a straight line
    s=smooth(u0,u0-3.8,u)*(1-0.3*smooth(-10.0,-15.0,u))
    s*=1-0.55*math.exp(-((v-bed_c(u))/2.4)**2)*(1-smooth(-7.0,-10.0,u))   # the valley the river comes out of
    f=smooth(0.0,2.6,FH-max(abs(x),abs(y)))
    h=s*f*(peaks(v)+1.9*(hsh(ix,iy)-0.5))
    return x,y,(h if h>0.02 else 0.0)
MV={(i,j):mtn(i,j) for i in range(NM+1) for j in range(NM+1)}
def snowline(v): return 5.9+0.6*math.sin(2.3*v)+0.5*math.sin(5.1*v+1.0)   # autumn: snow only in the high gullies
verts=[]; faces=[]; fm=[]; vid={}
def vi(k):
    if k not in vid: vid[k]=len(verts); verts.append(MV[k])
    return vid[k]
for i in range(NM):
    for j in range(NM):
        q=[(i,j),(i+1,j),(i+1,j+1),(i,j+1)]
        if max(MV[k][2] for k in q)<=0.0: continue
        for tri in ([q[0],q[1],q[2]],[q[0],q[2],q[3]]) if (i+j)%2==0 else ([q[0],q[1],q[3]],[q[1],q[2],q[3]]):
            zc=sum(MV[k][2] for k in tri)/3; xc=sum(MV[k][0] for k in tri)/3; yc=sum(MV[k][1] for k in tri)/3
            u,v=to_uv(xc,yc)
            faces.append([vi(k) for k in tri])
            fm.append("snow" if zc>snowline(v) else ("forest" if zc<2.2+0.8*hsh(i,j,3) else "rock"))
emit(verts,faces,fm,orient=False)
def mtn_z(x,y):
    fx=(x+FH)/GSM; fy=(y+FH)/GSM; i=min(NM-1,max(0,int(fx))); j=min(NM-1,max(0,int(fy))); tx,ty=fx-i,fy-j
    z=lambda a,b: MV[(a,b)][2]
    return z(i,j)*(1-tx)*(1-ty)+z(i+1,j)*tx*(1-ty)+z(i,j+1)*(1-tx)*ty+z(i+1,j+1)*tx*ty

# ---- the Azusa river: clear turquoise channels braided across a broad bed of pale gravel, coming out from under
# the mountains and running out into the gravel before the footprint edge
def bed_w(u): return (4.2+0.4*math.sin(0.7*u))*smooth(-9.6,-8.0,u)*(1-smooth(5.6,8.4,u))
NB=28; US=[-9.5+(8.4+9.5)*k/(NB-1) for k in range(NB)]
def ribbon(mat,cfun,wfun,z0,z1,us):
    rings=[]
    for u in us:
        c=cfun(u); w=max(0.05,wfun(u))
        a=to_xy(u,c-w); b=to_xy(u,c+w)
        rings.append([(a[0],a[1],z0),(b[0],b[1],z0),(b[0],b[1],z1),(a[0],a[1],z1)])
    solid(rings,mat)
ribbon("gravel",bed_c,bed_w,-0.06,0.03,US)
CH=[(lambda u: bed_c(u)-0.7+0.5*math.sin(0.5*u), lambda u: 1.4*smooth(-9.4,-8.2,u)*(1-smooth(3.2,6.8,u)), -9.2, 6.6),
    (lambda u: bed_c(u)+2.1+0.4*math.sin(0.8*u+1), lambda u: 0.55*math.sin(math.pi*min(1,max(0,(u+2.6)/7.2))), -2.6, 4.6)]
for cf,wf,ua,ub in CH:
    ribbon("water",cf,wf,-0.04,0.07,[ua+(ub-ua)*k/23 for k in range(24)])
def in_water(x,y,pad=0.0):
    u,v=to_uv(x,y)
    for cf,wf,ua,ub in CH:
        if ua<=u<=ub and abs(v-cf(u))<wf(u)+pad: return True
    return False
# gravel-bar boulders and drift logs
def boulder(cx,cy,s,m1="rock",m2="gravel"):
    T=dict(cx=cx,cy=cy,rot=rng.uniform(0,6.28),s=s)
    ico(m1,0,0,0.18,0.62,0.46,0.36,T)
    if rng.random()<0.5: ico(m2,0.3,0.12,0.14,0.36,0.3,0.24,T)
for u,dv,s in [(-6.4,3.0,0.8),(-4.6,-3.2,0.7),(-3.4,3.4,0.6),(2.0,-3.4,0.7),(3.4,0.9,0.6),(5.0,3.0,0.75),(6.4,-2.2,0.6),(-7.6,-2.6,0.9),(7.2,1.0,0.7)]:
    x,y=to_xy(u,bed_c(u)+dv)
    if not in_water(x,y,0.4): boulder(x,y,s)
for u,dv,a in [(2.6,2.6,0.4),(-5.0,1.2,-0.3)]:
    x,y=to_xy(u,bed_c(u)+dv)
    T=dict(cx=x,cy=y,rot=ROT+a); extrude_x("darkwood",[(-0.1,0.02),(0.1,0.02),(0.1,0.2),(-0.1,0.2)],-1.1,1.1,T)

# ---- Kappa-bashi: a timber suspension bridge carried well above the river on stone abutments, its cables slung
# between H-frame towers at each end and anchored on the banks; stiffening cables hang beneath the deck
BU=-1.0; BX,BY=to_xy(BU,0.0); TB=dict(cx=BX,cy=BY,rot=ROT)
L=6.3; DZ=1.6; DW=0.8; RL=4.0     # half-span, deck top, half-width, ramp length
box("wood",0,0,DZ-0.14,DZ,L+0.1,DW,TB)
for k in range(13):
    x=-L+k*(2*L)/12; box("darkwood",x,0,DZ-0.28,DZ-0.14,0.08,DW+0.12,TB)    # cross beams
for sy in (-1,1): box("darkwood",0,sy*(DW+0.02),DZ-0.48,DZ-0.1,L+0.1,0.07,TB)   # the deck girders
for sy in (-1,1):
    for k in range(17):
        x=-L+k*(2*L)/16; box("wood",x,sy*(DW-0.04),DZ,DZ+0.78,0.04,0.04,TB)
    box("wood",0,sy*(DW-0.04),DZ+0.72,DZ+0.82,L,0.05,TB)
    box("wood",0,sy*(DW-0.04),DZ+0.36,DZ+0.42,L,0.03,TB)
for sx in (-1,1):
    box("rock",sx*(L+0.75),0,-0.15,DZ,0.8,1.3,TB)                           # abutment
    extrude_y("rock",[(sx*(L+1.55),-0.1),(sx*(L+1.55+RL),-0.1),(sx*(L+1.55+RL),0.02),(sx*(L+1.55),DZ)],-1.0,1.0,TB)   # ramp down to the bank
    for sy in (-1,1): extrude_y("darkwood",[(sx*(L+1.55),DZ-0.05),(sx*(L+1.55+RL),-0.03),(sx*(L+1.55+RL),0.1),(sx*(L+1.55),DZ+0.08)],sy*1.0-0.06,sy*1.0+0.06,TB)   # kerbs
TX=L+0.6; TZ=DZ+2.3
for sx in (-1,1):
    for sy in (-1,1): box("darkwood",sx*TX,sy*0.98,DZ,TZ+0.2,0.16,0.16,TB)
    box("roof",sx*TX,0,TZ+0.22,TZ+0.32,0.45,1.3,TB)                        # a cap over the tower beam
    for sy in (-1,1):   # knee braces down toward the span, so the frame reads from the side
        extrude_y("darkwood",[(sx*(TX-0.1),TZ-0.15),(sx*(TX-0.1),TZ-0.4),(sx*(TX-0.95),DZ+0.85),(sx*(TX-0.95),DZ+1.05)],sy*0.98-0.06,sy*0.98+0.06,TB)
        extrude_y("darkwood",[(sx*(TX+0.1),TZ-0.15),(sx*(TX+0.1),TZ-0.4),(sx*(TX+0.75),DZ+0.05),(sx*(TX+0.75),DZ+0.25)],sy*0.98-0.06,sy*0.98+0.06,TB)
    box("darkwood",sx*TX,0,TZ,TZ+0.22,0.11,1.22,TB)
    box("darkwood",sx*TX,0,TZ-0.95,TZ-0.8,0.08,1.0,TB)
    for sy in (-1,1): extrude_x("darkwood",[(sy*0.9,TZ-0.95),(sy*0.9,TZ-0.75),(sy*0.15,TZ-0.05),(sy*0.15,TZ-0.25)],sx*TX-0.05,sx*TX+0.05,TB)
def cable(pts,r=0.035):
    rings=[[(x,y-r,z-r),(x,y+r,z-r),(x,y+r,z+r),(x,y-r,z+r)] for x,y,z in pts]
    solid(rings,"roof",TB)
for sy in (-1,1):
    y=sy*1.0
    cable([(-TX+2*TX*k/16,y,DZ+0.95+(TZ+0.05-DZ-0.95)*((-TX+2*TX*k/16)/TX)**2) for k in range(17)])
    for sx in (-1,1): cable([(sx*TX,y,TZ+0.05),(sx*(TX+3.2),y*1.35,0.05)])
    cable([(-L+2*L*k/12,y*0.72,DZ-0.5-0.55*(1-((-L+2*L*k/12)/L)**2)) for k in range(13)],0.03)   # stiffening cable under the deck
    for k in range(1,12):
        x=-L+2*L*k/12; box("roof",x,y*0.72,DZ-0.5-0.55*(1-(x/L)**2),DZ-0.45,0.015,0.015,TB)
    for k in range(1,16):
        x=-TX+2*TX*k/16; zc=DZ+0.95+(TZ+0.05-DZ-0.95)*(x/TX)**2
        if zc>DZ+0.9: box("roof",x,y*0.99,DZ+0.8,zc,0.015,0.015,TB)
for sx in (-1,1):
    for sy in (-1,1): box("rock",sx*(TX+3.2),sy*1.35,-0.1,0.25,0.22,0.22,TB)   # cable anchors
def bridge_floor(x,y):
    lx=(x-BX)*math.cos(ROT)+(y-BY)*math.sin(ROT); ly=-(x-BX)*math.sin(ROT)+(y-BY)*math.cos(ROT)
    if abs(ly)>1.0: return 0.0
    a=abs(lx)
    if a<=L+1.55: return DZ
    if a<=L+1.55+RL: return DZ*(L+1.55+RL-a)/RL
    return 0.0

# ---- the banks: a timber-framed mountain lodge downstream of the right-hand end of the bridge, a little shop on the left bank,
# larches turning gold, dark firs, willows on the gravel's edge
def lodge(u,v,w,d,h,storeys=2):
    x,y=to_xy(u,v); T=dict(cx=x,cy=y,rot=ROT)
    box("plaster",0,0,-0.1,h,w,d,T)
    for k in range(5): box("darkwood",-w+k*w/2,-d-0.02,-0.1,h,0.07,0.03,T)          # timber framing on the front
    for z in [h*s/storeys for s in range(1,storeys+1)]: box("darkwood",0,-d-0.02,z-0.08,z,w,0.03,T)
    for k in range(4):
        for s in range(storeys):
            box("glow_window_%d"%(k+4*s) if (k+s)%2==0 else "darkwood",-w+(k+0.5)*w/2,-d-0.03,s*h/storeys+0.45,s*h/storeys+0.95,0.22,0.02,T)
    extrude_x("roof",[(-d-0.45,h-0.08),(d+0.45,h-0.08),(d+0.45,h+0.06),(0,h+0.95),(-d-0.45,h+0.06)],-w-0.45,w+0.45,T)
lodge(3.8,7.0,1.8,1.3,2.5)       # on the near bank, downstream of the bridge, as in the classic view
lodge(4.2,-7.0,1.4,1.1,1.4,1)
def fir(cx,cy,cz,s):
    T=dict(cx=cx,cy=cy,cz=cz,s=s)
    prism("darkwood",0,0,-0.3,0.6,0.15,0.13,5,0,T)
    cone("pine",ngon(0.9,0.45,7,rng.uniform(0,1)),(0,0,1.8),T)
    cone("pine",ngon(0.68,1.15,7,rng.uniform(0,1)),(0,0,2.45),T)
    cone("pine",ngon(0.45,1.8,6,rng.uniform(0,1)),(0,0,3.0),T)
def larch(cx,cy,cz,s):
    T=dict(cx=cx,cy=cy,cz=cz,s=s)
    prism("darkwood",0,0,-0.3,0.9,0.13,0.1,5,0,T)
    cone("larch",ngon(0.85,0.7,7,rng.uniform(0,1)),(0,0,2.6),T)
    cone("larch",ngon(0.55,1.9,6,rng.uniform(0,1)),(0,0,3.4),T)
def willow(cx,cy,cz,s):
    T=dict(cx=cx,cy=cy,cz=cz,s=s)
    solid([ngon(0.14,-0.3,5),ngon(0.1,0.9,5,0,0.08,0)],"darkwood",T)
    ico("pine",0,0,1.35,0.95,0.85,0.75,T); ico("larch",0.45,0.25,1.15,0.55,0.5,0.45,T)
placed=[]
def free(x,y,d): return all(math.hypot(x-px,y-py)>=d for px,py in placed)
STAND=to_xy(1.3,-6.4)
LODGES=[(3.8,7.0,3.0),(4.2,-7.0,2.6)]
def ok_bank(x,y):
    if abs(x)>FH-0.9 or abs(y)>FH-0.9: return False
    u,v=to_uv(x,y)
    if abs(v-bed_c(u))<bed_w(u)+0.7: return False
    if abs(u-BU)<2.4 and abs(v)<L+2.4+RL: return False               # the bridge and its ramps
    if any(math.hypot(u-a,v-b)<r for a,b,r in LODGES): return False
    if math.hypot(x-STAND[0],y-STAND[1])<3.0: return False
    if -1.0<u<3.6 and abs(v)<L+3.4: return False                     # in front of the bridge
    return True
# on the lower mountain slopes
tries=0
while len(placed)<16 and tries<4000:
    tries+=1
    x,y=rng.uniform(-FH+1,FH-1),rng.uniform(-FH+1,FH-1); z=mtn_z(x,y)
    if not(0.25<z<2.6) or not free(x,y,1.2): continue
    u,v=to_uv(x,y)
    if abs(v-bed_c(u))<bed_w(u)+0.5: continue
    placed.append((x,y))
    (fir if rng.random()<0.6 else larch)(x,y,z-0.15,rng.uniform(0.8,1.0))
for k in range(400):
    if len(placed)>=36: break
    x,y=rng.uniform(-FH+1,FH-1),rng.uniform(-FH+1,FH-1)
    if mtn_z(x,y)>0.05 or not ok_bank(x,y) or not free(x,y,1.5): continue
    placed.append((x,y)); r=rng.random()
    u,v=to_uv(x,y); near=abs(v-bed_c(u))<bed_w(u)+2.2
    if near and r<0.5: willow(x,y,0.0,rng.uniform(0.85,1.05))
    elif r<0.55: larch(x,y,0.0,rng.uniform(0.9,1.1))
    else: fir(x,y,0.0,rng.uniform(0.85,1.05))

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/kappa-bashi.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=FH; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y): return bridge_floor(x,y)   # the bridge deck and its ramps; the mountains are solid, and the game draws the ground
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
        if in_water(x,y,-0.2) and bridge_floor(x,y)==0.0 and all(bridge_floor(x+dx,y+dy)==0.0 for dx,dy in ((0.5,0),(-0.5,0),(0,0.5),(0,-0.5))):
            EXTRA_SOLIDS.append((x,y,0.43))
solids+=[[round(x,2),round(-y,2),r] for x,y,r in EXTRA_SOLIDS]
INTERACT=(BX,BY)     # the middle of the bridge
# STAND (set above, kept clear of trees): the left bank, downstream of the bridge
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]],"terrainSurface":True}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/kappa-bashi.json"
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
    objname=key if key.startswith("glow_") else "kappa_"+key
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
