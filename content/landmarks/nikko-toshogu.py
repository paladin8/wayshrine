# Nikko Toshogu (the Yomeimon on its terrace, corridors, pagoda, lantern court and cedars) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python nikko-toshogu.py
# Rebuilds content/landmarks/nikko-toshogu.blend and public/models/landmarks/nikko-toshogu.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/nikko-toshogu.glb"
BLEND=ROOT+"/content/landmarks/nikko-toshogu.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"white":"f4f1ea","gold":"d9b04a","vermilion":"d96b59","roof":"2f3133","teal":"3f8f7f","stone":"a39e98","gravel":"c9c2b4","bronze":"6f6650","cedar":"2f5a46","bark":"4e3a30","glow_cream":"e8dcb0"}
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
rng=random.Random(15)
H=lambda x,y: 0.0   # the game's terrain draws the mountain ground (terrainSurface)
EXTRA_SOLIDS=[]
FH=11.2   # footprint half-width (the sidecar's half): the middle size, for compounds and precincts

def irimoya(cx,cy,spec,gx,gy,zg0,zg1):
    """Hip-and-gable roof: a flared hip roof plus the dark gable boards under the ridge ends (ridge along x)."""
    flared_roof(spec,"roof",cx,cy)
    for sx in (-1,1):
        extrude_x("roof",[(cy-gy,zg0),(cy+gy,zg0),(cy,zg1)],cx+sx*gx-0.03,cx+sx*gx+0.03)
def posts(cx,cy,hx,hy,z0,z1,nx,ny,r=0.06):
    # dark posts round a white-walled storey, on the faces the game camera sees (front -y, right +x) and the corners
    for k in range(nx+1):
        x=cx-hx+2*hx*k/nx; box("roof",x,cy-hy-0.02,z0,z1,r,r)
    for k in range(1,ny+1):
        y=cy-hy+2*hy*k/ny; box("roof",cx+hx+0.02,y,z0,z1,r,r)
    box("roof",cx-hx,cy+hy,z0,z1,r,r)
def storey(cx,cy,hx,hy,z0,z1,nx,ny):
    box("white",cx,cy,z0,z1,hx,hy)
    hb=min(0.22,(z1-z0)*0.28)                                    # white plaster just under the head beam
    box("white",cx,cy,z1-0.12-hb,z1-0.12,hx+0.01,hy+0.01)
    posts(cx,cy,hx,hy,z0,z1,nx,ny)
    box("roof",cx,cy,z1-0.12,z1,hx+0.04,hy+0.04)            # head beam and brackets
    box("roof",cx,cy,z0,z0+0.08,hx+0.04,hy+0.04)            # sill
def podium(cx,cy,hx,hy,z1,step=0.12):
    box("stone",cx,cy,-0.05,z1-step,hx+step,hy+step); box("stone",cx,cy,z1-step,z1,hx,hy)


def brackets(cx,cy,hx,hy,z0,z1,layers=3):
    # the dense, painted bracket sets under the eaves: alternating gold and green bands, each stepping out
    dz=(z1-z0)/layers
    for k in range(layers):
        o=0.15*k                                            # stepping well out, so the tiers read from the game camera
        box("gold" if k%2==0 else "teal",cx,cy,z0+k*dz,z0+(k+1)*dz,hx+o,hy+o)
        n=int(2*(hx+o)/0.64)
        for i in range(n+1):                                # the carved bracket ends, dark against the paint
            box("roof",cx-(hx+o)+2*(hx+o)*i/max(1,n),cy-(hy+o)-0.05,z0+k*dz+dz*0.25,z0+k*dz+dz*0.85,0.06,0.05)

# ---- the precinct floor: gravel courts and the paved approach
box("gravel",0,-5.0,-0.02,0.03,8.6,4.3)
box("stone",0,-9.6,-0.02,0.04,1.3,1.4)

# ---- the stone terrace, its stair, and on it the Yomeimon with corridors running out to either side
TZ=1.3
box("stone",0,3.95,-0.05,TZ,9.2,4.45,mt="gravel")
for k in range(6):
    box("stone",0,-0.5-(6-k)*0.16,-0.05,TZ*(k+1)/6,1.5,(6-k)*0.16)   # the stair up the terrace front
YX,YY=0.0,1.4; YZ=TZ; S=1.35     # the Yomeimon, the hero of the precinct
def ys(*v): return [a*S for a in v]
podium(YX,YY,2.0*S,1.15*S,YZ+0.25)
z0=YZ+0.25
for i in range(4):
    for j in range(3):
        box("white",YX+(-1.5+i*1.0)*S,YY+(-0.75+j*0.75)*S,z0,z0+1.75*S,0.1*S,0.1*S)
box("white",YX-1.6*S,YY,z0,z0+1.75*S,0.08*S,0.75*S); box("white",YX+1.6*S,YY,z0,z0+1.75*S,0.08*S,0.75*S)   # side walls
for x in (-1.6,1.6): box("teal",YX+x*S,YY-0.76*S,z0+0.4*S,z0+1.4*S,0.06*S,0.02)                         # painted panels at the ends
# the carved friezes above the passage: broad bands standing proud of the columns, teal and vermilion relief with
# dark-and-gold medallions big enough to read from the game camera
FY=YY-0.75*S-0.14
box("teal",YX,FY,z0+1.18*S,z0+1.5*S,1.65*S,0.1)
box("vermilion",YX,FY-0.03,z0+1.5*S,z0+1.75*S,1.7*S,0.12)
for k in range(9): box("gold",YX+(-1.6+k*0.4)*S,FY-0.13,z0+1.54*S,z0+1.71*S,0.07*S,0.03)
def medal(x,z,r,y):
    oc=[(r*math.cos(math.pi/8+k*math.pi/4),r*math.sin(math.pi/8+k*math.pi/4)) for k in range(8)]
    extrude_y("gold",[(x+a,z+b) for a,b in oc],y,y-0.08)
    extrude_y("roof",[(x+0.62*a,z+0.62*b) for a,b in oc],y-0.08,y-0.14)
    extrude_y("gold",[(x+0.25*a,z+0.25*b) for a,b in oc],y-0.14,y-0.17)
for x in (-1.05,1.05): medal(YX+x*S,z0+1.34*S,0.2*S,FY-0.1)
# over the main passage, two carved white dragons' heads thrust out of the frieze toward the approach, jaws open,
# gilded horns swept back: deep enough to read from the foot of the stair under the eave
def dragon(xc):
    yb=FY-0.1; zc=z0+1.34*S
    def P(prof): return [(yb-u*S,zc+v*S) for u,v in prof]
    w=0.085*S
    extrude_x("white",P([(0.0,-0.13),(0.0,0.15),(0.18,0.17),(0.31,0.11),(0.31,-0.05),(0.13,-0.13)]),xc-w,xc+w)   # head
    extrude_x("white",P([(0.29,0.11),(0.54,0.075),(0.57,0.02),(0.3,-0.005)]),xc-w*0.7,xc+w*0.7)                  # upper jaw
    extrude_x("white",P([(0.28,-0.06),(0.49,-0.085),(0.48,-0.13),(0.26,-0.13)]),xc-w*0.62,xc+w*0.62)            # lower jaw
    extrude_x("vermilion",P([(0.3,-0.01),(0.5,0.0),(0.47,-0.07),(0.3,-0.055)]),xc-w*0.45,xc+w*0.45)              # the open mouth
    for sx in (-1,1):
        extrude_x("gold",P([(0.07,0.14),(0.15,0.16),(-0.05,0.34),(-0.11,0.31)]),xc+sx*w*0.55-0.03,xc+sx*w*0.55+0.03)   # horns
        extrude_x("roof",P([(0.22,0.075),(0.27,0.075),(0.27,0.115),(0.22,0.115)]),xc+sx*w-0.012,xc+sx*w+0.012)      # eyes
        extrude_x("gold",P([(0.5,0.07),(0.54,0.08),(0.44,0.25),(0.4,0.24)]),xc+sx*w*0.75-0.015,xc+sx*w*0.75+0.015)   # whiskers
    extrude_x("gold",P([(-0.02,-0.16),(0.1,-0.16),(0.14,-0.24),(0.04,-0.3),(-0.02,-0.24)]),xc-w*0.8,xc+w*0.8)     # the beard
    extrude_x("gold",P([(0.02,0.14),(0.22,0.165),(0.16,0.25),(0.06,0.27),(0.0,0.2)]),xc-w*0.45,xc+w*0.45)        # the crest
for x in (-0.33,0.33): dragon(YX+x*S)
brackets(YX,YY,1.75*S,0.95*S,z0+1.75*S,z0+2.35*S,4)
flared_roof([(2.55*S,1.75*S,z0+2.35*S,0.3*S),(2.55*S,1.75*S,z0+2.47*S,0.3*S),(1.7*S,0.95*S,z0+2.7*S,0.08*S),(1.4*S,0.75*S,z0+2.82*S,0.0)],"roof",YX,YY)
box("gold",YX,YY-1.75*S-0.02,z0+2.35*S,z0+2.41*S,2.2*S,0.03)                                          # gilded eave line
z1=z0+2.78*S
box("gold",YX,YY,z1,z1+0.08*S,1.65*S,0.95*S)                                                          # balcony
for (x0,y0,x1,y1) in [(-1.6,-0.92,1.6,-0.92),(1.6,-0.92,1.6,0.92)]:
    L=max(abs(x1-x0),abs(y1-y0))/2*S
    box("white",YX+(x0+x1)/2*S,YY+(y0+y1)/2*S,z1+0.38*S,z1+0.44*S,L if x0!=x1 else 0.03,L if y0!=y1 else 0.03)
    for k in range(9): t=k/8; box("gold",YX+(x0+(x1-x0)*t)*S,YY+(y0+(y1-y0)*t)*S,z1+0.08*S,z1+0.4*S,0.03,0.03)
box("white",YX,YY,z1+0.08*S,z1+1.2*S,1.3*S,0.68*S)
for x in (-0.9,-0.3,0.3,0.9): box("teal",YX+x*S,YY-0.69*S,z1+0.35*S,z1+0.95*S,0.2*S,0.02)            # painted panels
box("gold",YX,YY-0.68*S-0.08,z1+0.95*S,z1+1.2*S,1.35*S,0.08)                                    # the upper frieze
for x in (-0.6,0.6): medal(YX+x*S,z1+1.075*S,0.14*S,YY-0.68*S-0.16)
brackets(YX,YY,1.42*S,0.8*S,z1+1.2*S,z1+1.8*S,4)
irimoya(YX,YY,[(2.35*S,1.65*S,z1+1.8*S,0.38*S),(2.35*S,1.65*S,z1+1.92*S,0.38*S),(1.45*S,0.95*S,z1+2.35*S,0.12*S),(1.15*S,0.18*S,z1+3.05*S,0.0)],1.12*S,0.85*S,z1+2.37*S,z1+3.0*S)
box("gold",YX,YY-1.65*S-0.02,z1+1.8*S,z1+1.86*S,2.0*S,0.03)
# a curved gable (kara-hafu) on the front of the top roof, gilded
T=dict(cx=YX,cy=YY-1.2*S,cz=z1+2.05*S,s=S)
lo=[(-0.8,0),(-0.48,0.14),(-0.2,0.42),(0,0.48),(0.2,0.42),(0.48,0.14),(0.8,0)]
extrude_y("gold",lo,0.3,-0.32,T)
hi=[(0.94,-0.06),(0.5,0.26),(0.2,0.56),(0,0.62),(-0.2,0.56),(-0.5,0.26),(-0.94,-0.06)]
extrude_y("roof",lo+hi,0.32,-0.42,T)
for sx in (-1,1):                                                                           # corridors (kairo)
    cx=YX+sx*5.9; L=2.7
    box("vermilion",cx,YY,TZ,TZ+1.25,L,0.42)
    for k in range(8): box("gold",cx-L+0.45+k*(2*L-0.9)/7,YY-0.43,TZ+0.45,TZ+0.95,0.32,0.02)  # carved panels
    box("gold",cx,YY,TZ+1.2,TZ+1.32,L+0.04,0.46)
    extrude_x("roof",[(YY-0.75,TZ+1.32),(YY+0.75,TZ+1.32),(YY+0.75,TZ+1.42),(YY,TZ+1.85),(YY-0.75,TZ+1.42)],cx-L-0.1,cx+L+0.1)

# ---- behind the gate: the white Karamon and the black-and-gold worship hall
box("white",0,4.6,TZ,TZ+1.3,0.9,0.45)
brackets(0,4.6,0.95,0.5,TZ+1.3,TZ+1.55,2)
flared_roof([(1.35,0.85,TZ+1.55,0.22),(1.35,0.85,TZ+1.65,0.22),(0.8,0.45,TZ+1.9,0.05),(0.6,0.12,TZ+2.2,0.0)],"roof",0,4.6)
box("roof",0,6.9,TZ,TZ+1.6,2.7,1.5)
box("gold",0,5.38,TZ+0.45,TZ+1.35,2.4,0.02)
brackets(0,6.9,2.75,1.55,TZ+1.6,TZ+1.95,2)
irimoya(0,6.9,[(3.45,2.2,TZ+1.95,0.3),(3.45,2.2,TZ+2.05,0.3),(2.7,1.35,TZ+2.5,0.09),(2.35,0.18,TZ+3.2,0.0)],2.3,1.2,TZ+2.52,TZ+3.15)

# ---- the lantern court: drum and bell towers, rows of bronze lanterns, the sacred stable; a stone torii outside
def tower_bldg(cx,cy):
    box("stone",cx,cy,-0.05,0.35,1.25,1.25)
    box("vermilion",cx,cy,0.35,1.55,0.95,0.95)
    box("gold",cx,cy-0.96,0.7,1.2,0.6,0.02)
    brackets(cx,cy,1.0,1.0,1.55,1.85,2)
    flared_roof([(1.7,1.7,1.85,0.32),(1.7,1.7,1.97,0.32),(0.95,0.95,2.3,0.08),(0.35,0.35,2.75,0.0)],"roof",cx,cy)
tower_bldg(-5.6,-2.3); tower_bldg(5.6,-2.3)
def bronze_lantern(cx,cy,idx=None):
    prism("stone",cx,cy,0.0,0.15,0.28,0.28,6,math.pi/6)
    prism("bronze",cx,cy,0.15,0.85,0.06,0.06,6,0)
    prism("bronze",cx,cy,0.85,0.94,0.22,0.22,6,math.pi/6)
    prism("glow_lantern_%d"%idx if idx else "bronze",cx,cy,0.94,1.22,0.16,0.16,6,math.pi/6)
    cone("bronze",ngon(0.3,1.22,6,math.pi/6,cx,cy),(cx,cy,1.45))
n=0
for sx in (-1,1):
    for y in (-7.0,-5.7,-4.4):
        for x in (2.6,3.8):
            n+=1; bronze_lantern(sx*x,y,n if y==-7.0 and x==2.6 else None)
# the sacred stable (Shinkyusha): plain wood under a bark roof
box("stone",7.8,-7.6,-0.05,0.2,1.9,1.0)
box("bark",7.8,-7.6,0.2,1.3,1.7,0.8)
for x in (-1.0,0.0,1.0): box("gold",7.8+x,-8.41,0.85,1.15,0.32,0.02)                       # the carved panels (the three monkeys)
flared_roof([(2.15,1.25,1.3,0.12),(2.15,1.25,1.38,0.12),(1.4,0.55,1.7,0.03),(1.2,0.1,1.95,0.0)],"roof",7.8,-7.6)
# the stone torii (Ishidorii)
T=dict(cx=0.0,cy=-9.2,s=1.2)
for sx in (-1,1): prism("stone",sx*1.1,0,-0.1,2.6,0.15,0.13,8,0,T)
box("stone",0,0,2.1,2.26,1.35,0.1,T)
box("stone",0,0,2.55,2.72,1.5,0.14,T)
extrude_y("stone",[(-1.62,2.72),(1.62,2.72),(1.8,2.94),(0.8,2.86),(-0.8,2.86),(-1.8,2.94)],-0.15,0.15,T)

# ---- the five-storey pagoda by the entrance: vermilion, its upper storeys banded in colour
PX,PY=-6.8,-7.4
box("stone",PX,PY,-0.05,0.4,1.35,1.35)
z=0.4
for i in range(5):
    b=0.92-0.05*i; r=1.6-0.06*i
    box("vermilion",PX,PY,z,z+0.95,b,b)
    brackets(PX,PY,b,b,z+0.95,z+1.15,2)
    flared_roof([(r,r,z+1.15,0.24),(r,r,z+1.25,0.24),(b*0.8+0.15,b*0.8+0.15,z+1.45,0.06),(b-0.05,b-0.05,z+1.56,0.0)],"roof",PX,PY)
    z+=1.4
prism("bronze",PX,PY,z+0.1,z+2.2,0.06,0.05,6,0)
for k in range(9): prism("bronze",PX,PY,z+0.4+k*0.17,z+0.45+k*0.17,0.2-0.008*k,0.2-0.008*k,8,0)

# ---- giant cedars (sugi) round the precinct
def cedar(cx,cy,s,ph=0.0):
    T=dict(cx=cx,cy=cy,s=s)
    prism("bark",0,0,-0.3,2.6,0.32,0.24,6,ph,T)
    for (r,zb,zt,p) in [(1.15,1.8,3.8,ph),(0.95,3.0,4.9,ph+0.4),(0.75,4.1,5.9,ph+0.8),(0.5,5.1,6.9,ph+0.2)]:
        cone("cedar",ngon(r,zb,7,p),(0,0,zt),T)
for (x,y,s,p) in [(-10.0,-1.8,1.0,0.2),(-10.0,4.0,1.05,0.6),(-9.5,9.3,1.0,0.1),(-5.0,10.0,1.05,0.4),(0.8,10.0,1.0,0.8),(5.6,10.0,1.05,0.3),
                  (9.6,9.0,1.0,0.5),(10.0,3.4,1.0,0.7),(10.0,-2.2,0.95,0.2),(-9.8,-9.6,0.9,0.5),(-3.5,-10.1,0.85,0.6),(3.6,-10.1,0.85,0.3),
                  (-9.0,-4.8,0.85,0.9)]: cedar(x,y,s,p)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/nikko-toshogu.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=FH; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y): return 0.0     # the terrace and the halls are solid, not walkable; the game draws the ground
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
INTERACT=(0.0,-3.4)   # the lantern court below the Yomeimon
STAND=(0.0,-10.4)     # the approach, outside the stone torii
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]],"terrainSurface":True}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/nikko-toshogu.json"
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
    objname=key if key.startswith("glow_") else "nikko_"+key
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
