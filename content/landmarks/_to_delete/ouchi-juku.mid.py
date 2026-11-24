import random
rng=random.Random(62)
EXTRA_SOLIDS=[]; NOSOLID={"fir"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, a post town street with its houses
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0

# ---- the ground: the street runs level toward the back, where a small hill rises with the shrine on top
HC=(0.0,8.25); HR=2.85; HH=1.55
def G(x,y):
    d=math.hypot(x-HC[0],(y-HC[1])*1.05)/HR
    return HH*max(0.0,1-d*d)**1.2
box("street",0,-2.2,-0.05,0.02,1.85,8.1)                 # the trodden street

# ---- the houses: long hipped roofs of deep thatch, laid parallel to the street, their eaves heavy with snow;
# white plaster and dark timber below, lit paper screens at the shop fronts
def house(cx,cy,sd,hy,hx=1.15,h=1.35):
    fx=cx-sd*hx                                            # the street front
    box("wood",cx,cy,-0.1,0.5,hx,hy); box("plaster",cx,cy,0.5,h,hx-0.02,hy-0.02)
    for k in range(3):
        y=cy-hy+0.45+k*(2*hy-0.9)/2
        box("wood",cx,y,0.5,h,hx+0.01,0.05)
    box("glow_screens",fx-sd*0.02,cy-hy*0.35,0.12,0.95,0.02,hy*0.32)
    box("wood",fx-sd*0.02,cy+hy*0.45,0.0,1.0,0.02,0.32)
    box("glow_screens",fx-sd*0.02,cy+hy*0.05,0.82,1.18,0.02,0.18)
    flared_roof([(hx+0.36,hy+0.26,h-0.05,0.34),(hx+0.36,hy+0.26,h+0.18,0.34),(0.55,hy-0.3,h+1.15,0.08),(0.08,hy-0.6,h+1.75,0.0)],"thatch",cx,cy)
    flared_roof([(hx+0.3,hy+0.2,h+0.3,0.08),(hx+0.3,hy+0.2,h+0.37,0.08),(0.52,hy-0.3,h+1.3,0.04),(0.06,hy-0.6,h+1.88,0.0)],"snow",cx,cy)
    box("wood",cx,cy,h+1.8,h+1.94,0.12,hy-0.55)           # the ridge cap
YS=[-8.2,-5.25,-2.3,0.65,3.6]
for sd in (-1,1):
    for k,y in enumerate(YS):
        hy=0.92+0.1*((k*3+(sd>0))%3)
        house(sd*(3.35+0.08*((k+sd)%2)),y,sd,hy)
# the open gutters before each row, with little snow banks and snow lanterns along the street
for sd in (-1,1):
    box("stone",sd*2.05,-2.2,-0.08,0.03,0.12,8.1)
    for k in range(12):
        y=-9.6+1.4*k; x=sd*1.8
        prism("snow",x,y,0.0,0.24,0.18,0.13,6); box("glow_lanterns",x-sd*0.0,y,0.24,0.42,0.07,0.07)
        frus("snow",x,y,0.42,0.52,0.13,0.13,0.03,0.03)

# ---- the hill at the head of the street: stone steps up to a small thatched shrine among cedars
for k in range(9):
    y=5.25+0.28*k; z=G(0.0,y+0.14)
    box("stone",0,y+0.14,z-0.25,z+0.04,0.55,0.15)
tz=G(0,5.2)
for sx in (-0.75,0.75): prism("wood",sx,5.1,tz-0.1,tz+1.55,0.06,0.06,6)
box("wood",0,5.1,tz+1.35,tz+1.45,0.95,0.07); box("wood",0,5.1,tz+1.55,tz+1.65,1.1,0.08)
sz=G(0,8.3)
box("wood",0,8.35,sz-0.2,sz+0.75,0.55,0.45)
box("glow_screens",0,7.89,sz+0.1,sz+0.6,0.3,0.02)
flared_roof([(0.85,0.75,sz+0.7,0.2),(0.85,0.75,sz+0.85,0.2),(0.06,0.4,sz+1.45,0.0)],"thatch",0,8.35)
flared_roof([(0.8,0.7,sz+0.86,0.05),(0.8,0.7,sz+0.9,0.05),(0.04,0.37,sz+1.5,0.0)],"snow",0,8.35)

# ---- snowed cedars behind the houses and on the hill
def fir(x,y,s):
    z=G(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.12,-0.3,5),ngon(0.08,0.8,5)],"wood",T)
    for zc,r,hh in ((0.6,0.7,1.1),(1.3,0.45,1.0)):
        cone("fir",ngon(r,zc,6,rng.uniform(0,1)),(0,0,zc+hh),T)
        cone("snow",ngon(r*0.55,zc+hh*0.45,6,0.3),(0,0,zc+hh+0.06),T)
tp=[]
for x,y,s in [(-1.6,7.4,0.9),(1.7,7.6,0.95),(-1.2,9.4,1.0),(1.4,9.6,0.9),(-2.6,8.8,0.85),(2.8,8.6,0.85)]:
    fir(x,y,s); tp.append((x,y))
for k in range(80):
    x,y=rng.uniform(-9.6,9.6),rng.uniform(-9.6,9.6)
    if abs(x)<5.6 and y<6.0: continue
    if abs(x)<3.6 and y>=6.0: continue
    if any(math.hypot(x-px,y-py)<1.3 for px,py in tp) or len(tp)>=28: continue
    tp.append((x,y)); fir(x,y,rng.uniform(0.8,1.1))

def ground_at(x,y): return G(x,y)
def water_disc(x,y): return False
INTERACT=(0.0,-5.0)   # in the street among the thatched houses
STAND=(0.6,-6.0)
