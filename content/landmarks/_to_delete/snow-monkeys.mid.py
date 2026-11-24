import random
rng=random.Random(66)
EXTRA_SOLIDS=[]; NOSOLID={"fir","steam"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=9.6   # footprint half-width (the sidecar's half): a single feature, the monkeys' hot spring in its valley
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0

# ---- the valley of Jigokudani: snowy slopes rising behind and to the left, the floor where the spring pool lies
def slope(x,y):
    h=2.3*smooth(2.6,6.6,y+0.6*math.sin(0.5*x))+1.2*smooth(-4.0,-7.6,x)*smooth(-6.0,2.0,y)
    return h*smooth(9.3,7.2,y)*smooth(9.3,7.6,abs(x))
PC=(0.3,0.5); PR=2.6
def pwob(t): return 1+0.1*math.sin(3*t+0.5)+0.06*math.sin(5*t+1.7)
def pd(x,y):
    dx,dy=x-PC[0],y-PC[1]; return math.hypot(dx,dy)/(PR*pwob(math.atan2(dy,dx)))
PZ=-0.55; WZ=-0.2
def G(x,y):
    if pd(x,y)<1.0: return PZ
    return slope(x,y)
# the pool: steaming water inside a rim of set stones
n=28; ring=[]
for k in range(n):
    t=2*math.pi*k/n; r=PR*pwob(t)*1.02; ring.append((PC[0]+r*math.cos(t),PC[1]+r*math.sin(t)))
emit([(*p,WZ) for p in ring]+[(PC[0],PC[1],WZ)],[[k,(k+1)%n,n] for k in range(n)],["water"]*n)
for k in range(n):
    t=2*math.pi*(k+0.5)/n; r=PR*pwob(t)*1.08; x,y=PC[0]+r*math.cos(t),PC[1]+r*math.sin(t)
    ico("stone",x,y,-0.15,rng.uniform(0.28,0.38),rng.uniform(0.24,0.32),rng.uniform(0.22,0.3))
for k in range(9):                                     # snow lying on the rim stones
    t=2*math.pi*k/9+0.2; r=PR*pwob(t)*1.1; x,y=PC[0]+r*math.cos(t),PC[1]+r*math.sin(t)
    ico("snow",x,y,0.1,0.22,0.2,0.08)
# steam drifting off the water
for k,(dx,dy,z,s) in enumerate([(-1.2,0.9,0.5,0.32),(-1.0,1.1,1.05,0.26),(-0.8,1.35,1.5,0.2),(1.5,1.3,0.6,0.3),(1.7,1.55,1.15,0.22)]):
    ico("steam",PC[0]+dx,PC[1]+dy,z,s,s,s*1.15)

# ---- the macaques: some soaking to the chin, snow on their heads, others hunched on the rim stones
def monkey(x,y,z,face,s=1.0,bathing=False,snowcap=False):
    T=dict(cx=x,cy=y,cz=z,s=s,rot=face)
    if bathing:
        ico("fur",0,0,-0.02,0.2,0.18,0.12,T); ico("fur",0,-0.02,0.15,0.13,0.12,0.12,T)
        box("face",0,-0.13,0.1,0.2,0.065,0.02,T)
        if snowcap: ico("snow",0,0.0,0.26,0.08,0.08,0.035,T)
    else:
        ico("fur",0,0.02,0.24,0.2,0.18,0.25,T); ico("fur",0,-0.06,0.52,0.13,0.12,0.12,T)
        box("face",0,-0.17,0.47,0.57,0.065,0.02,T)
        for sx in (-0.14,0.14): ico("fur",sx,-0.1,0.08,0.07,0.1,0.07,T)
        if snowcap: ico("snow",0,-0.04,0.63,0.08,0.08,0.035,T)
# rot: local -Y is the face; rot turns it. Most look toward the front (the camera side)
MS=1.7
monkey(-0.6,0.3,WZ,0.2,MS,True,True)
monkey(0.7,-0.5,WZ,-0.3,MS,True)
monkey(1.3,1.0,WZ,0.6,MS*0.95,True,True)
monkey(-0.3,1.5,WZ,-0.1,MS*1.05,True)
monkey(1.15,0.15,WZ,0.1,MS*0.65,True)
monkey(-1.4,-0.7,WZ,0.5,MS,True,True)
for k,(t,face,s,cap) in enumerate([(4.4,0.1,1.0,True),(5.2,-0.5,0.95,False),(2.6,1.9,1.0,True),(3.4,2.6,0.75,False)]):
    r=PR*pwob(t)*1.08; x,y=PC[0]+r*math.cos(t),PC[1]+r*math.sin(t)
    monkey(x,y,0.1,face,s*MS,False,cap)

# ---- the wooden walk in from the front, railed, to the pool's edge
def on_walk(x,y): return abs(x-0.3)<0.85 and -8.4<y<-2.5
box("wood",0.3,-5.45,0.1,0.2,0.85,2.95)
for y in [-8.2+0.95*k for k in range(7)]:
    for sx in (-0.8,0.8): box("wood",0.3+sx,y,-0.1,0.68,0.04,0.04)
for sx in (-0.8,0.8): box("wood",0.3+sx,-5.45,0.6,0.68,0.035,2.9)

# ---- the Korakukan inn across the valley floor: two storeys of dark timber under snow, its windows lit
LX,LY=-4.8,-4.6
box("stone",LX,LY,-0.1,0.15,1.75,1.45)
box("wood",LX,LY,0.15,1.2,1.6,1.3); box("wood",LX,LY,1.2,2.1,1.5,1.2)
for k in range(4):
    box("glow_windows",LX-1.15+0.77*k,LY-1.31,0.45,0.95,0.22,0.02)
    box("glow_windows",LX-1.1+0.73*k,LY-1.21,1.4,1.85,0.2,0.02)
for k in range(3): box("glow_windows",LX-1.61,LY-0.8+0.8*k,0.45,0.95,0.02,0.22)
flared_roof([(1.95,1.65,1.12,0.1),(1.95,1.65,1.2,0.1),(1.6,1.3,1.3,0.0)],"roof",LX,LY)
flared_roof([(1.9,1.6,2.1,0.12),(1.9,1.6,2.18,0.12),(1.3,0.95,2.55,0.04),(1.0,0.1,2.95,0.0)],"roof",LX,LY)
flared_roof([(1.82,1.52,2.19,0.05),(1.82,1.52,2.23,0.05),(1.25,0.9,2.6,0.03),(0.95,0.08,3.0,0.0)],"snow",LX,LY)

# ---- boulders in the snow, and cedars climbing the slopes
for k in range(14):
    x,y=rng.uniform(-8.0,8.0),rng.uniform(-8.0,6.0)
    if pd(x,y)<1.4 or on_walk(x,y) or (abs(x-LX)<2.4 and abs(y-LY)<2.2): continue
    z=G(x,y); ico("stone",x,y,z-0.05,rng.uniform(0.25,0.5),rng.uniform(0.2,0.4),rng.uniform(0.18,0.3))
def cedar(x,y,s):
    z=G(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.13,-0.3,5),ngon(0.08,1.2,5)],"wood",T)
    for zc,r,hh in ((0.9,0.6,1.1),(1.6,0.42,1.0)):
        cone("fir",ngon(r,zc,6,rng.uniform(0,1)),(0,0,zc+hh),T)
        cone("snow",ngon(r*0.5,zc+hh*0.48,6,0.3),(0,0,zc+hh+0.05),T)
tp=[]
for k in range(200):
    x,y=rng.uniform(-8.4,8.4),rng.uniform(-8.4,8.4)
    if pd(x,y)<1.7 or (y<PC[1]+1.0 and pd(x,y)<3.0) or abs(x-0.3)<1.4 and y<-1.5 or (abs(x-LX)<2.6 and abs(y-LY)<2.4): continue
    if slope(x,y)<0.25 and rng.random()<0.75: continue
    if any(math.hypot(x-a,y-b)<1.15 for a,b in tp): continue
    tp.append((x,y)); cedar(x,y,rng.uniform(0.8,1.1))
    if len(tp)>=30: break

def ground_at(x,y):
    if on_walk(x,y): return 0.2
    return G(x,y)
def terrain_at(x,y): return G(x,y)
def water_disc(x,y): return pd(x,y)<0.9
INTERACT=(0.3,-2.7)   # at the end of the walk, by the pool
STAND=(0.3,-3.6)
