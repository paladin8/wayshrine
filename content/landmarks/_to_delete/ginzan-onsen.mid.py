import random
rng=random.Random(63)
EXTRA_SOLIDS=[]; NOSOLID={"fir","roof","snow"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the onsen street along its river
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0

# ---- the Ginzan river: a narrow stone-walled channel down the middle of the street, fed by the falls at its head
RW=1.1; RY0,RY1=-8.6,7.25; CH=-0.75; WZ=-0.42
def in_river(x,y,m=0.0): return abs(x)<RW-m and RY0+m<y<RY1-m
BRS=[(-6.3,0.6,"red"),(1.2,0.55,"wood")]
def on_bridge(x,y): return any(abs(y-by)<bw and abs(x)<RW+0.35 for by,bw,_ in BRS)
def G(x,y): return CH if in_river(x,y) else 0.0
emit([(-RW,RY0,WZ),(RW,RY0,WZ),(RW,RY1,WZ),(-RW,RY1,WZ)],[[0,1,2,3]],["water"])
def wall(x0,y0,x1,y1,z0,z1,mat="stonewall"):
    solid([[(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0)],[(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)]],mat)
for sd in (-1,1): wall(sd*RW,RY0-0.25,sd*(RW+0.22),RY1+0.25,CH-0.05,0.06)
for y0,y1 in ((RY0-0.25,RY0),(RY1,RY1+0.25)): wall(-RW-0.22,y0,RW+0.22,y1,CH-0.05,0.06)
for k in range(10):                                  # stones in the stream
    x,y=rng.uniform(-0.8,0.8),rng.uniform(RY0+0.6,RY1-0.8)
    if on_bridge(x,y): continue
    ico("stonewall",x,y,WZ,rng.uniform(0.12,0.22),rng.uniform(0.1,0.18),0.08)
# the walks along both banks
for sd in (-1,1): wall(sd*(RW+0.22),RY0-0.25,sd*2.7,RY1+0.25,-0.05,0.03,"pave")
# the bridges: a red-railed one by the entrance, a plain timber one mid-street
for by,bw,rm in BRS:
    wall(-RW-0.35,by-bw,RW+0.35,by+bw,-0.05,0.14,"wood")
    for sy in (-1,1):
        y=by+sy*(bw-0.05)
        for x in (-RW-0.25,-0.4,0.4,RW+0.25): box(rm,x,y,0.14,0.68,0.045,0.045)
        wall(-RW-0.3,y-0.04,RW+0.3,y+0.04,0.6,0.7,rm)

# ---- the ryokan: three and four storeys of dark timber and white plaster, every floor lit, pent eaves under
# snow, balconies on the upper floors; gables face the river on some, ridges run along it on others
def pent(fx,sd,y0,y1,z,o=0.42):
    P=[(fx,z+0.12),(fx-sd*o,z-0.08),(fx-sd*o,z-0.15),(fx,z+0.04)]
    solid([[(x,y0,zz) for x,zz in P],[(x,y1,zz) for x,zz in P]],"roof")
    S=[(fx,z+0.2),(fx-sd*(o-0.06),z+0.0),(fx-sd*(o-0.06),z-0.06),(fx,z+0.12)]
    solid([[(x,y0+0.05,zz) for x,zz in S],[(x,y1-0.05,zz) for x,zz in S]],"snow")
def ryokan(sd,cy,L,D,ns,gable,tower=False,fx0=2.75):
    cx=sd*(fx0+D); fx=sd*fx0; zs=[0.0,1.1]+[1.1+0.9*k for k in range(1,ns)]
    box("wood",cx,cy,-0.1,zs[1],D,L)
    box("glow_windows",fx-sd*0.02,cy,0.15,0.9,0.02,L*0.7)
    for s in range(1,ns):
        z0,z1=zs[s],zs[s+1]
        box("plaster",cx,cy,z0,z1,D-0.03,L-0.03)
        for k in range(4): box("wood",fx-sd*0.01,cy-L+0.08+k*(2*L-0.16)/3,z0,z1,0.02,0.06)
        box("wood",fx-sd*0.01,cy,z0,z0+0.12,0.02,L)
        nw=max(2,int(L/0.55))
        for k in range(nw):
            y=cy-L+(k+0.5)*2*L/nw
            box("glow_windows",fx-sd*0.02,y,z0+0.25,z1-0.15,0.02,L/nw*0.62)
        if s>=2: box("iron",fx-sd*0.22,cy,z0+0.3,z0+0.36,0.025,L-0.05)
        pent(fx,sd,cy-L-0.05,cy+L+0.05,z0)
    zt=zs[ns]; R=0.9
    if gable:   # ridge across the street, the gable facing the river
        T=dict(cx=cx,cy=cy,rot=math.pi/2)
        extrude_y("plaster",[(-L+0.03,zt-0.02),(L-0.03,zt-0.02),(0,zt+R-0.12)],-D+0.03,D-0.03,T)
        extrude_y("roof",[(-L-0.35,zt-0.14),(L+0.35,zt-0.14),(0,zt+R)],-D-0.35,D+0.35,T)
        extrude_y("snow",[(-L-0.3,zt-0.04),(L+0.3,zt-0.04),(0,zt+R+0.1)],-D-0.3,D+0.3,T)
        box("glow_windows",fx-sd*0.02,cy,zt+0.12,zt+0.45,0.02,0.22)
    else:
        extrude_y("plaster",[(cx-D+0.03,zt-0.02),(cx+D-0.03,zt-0.02),(cx,zt+R*0.8-0.12)],cy-L+0.03,cy+L-0.03)
        extrude_y("roof",[(cx-D-0.35,zt-0.14),(cx+D+0.35,zt-0.14),(cx,zt+R*0.8)],cy-L-0.35,cy+L+0.35)
        extrude_y("snow",[(cx-D-0.3,zt-0.04),(cx+D+0.3,zt-0.04),(cx,zt+R*0.8+0.1)],cy-L-0.3,cy+L+0.3)
    if ns>1: box("wood",fx-sd*0.1,cy-L+0.25,1.3,zt-0.1,0.07,0.16)          # the tall signboard
    else:       # the low bathhouses on the near bank show their lit backs to the hillside path
        bx=cx+sd*D
        for k in range(3): box("glow_windows",bx+sd*0.02,cy-L+(k+0.5)*2*L/3,0.35,0.85,0.02,L/3*0.6)
        P=[(bx,0.98),(bx+sd*0.4,0.8),(bx+sd*0.4,0.74),(bx,0.9)]
        solid([[(x,cy-L,zz) for x,zz in P],[(x,cy+L,zz) for x,zz in P]],"roof")
        pent(fx,sd,cy-L,cy+L,1.0,0.35)
    if tower:
        tx=cx; tz=zt+R*0.55
        box("plaster",tx,cy,tz-0.3,tz+0.75,0.42,0.42)
        box("glow_windows",tx-sd*0.43,cy,tz+0.05,tz+0.55,0.02,0.28)
        flared_roof([(0.72,0.72,tz+0.75,0.1),(0.72,0.72,tz+0.82,0.1),(0.05,0.05,tz+1.25,0.0)],"roof",tx,cy)
        flared_roof([(0.64,0.64,tz+0.84,0.04),(0.64,0.64,tz+0.87,0.04),(0.03,0.03,tz+1.29,0.0)],"snow",tx,cy)
for sd,cy,L,D,ns,gab,tw in [(-1,-7.2,1.3,1.4,3,True,False),(-1,-3.9,1.6,1.5,4,False,False),(-1,-0.3,1.4,1.4,3,True,True),(-1,3.2,1.6,1.5,3,False,False),(-1,6.1,1.0,1.3,3,True,False),
                            (1,-6.3,1.3,1.2,1,False,False),(1,-1.9,1.3,1.2,1,True,False),(1,4.0,1.4,1.2,1,False,False)]:
    ryokan(sd,cy,L,D,ns,gab,tw)

# ---- gas lamps along both walks
for sd in (-1,1):
    for y in (-7.6,-4.9,-2.3,0.0,2.6,5.2):
        if on_bridge(sd*1.6,y): continue
        x=sd*1.55
        prism("iron",x,0+y,0.0,0.12,0.11,0.09,6); prism("iron",x,y,0.12,1.55,0.04,0.035,6)
        box("glow_lamps",x,y,1.55,1.8,0.1,0.1); frus("iron",x,y,1.8,1.9,0.14,0.14,0.03,0.03)

# ---- the falls at the head of the street: a rock bluff, its crown snowed and wooded, the water dropping into
# the river's pool
def rring(cx,cy,rx,ry,z,ph):
    return [(cx+rx*(1+0.12*math.sin(3*a+ph))*math.cos(a),cy+ry*(1+0.12*math.sin(3*a+ph))*math.sin(a),z) for a in [2*math.pi*k/12 for k in range(12)]]
solid([rring(0,8.75,5.2,1.25,-0.1,0.4),rring(0,8.85,4.6,1.1,1.9,0.9),rring(0,8.95,3.9,0.95,2.85,1.3)],"rock")
solid([rring(0,8.95,3.85,0.92,2.84,1.3),rring(0,8.95,3.4,0.8,3.05,1.3)],"snow")
box("snow",0,7.2,WZ,2.7,0.42,0.06)
ico("snow",0,7.0,WZ,0.7,0.35,0.18)
def fir(x,y,s,z=0.0):
    T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.12,-0.3,5),ngon(0.08,0.8,5)],"wood",T)
    for zc,r,hh in ((0.6,0.7,1.1),(1.3,0.45,1.0)):
        cone("fir",ngon(r,zc,6,rng.uniform(0,1)),(0,0,zc+hh),T)
        cone("snow",ngon(r*0.55,zc+hh*0.45,6,0.3),(0,0,zc+hh+0.06),T)
for x,s in ((-2.6,0.8),(-0.9,0.75),(1.0,0.8),(2.7,0.75)): fir(x,9.0+0.2*math.sin(x),s,3.0)
for x,y,s in [(-7.2,-8.6,0.9),(-7.6,-4.6,1.0),(-7.4,-0.4,0.9),(-7.2,3.6,1.0),(-6.6,7.6,0.9),(-8.8,9.0,0.9),
              (7.4,-8.4,0.9),(7.6,-4.2,1.0),(7.2,0.2,0.9),(7.4,4.0,1.0),(6.8,7.8,0.9),(8.8,9.2,0.9),(-3.6,-9.8,0.8),(3.8,-9.8,0.8),(3.7,-4.1,0.85),(3.6,1.05,0.8),(3.5,6.6,0.85)]:
    fir(x,y,s)

def ground_at(x,y):
    if on_bridge(x,y): return 0.14
    return G(x,y)
def terrain_at(x,y): return G(x,y)
def water_disc(x,y): return in_river(x,y,0.15) and not on_bridge(x,y)
INTERACT=(0.0,1.2)   # on the timber bridge mid-street, among the lit ryokan
STAND=(2.4,1.1)
