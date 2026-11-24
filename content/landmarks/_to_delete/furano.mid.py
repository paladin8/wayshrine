import random
rng=random.Random(61)
EXTRA_SOLIDS=[]; NOSOLID={"leaf","lavender","poppy","pink","orange","yellow","cream","gravel"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, a hillside farm of flower fields
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0

# ---- the hill: one broad rise, its crown toward the back, falling to level meadow before every edge
HC=(-0.5,2.2); HR=8.6; HH=1.8
def G(x,y):
    d=math.hypot(x-HC[0],(y-HC[1])*1.1)/HR
    return HH*max(0.0,1-d*d)**1.5

def strip(mat,pts,w,h,sink=0.08,top=0.6):
    # a mounded row lofted along the ground through pts (x,y)
    rings=[]
    for k,(x,y) in enumerate(pts):
        a=pts[max(k-1,0)]; b=pts[min(k+1,len(pts)-1)]
        dx,dy=b[0]-a[0],b[1]-a[1]; l=math.hypot(dx,dy) or 1.0; nx,ny=-dy/l,dx/l
        z=G(x,y)
        rings.append([(x+nx*w,y+ny*w,z-sink),(x+nx*w*top,y+ny*w*top,z+h),(x-nx*w*top,y-ny*w*top,z+h),(x-nx*w,y-ny*w,z-sink)])
    solid(rings,mat)

# ---- the lavender field on the left of the hill: long mounded rows of bushes running across the slope,
# bowing gently with the contour
for j in range(15):
    y0=-5.4+0.78*j
    x0,x1=-9.2+0.25*math.sin(j),0.6
    n=int((x1-x0)/0.55)
    pts=[(x0+(x1-x0)*k/n,y0+0.45*math.sin(0.35*(x0+(x1-x0)*k/n)+0.3)) for k in range(n+1)]
    pts=[p for p in pts if abs(p[0])<FH-1.2 and abs(p[1])<FH-1.2]
    if len(pts)>1: strip("lavender",pts,0.25,0.3)
# ---- the Irodori field on the right: broad flat bands of colour running down the slope
COL=["poppy","cream","pink","lavender","orange","yellow","poppy","cream","pink","lavender"]
for j,m in enumerate(COL):
    x=2.0+0.78*j
    y0,y1=-5.0+0.3*math.cos(j),6.6-0.4*math.sin(j)
    n=int((y1-y0)/0.6)
    pts=[(x+0.25*math.sin(0.3*(y0+(y1-y0)*k/n)),y0+(y1-y0)*k/n) for k in range(n+1)]
    pts=[p for p in pts if abs(p[0])<FH-1.2 and abs(p[1])<FH-1.2]
    if len(pts)>1: strip(m,pts,0.36,0.14,0.06,0.85)

# ---- the gravel walks: one along the foot of the fields, one climbing between them to a bench on the crown
def walk(pts,w=0.45): strip("gravel",pts,w,0.03,0.06,1.0)
walk([(-9.6+19.2*k/24,-6.5+0.15*math.sin(k*0.5)) for k in range(25)])
walk([(1.3+0.15*math.sin(k*0.7),-6.3+12.6*k/18) for k in range(19)],0.38)
bx,by=1.3,6.9; bz=G(bx,by)
box("bark",bx,by+0.25,bz+0.38,bz+0.46,0.6,0.18)
for sx in (-0.5,0.5): box("bark",bx+sx,by+0.25,bz-0.1,bz+0.38,0.05,0.15)

# ---- the farm: a white shop and drying barn with red roofs below the fields
def house(cx,cy,hx,hy,h,r,rot=0.0):
    T=dict(cx=cx,cy=cy,rot=rot)
    box("cream",0,0,-0.1,h,hx,hy,T)
    extrude_y("cream",[(-hx,h-0.02),(hx,h-0.02),(0,h+r-0.12)],-hy,hy,T)
    extrude_y("roof",[(-hx-0.3,h-0.12),(hx+0.3,h-0.12),(0,h+r)],-hy-0.25,hy+0.25,T)
    box("bark",0,-hy-0.02,0.0,0.85,0.3,0.03,T)
    for sx in (-0.6,0.6):
        if hx>1.0: box("bark",sx*hx,-hy-0.02,0.45,0.85,0.22,0.03,T)
house(-5.6,-8.6,1.7,1.0,1.1,0.85)
house(-2.4,-8.9,1.0,0.8,1.0,0.7)
house(6.4,-8.4,1.3,1.6,1.5,1.0,math.pi/2)
prism("roof",8.9,-9.3,-0.1,2.6,0.5,0.5,8); frus("roof",8.9,-9.3,2.6,3.0,0.5,0.5,0.05,0.05)

# ---- the windbreak of poplars along the back, birches at the field corners
def poplar(x,y,s):
    z=G(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.12,-0.3,5),ngon(0.08,1.0,5)],"bark",T)
    ico("leaf",0,0,2.2,0.55,0.55,1.6,T)
for k in range(14):
    x=-9.0+18.0*k/13; y=8.8+0.25*math.sin(k*1.7)
    if abs(x)<FH-1.2: poplar(x,y,rng.uniform(0.9,1.1))
def tree(x,y,s):
    z=G(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.12,-0.3,5),ngon(0.07,1.4,5)],"cream",T)
    ico("leaf",0,0,1.9,0.9,0.9,0.75,T); ico("leaf",0.4,0.25,1.5,0.55,0.55,0.45,T)
for x,y,s in [(-9.4,-3.2,0.9),(-9.6,1.6,0.85),(-9.2,6.0,0.9),(9.6,-3.6,0.9),(9.4,1.2,0.85),(9.6,5.6,0.9),(-8.6,-9.4,0.85),(3.6,-9.6,0.8),(9.6,-6.8,0.85)]:
    tree(x,y,s)

def ground_at(x,y): return G(x,y)
def water_disc(x,y): return False
INTERACT=(-3.0,-6.3)   # on the walk at the foot of the lavender rows
STAND=(-2.0,-7.0)
