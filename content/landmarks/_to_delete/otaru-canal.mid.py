import random
rng=random.Random(58)
EXTRA_SOLIDS=[]; NOSOLID={"fir"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, a stretch of canal with its warehouses and walk
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0
def to_xy(u,v): return (v,-u)     # u toward the front (-Y), v along +X: the canal runs along a grid axis
def to_uv(x,y): return (-y,x)
R45=0.0; R135=math.pi/2
def T45(u,v,z=0.0): x,y=to_xy(u,v); return dict(cx=x,cy=y,cz=z,rot=R45)      # local x along v, local y toward -u
def T135(u,v,z=0.0): x,y=to_xy(u,v); return dict(cx=x,cy=y,cz=z,rot=R135)    # local x toward -u, local y toward -v

# ---- the canal: a straight stone-walled channel running screen-right, sunk below the banks, ending in a stone
# head at either end so the water stays inside the footprint. Asakusa bridge crosses it near the left end
CW=1.75; VC=8.4; CH=-0.75; WZ=-0.42; BRV=-6.4; BRW=0.75
def in_canal(u,v,m=0.0): return abs(u)<CW-m and -VC+m<v<VC-m
def on_bridge(u,v): return abs(v-BRV)<BRW and abs(u)<CW+0.6
def G(u,v): return CH if in_canal(u,v) else 0.0
q=[to_xy(-CW,-VC),to_xy(CW,-VC),to_xy(CW,VC),to_xy(-CW,VC)]
emit([(*p,WZ) for p in q],[[0,1,2,3]],["water"])
def wall(u0,v0,u1,v1,z0,z1,mat="stonewall"):
    a=to_xy(u0,v0); b=to_xy(u1,v0); c=to_xy(u1,v1); d=to_xy(u0,v1)
    solid([[(*a,z0),(*b,z0),(*c,z0),(*d,z0)],[(*a,z1),(*b,z1),(*c,z1),(*d,z1)]],mat)
for sd in (-1,1):                                      # the embankment walls, coped a little above the bank
    wall(sd*CW,-VC-0.25,sd*(CW+0.25),VC+0.25,CH-0.05,0.06)
for se in (-1,1):
    wall(-CW-0.25,se*VC,CW+0.25,se*(VC+0.25),CH-0.05,0.06)
for k in range(9):                                     # mooring stones and stains along the far wall
    v=-7.4+1.85*k
    if abs(v-BRV)<1.0: continue
    wall(-CW+0.02,v-0.12,-CW+0.14,v+0.12,WZ-0.02,-0.1,"pave")
# Asakusa bridge: a flat stone deck with low parapets
wall(-CW-0.5,BRV-BRW,CW+0.5,BRV+BRW,-0.32,0.05,"pave")
for sd in (-1,1):
    wall(-CW-0.5,BRV+sd*BRW,CW+0.5,BRV+sd*(BRW-0.16),0.05,0.5,"stonewall")
    for su in (-1,1): box("stonewall",*to_xy(su*(CW+0.42),BRV+sd*(BRW-0.08)),0.05,0.68,0.12,0.12)
# a moored barge
TB=T45(-0.75,2.6,WZ)
solid([[(-1.1,-0.28,-0.02),(1.1,-0.28,-0.02),(1.1,0.28,-0.02),(-1.1,0.28,-0.02)],[(-1.35,-0.38,0.2),(1.35,-0.38,0.2),(1.35,0.38,0.2),(-1.35,0.38,0.2)]],"wood",TB)
box("snow",0.1,0,0.2,0.28,0.95,0.26,TB)

# ---- the far bank: the stone warehouses of the old port, long sides to the water, gables under deep snow;
# one of red brick. Lit doors and windows face the canal
def warehouse(uc,v0,v1,D,H,R,mat,doors):
    L=(v1-v0)/2; vc=(v0+v1)/2; T=T45(uc,vc); Tg=T135(uc,vc)
    box(mat,0,0,-0.1,H,L,D,T)
    extrude_y(mat,[(-D,H-0.02),(D,H-0.02),(0,H+R-0.14)],-L,L,Tg)                    # the gable walls
    extrude_y("roof",[(-D-0.32,H-0.16),(D+0.32,H-0.16),(0,H+R-0.04)],-L-0.32,L+0.32,Tg)
    extrude_y("snow",[(-D-0.36,H-0.05),(D+0.36,H-0.05),(0,H+R+0.1)],-L-0.26,L+0.26,Tg)
    box("roof",0,-D-0.02,H-0.36,H-0.22,L+0.05,0.04,T)                                  # the dark string course
    for k,(dv,kind) in enumerate(doors):
        if kind=="door":
            box("glow_doors",dv,-D-0.03,0.0,1.05,0.36,0.03,T)
            box("iron",dv-0.52,-D-0.04,0.0,1.15,0.12,0.03,T); box("iron",dv+0.52,-D-0.04,0.0,1.15,0.12,0.03,T)
        elif kind=="win":
            box("glow_windows",dv,-D-0.03,1.35,1.85,0.2,0.03,T)
        else:
            box("iron",dv,-D-0.03,1.35,1.85,0.22,0.03,T)
    for dv in (-L*0.55,L*0.55):                                                        # back-side shutters
        box("iron",dv,D+0.03,1.35,1.85,0.22,0.03,T)
UW=-3.55; DW=1.35
warehouse(UW,-8.0,-4.3,DW,2.2,1.05,"ware",[(-1.1,"sh"),(0.0,"door"),(1.1,"win")])
warehouse(UW-0.15,-4.0,-0.2,DW+0.15,2.55,1.15,"brick",[(-1.2,"win"),(-0.4,"sh"),(0.6,"door"),(1.45,"win")])
warehouse(UW,0.1,4.4,DW,2.3,1.05,"ware",[(-1.4,"door"),(-0.3,"win"),(0.7,"sh"),(1.6,"win")])
warehouse(UW+0.1,4.7,8.1,DW-0.1,2.0,0.95,"ware",[(-0.9,"win"),(0.3,"door"),(1.3,"sh")])
wall(-CW-0.25,-VC-0.25,UW+DW+0.05,VC+0.25,-0.05,0.04,"pave")                          # the narrow quay before them
# the street behind, and lower buildings beyond it
for vc,L,H,mat in ((-5.6,1.6,1.5,"ware"),(-2.2,1.4,1.7,"brick"),(1.2,1.5,1.4,"ware"),(4.4,1.3,1.6,"ware")):
    T=T45(-7.2,vc); Tg=T135(-7.2,vc); D=1.0
    box(mat,0,0,-0.1,H,L,D,T)
    extrude_y("roof",[(-D-0.25,H-0.12),(D+0.25,H-0.12),(0,H+0.62)],-L-0.25,L+0.25,Tg)
    extrude_y("snow",[(-D-0.28,H-0.03),(D+0.28,H-0.03),(0,H+0.74)],-L-0.2,L+0.2,Tg)
    box("glow_windows",-L*0.4,-D-0.03,0.6,1.0,0.18,0.03,T); box("glow_windows",L*0.4,-D-0.03,0.6,1.0,0.18,0.03,T)

# ---- the near bank: the stone walk with its gas lamps, a snow bank along the canal edge set with snow candles
wall(CW+0.25,-VC-0.25,4.5,VC+0.25,-0.05,0.03,"pave")
for k in range(12):                                     # the snow bank, a low ridge along the coping
    v=-VC+0.1+(2*VC-0.2)*k/12; v1=-VC+0.1+(2*VC-0.2)*(k+1)/12
    if on_bridge(CW+0.6,v) or on_bridge(CW+0.6,v1): continue
    a,b=to_xy(CW+0.1,v),to_xy(CW+0.1,v1); c,d=to_xy(CW+0.75,v1),to_xy(CW+0.75,v)
    hh=rng.uniform(0.16,0.26)
    solid([[(*a,0.0),(*b,0.0),(*c,0.0),(*d,0.0)],[(*to_xy(CW+0.3,v+0.1),hh),(*to_xy(CW+0.3,v1-0.1),hh),(*to_xy(CW+0.55,v1-0.1),hh*0.8),(*to_xy(CW+0.55,v+0.1),hh*0.8)]],"snow")
for k in range(16):
    v=-7.6+15.2*k/15
    if on_bridge(CW+0.6,v): continue
    x,y=to_xy(CW+0.45,v)
    box("glow_candles",x,y,0.12,0.36,0.06,0.06)
    prism("snow",x,y,0.0,0.18,0.14,0.11,6)
LU=4.05
def lamp(v):
    x,y=to_xy(LU,v); T=dict(cx=x,cy=y,rot=R45)
    prism("iron",x,y,0.0,0.16,0.13,0.1,6); prism("iron",x,y,0.16,1.85,0.05,0.04,6)
    box("iron",0,0,1.78,1.84,0.42,0.03,T)
    for sx in (-0.36,0.36):
        box("glow_lamps",sx,0,1.56,1.8,0.09,0.09,T)
        frus("iron",sx,0,1.84,1.96,0.13,0.13,0.03,0.03,None,T)
    prism("iron",x,y,1.85,2.05,0.03,0.01,4)
for v in (-7.6,-5.1,-2.6,-0.1,2.4,4.9,7.4): lamp(v)
for v in (-3.9,3.6):                                    # benches
    T=T45(4.4,v); box("wood",0,0,0.38,0.46,0.6,0.18,T); box("snow",0,0,0.46,0.52,0.56,0.15,T)
    for sx in (-0.5,0.5): box("iron",sx,0,0.0,0.38,0.04,0.15,T)

# ---- snow-laden firs and drifts on the open ground
def fir(u,v,s):
    x,y=to_xy(u,v); T=dict(cx=x,cy=y,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.12,-0.3,5),ngon(0.08,0.8,5)],"wood",T)
    for zc,r,hh in ((0.6,0.75,1.1),(1.3,0.48,1.0)):
        cone("fir",ngon(r,zc,6,rng.uniform(0,1)),(0,0,zc+hh),T)
        cone("snow",ngon(r*0.55,zc+hh*0.45,6,0.3),(0,0,zc+hh+0.06),T)
for u,v,s in [(6.0,-7.6,1.0),(8.4,-5.2,0.9),(6.4,-2.4,1.0),(8.8,0.8,1.1),(6.2,4.6,0.9),(8.6,7.4,1.0),(5.8,9.4,0.85),(9.4,-8.8,0.85),
              (-1.0,9.6,1.0),(2.4,9.8,0.9),(-0.6,-9.6,1.0),(2.6,-9.8,0.85),(-6.0,9.4,0.9),(-9.2,8.6,0.85),(-6.2,-9.4,0.9),(-9.0,-8.4,0.85),(-9.4,-0.2,0.8)]:
    x,y=to_xy(u,v)
    if abs(x)<FH-1.1 and abs(y)<FH-1.1: fir(u,v,s)
def ground_at(x,y):
    u,v=to_uv(x,y)
    if on_bridge(u,v): return 0.05
    return G(u,v)
def terrain_at(x,y):
    u,v=to_uv(x,y); return G(u,v)
def water_disc(x,y): u,v=to_uv(x,y); return in_canal(u,v,0.15) and not on_bridge(u,v)
INTERACT=to_xy(3.0,1.15)   # on the canal walk between two lamps, looking across at the warehouses
STAND=to_xy(3.3,1.15)
