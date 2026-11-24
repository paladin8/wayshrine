import random
rng=random.Random(60)
EXTRA_SOLIDS=[]; NOSOLID={"fir","larch"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=9.6   # footprint half-width (the sidecar's half): a single feature, the pond and its drowned larches
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0

# ---- the pond: a long irregular basin, its milky turquoise water standing among dead larch trunks; a skin of ice
# along the margins. The banks fall gently to the water
PC=(0.0,0.9); PA,PB=5.8,3.1
def wob(t): return 1+0.08*math.sin(3*t+1.0)+0.05*math.sin(5*t+2.2)+0.03*math.sin(7*t+0.4)
def pf(x,y):
    dx,dy=(x-PC[0])/PA,(y-PC[1])/PB; t=math.atan2(dy,dx); return math.hypot(dx,dy)/wob(t)
PD=-0.65; WZ=-0.3
def G(x,y): return PD*(1-smooth(0.82,1.06,pf(x,y)))
def ring(f):
    P=[]
    for k in range(36):
        t=2*math.pi*k/36; w=wob(t); P.append((PC[0]+PA*f*w*math.cos(t),PC[1]+PB*f*w*math.sin(t)))
    return P
W=ring(1.0)
emit([(*p,WZ) for p in W]+[(PC[0],PC[1],WZ)],[[k,(k+1)%36,36] for k in range(36)],["water"]*36)
I0,I1=ring(0.86),ring(0.97)
for k in range(36):
    a,b,c,d=I0[k],I0[(k+1)%36],I1[(k+1)%36],I1[k]
    if math.sin(2.0*k)+0.4*math.sin(5.1*k)>-0.2:       # the ice is patchy
        emit([(*a,WZ+0.015),(*b,WZ+0.015),(*c,WZ+0.015),(*d,WZ+0.015)],[[0,1,2,3]],["ice"])

# the drowned larches: thin pale trunks, many leaning, some with broken stubs of branches
def trunk(x,y,h,r,lean,ph):
    z=G(x,y)-0.1; tx,ty=x+lean*math.cos(ph),y+lean*math.sin(ph)
    solid([ngon(r,z,5,ph,x,y),ngon(r*0.45,z+h,5,ph,tx,ty)],"deadwood")
    if rng.random()<0.6:
        k=rng.uniform(0.45,0.8); bx,by,bz=x+(tx-x)*k,y+(ty-y)*k,z+h*k; a=rng.uniform(0,6.28); L=rng.uniform(0.2,0.4)
        solid([ngon(r*0.4,bz,4,a,bx,by),ngon(r*0.18,bz+L*0.6,4,a,bx+L*math.cos(a),by+L*math.sin(a))],"deadwood")
n=0; pts=[]
while n<54:
    x,y=rng.uniform(-6.2,6.2),rng.uniform(-2.4,4.2)
    f=pf(x,y)
    if f>0.93 or any(math.hypot(x-px,y-py)<0.55 for px,py in pts): continue
    pts.append((x,y)); n+=1
    trunk(x,y,rng.uniform(1.1,2.7)*(0.75 if f>0.75 else 1.0),rng.uniform(0.05,0.08),rng.uniform(0.0,0.35),rng.uniform(0,6.28))
for k in range(5):                                     # fallen trunks lying in the shallows
    t=rng.uniform(0,6.28); x,y=PC[0]+PA*0.7*math.cos(t),PC[1]+PB*0.7*math.sin(t); a=rng.uniform(0,6.28); L=rng.uniform(0.8,1.4)
    p0=(x-L*math.cos(a)/2,y-L*math.sin(a)/2,WZ-0.03); p1=(x+L*math.cos(a)/2,y+L*math.sin(a)/2,WZ+0.02)
    nx,ny=-math.sin(a)*0.06,math.cos(a)*0.06
    solid([[(p0[0]+nx,p0[1]+ny,p0[2]-0.05),(p0[0]-nx,p0[1]-ny,p0[2]-0.05),(p0[0]-nx,p0[1]-ny,p0[2]+0.05),(p0[0]+nx,p0[1]+ny,p0[2]+0.05)],
           [(p1[0]+nx,p1[1]+ny,p1[2]-0.05),(p1[0]-nx,p1[1]-ny,p1[2]-0.05),(p1[0]-nx,p1[1]-ny,p1[2]+0.05),(p1[0]+nx,p1[1]+ny,p1[2]+0.05)]],"deadwood")

# ---- the viewing walk along the near shore: a low timber deck, railed toward the water, lamps for the winter
# night illumination
DX0,DX1,DY0,DY1,DZ=-3.4,3.4,-3.95,-2.75,0.22
def on_deck(x,y): return DX0<x<DX1 and DY0<y<DY1
box("wood",(DX0+DX1)/2,(DY0+DY1)/2,DZ-0.1,DZ,(DX1-DX0)/2,(DY1-DY0)/2)
for x in [DX0+0.2+k*(DX1-DX0-0.4)/6 for k in range(7)]:
    for y in (DY0+0.1,DY1-0.1): box("wood",x,y,G(x,y)-0.2,DZ-0.1,0.05,0.05)
    box("wood",x,DY1-0.04,DZ,DZ+0.55,0.04,0.04)
box("wood",(DX0+DX1)/2,DY1-0.04,DZ+0.5,DZ+0.58,(DX1-DX0)/2,0.04)
for x in (DX0,DX1):
    box("wood",x,(DY0+DY1)/2,DZ,DZ+0.55,0.04,0.04); box("wood",x,(DY0+DY1)/2+0.25,DZ+0.5,DZ+0.58,0.04,(DY1-DY0)/2-0.25)
for k,x in enumerate((-2.8,2.8)):
    y=DY0+0.12
    prism("iron",x,y,DZ,DZ+1.3,0.04,0.035,6); box("glow_lamps",x,y,DZ+1.3,DZ+1.52,0.08,0.08)
    frus("iron",x,y,DZ+1.52,DZ+1.62,0.11,0.11,0.02,0.02)

# ---- the forest: Todo firs under snow and bare winter larches, thick behind the pond, thinning toward the front
def fir(x,y,s):
    z=G(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.12,-0.3,5),ngon(0.08,0.8,5)],"wood",T)
    for zc,r,hh in ((0.6,0.7,1.1),(1.3,0.45,1.0)):
        cone("fir",ngon(r,zc,6,rng.uniform(0,1)),(0,0,zc+hh),T)
        cone("snow",ngon(r*0.55,zc+hh*0.45,6,0.3),(0,0,zc+hh+0.06),T)
def larch(x,y,s):
    z=G(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.09,-0.3,5),ngon(0.05,1.0,5)],"wood",T)
    cone("larch",ngon(0.5,0.7,6,rng.uniform(0,1)),(0,0,2.9),T)
tp=[]
def plant(x,y,s,kind):
    if abs(x)>FH-1.0 or abs(y)>FH-1.0 or pf(x,y)<1.18 or on_deck(x,y): return
    if any(math.hypot(x-px,y-py)<0.95*s for px,py in tp): return
    tp.append((x,y)); (fir if kind else larch)(x,y,s)
for k in range(260):
    x,y=rng.uniform(-8.6,8.6),rng.uniform(-8.6,8.6)
    dens=smooth(-3.5,4.5,y)*0.85+0.15*smooth(5.5,7.5,abs(x))
    if rng.random()>dens or len(tp)>=62: continue
    plant(x,y,rng.uniform(0.8,1.1),rng.random()<0.45)
for x,y,s in [(-7.6,-7.4,0.9),(7.4,-7.6,0.85),(-6.4,-4.6,0.8),(6.6,-5.0,0.8)]: plant(x,y,s,1)

def ground_at(x,y):
    if on_deck(x,y): return DZ
    return G(x,y)
def terrain_at(x,y): return G(x,y)
def water_disc(x,y): return pf(x,y)<0.95
INTERACT=(0.0,-3.15)   # on the viewing deck at the water's edge
STAND=(0.9,-3.6)
