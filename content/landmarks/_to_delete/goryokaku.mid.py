import random
rng=random.Random(59)
EXTRA_SOLIDS=[]; NOSOLID={"fir","bare"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the star fort in its moat
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0

# ---- the star: five bastions, a notch toward the front (-Y) where the bridge crosses; the moat follows the
# walls at a constant width, so its outer edge is the star offset outward
def star(R,r,a0=-math.pi/2):
    P=[]
    for k in range(5):
        a=a0+2*math.pi*k/5
        P.append((r*math.cos(a),r*math.sin(a))); b=a+math.pi/5; P.append((R*math.cos(b),R*math.sin(b)))
    return P
def offset(P,w):
    n=len(P); L=[]
    for i in range(n):
        a,b=P[i],P[(i+1)%n]; dx,dy=b[0]-a[0],b[1]-a[1]; l=math.hypot(dx,dy)
        L.append(((a[0]+dy/l*w,a[1]-dx/l*w),(dx,dy)))
    Q=[]
    for i in range(n):
        (p1,d1),(p2,d2)=L[i-1],L[i]
        den=d1[0]*d2[1]-d1[1]*d2[0]; t=((p2[0]-p1[0])*d2[1]-(p2[1]-p1[1])*d2[0])/den
        Q.append((p1[0]+d1[0]*t,p1[1]+d1[1]*t))
    return Q
def inside(P,x,y):
    c=False; n=len(P)
    for i in range(n):
        (x1,y1),(x2,y2)=P[i],P[(i+1)%n]
        if (y1>y)!=(y2>y) and x<x1+(y-y1)*(x2-x1)/(y2-y1): c=not c
    return c
def edist(P,x,y):
    d=1e9; n=len(P)
    for i in range(n):
        (x1,y1),(x2,y2)=P[i],P[(i+1)%n]; dx,dy=x2-x1,y2-y1
        t=max(0.0,min(1.0,((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy)))
        d=min(d,math.hypot(x-x1-t*dx,y-y1-t*dy))
    return d
IN=star(7.0,4.6)
if sum(IN[i][0]*IN[(i+1)%10][1]-IN[(i+1)%10][0]*IN[i][1] for i in range(10))<0: IN=IN[::-1]
MW=1.6
def rmax(P): return max(math.hypot(*p) for p in P)
sg=1 if rmax(offset(IN,1.0))>rmax(IN) else -1      # the sign that offsets outward
OUT=offset(IN,sg*MW); OUTW=offset(IN,sg*(MW+0.25)); INW=offset(IN,-sg*0.25)
CH=-0.75; WZ=-0.42; FZ=0.25
BRX=0.75; BY0,BY1=-6.65,-4.15
def on_bridge(x,y): return abs(x)<BRX and BY0<y<BY1
def rampart(x,y):
    d=edist(IN,x,y)
    h=0.42*smooth(0.25,0.9,d)*(1-smooth(1.5,2.3,d))
    if y<-2.0: h*=smooth(1.4,2.2,abs(x))          # the gate's cut through the bank
    return h
def G(x,y):
    if inside(IN,x,y): return FZ+rampart(x,y)
    if inside(OUT,x,y): return CH
    return 0.0
for i in range(10):                                  # the moat water, a ring of trapezoids
    a,b,c,d=IN[i],IN[(i+1)%10],OUT[(i+1)%10],OUT[i]
    emit([(*a,WZ),(*b,WZ),(*c,WZ),(*d,WZ)],[[0,1,2,3]],["water"])
def ringwall(A,B,z0,z1,mat="stonewall"):
    for i in range(10):
        a,b,c,d=A[i],A[(i+1)%10],B[(i+1)%10],B[i]
        solid([[(*a,z0),(*b,z0),(*c,z0),(*d,z0)],[(*a,z1),(*b,z1),(*c,z1),(*d,z1)]],mat)
ringwall(IN,INW,CH-0.05,FZ+0.08)                     # the dressed-stone walls of the bastions
ringwall(OUT,OUTW,CH-0.05,0.06)                      # the counterscarp
# the bridge into the notch, timber, rising gently from the outer bank onto the fort
def deckz(y): return 0.08+(FZ+0.1-0.08)*smooth(BY0,BY1,y)
NB=6
for k in range(NB):
    y0=BY0+(BY1-BY0)*k/NB; y1=BY0+(BY1-BY0)*(k+1)/NB
    solid([[(-BRX,y0,deckz(y0)-0.12),(BRX,y0,deckz(y0)-0.12),(BRX,y0,deckz(y0)),(-BRX,y0,deckz(y0))],
           [(-BRX,y1,deckz(y1)-0.12),(BRX,y1,deckz(y1)-0.12),(BRX,y1,deckz(y1)),(-BRX,y1,deckz(y1))]],"wood")
for sx in (-1,1):
    for k in range(NB+1):
        y=BY0+(BY1-BY0)*k/NB; box("wood",sx*(BRX-0.05),y,deckz(y),deckz(y)+0.5,0.05,0.05)
    solid([[(sx*(BRX-0.05)-0.04,BY0,deckz(BY0)+0.44),(sx*(BRX-0.05)+0.04,BY0,deckz(BY0)+0.44),(sx*(BRX-0.05)+0.04,BY0,deckz(BY0)+0.52),(sx*(BRX-0.05)-0.04,BY0,deckz(BY0)+0.52)],
           [(sx*(BRX-0.05)-0.04,BY1,deckz(BY1)+0.44),(sx*(BRX-0.05)+0.04,BY1,deckz(BY1)+0.44),(sx*(BRX-0.05)+0.04,BY1,deckz(BY1)+0.52),(sx*(BRX-0.05)-0.04,BY1,deckz(BY1)+0.52)]],"wood")
    for zc in (CH-0.05,):
        for y in (-5.75,-5.05): prism("wood",sx*0.5,y,zc,deckz(y)-0.1,0.07,0.07,6)

# ---- the Hakodate magistrate's office: a long low hall of white plaster over dark timber, grey tile under snow,
# the drum tower on its ridge; a gabled porch faces the bridge
HX,HY=0.0,0.9
def hall(cx,cy,hx,hy,zb,h,ridge):
    box("wood",cx,cy,zb-0.1,zb+0.32,hx+0.02,hy+0.02); box("plaster",cx,cy,zb+0.32,zb+h,hx,hy)
    for k in range(int(hx/0.55)):
        x=cx-hx+0.35+k*((2*hx-0.7)/max(1,int(hx/0.55)-1))
        box("glow_windows",x,cy-hy-0.02,zb+0.45,zb+h-0.18,0.13,0.02)
    z=zb+h
    flared_roof([(hx+0.42,hy+0.42,z,0.16),(hx+0.42,hy+0.42,z+0.07,0.16),(hx-0.15,hy-0.35,z+0.55,0.05),(ridge,0.08,z+0.95,0.0)],"roof",cx,cy)
    flared_roof([(hx+0.34,hy+0.34,z+0.07,0.06),(hx+0.34,hy+0.34,z+0.11,0.06),(hx-0.2,hy-0.38,z+0.6,0.03),(ridge-0.05,0.06,z+0.99,0.0)],"snow",cx,cy)
    return z+0.95
top=hall(HX,HY,2.7,1.05,FZ,0.95,2.1)
hall(HX+2.5,HY+1.95,0.85,1.1,FZ,0.85,0.55)                      # the rear wings
hall(HX-2.4,HY+1.95,0.85,1.1,FZ,0.85,0.55)
# drum tower
box("plaster",HX,HY,top-0.2,top+0.55,0.38,0.38)
box("glow_windows",HX,HY-0.39,top+0.12,top+0.42,0.22,0.02)
flared_roof([(0.62,0.62,top+0.55,0.1),(0.62,0.62,top+0.6,0.1),(0.04,0.04,top+1.0,0.0)],"roof",HX,HY)
flared_roof([(0.54,0.54,top+0.6,0.04),(0.54,0.54,top+0.63,0.04),(0.03,0.03,top+1.03,0.0)],"snow",HX,HY)
# the porch toward the bridge
PY=HY-1.05-0.45
box("wood",HX,PY,FZ-0.1,FZ+0.95,0.62,0.45)
box("glow_door",HX,PY-0.46,FZ,FZ+0.75,0.38,0.02)
extrude_y("roof",[(-0.95,FZ+0.9),(0,FZ+1.5),(0.95,FZ+0.9),(0.85,FZ+0.86),(0,FZ+1.38),(-0.85,FZ+0.86)],PY-0.65,PY+0.5)
extrude_y("snow",[(-0.9,FZ+0.97),(0,FZ+1.56),(0.9,FZ+0.97),(0.82,FZ+0.95),(0,FZ+1.46),(-0.82,FZ+0.95)],PY-0.6,PY+0.5)
box("pave",HX,-2.6,FZ-0.05,FZ+0.03,0.55,1.6)                      # the stone walk from the gate

# ---- pines on the banks, bare cherries in the court, firs out beyond the moat
def fir(x,y,s):
    z=G(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.12,-0.3,5),ngon(0.08,0.8,5)],"wood",T)
    for zc,r,hh in ((0.6,0.72,1.05),(1.25,0.46,0.95)):
        cone("fir",ngon(r,zc,6,rng.uniform(0,1)),(0,0,zc+hh),T)
        cone("snow",ngon(r*0.55,zc+hh*0.45,6,0.3),(0,0,zc+hh+0.06),T)
def bare(x,y,s):
    z=G(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.1,-0.3,5),ngon(0.06,0.9,5)],"wood",T)
    ico("bare",0,0,1.35,0.75,0.75,0.55,T); ico("bare",0.35,0.2,1.05,0.45,0.45,0.35,T)
for k in range(10):                                 # pines on the bank of each bastion
    p=IN[k]; c=(0.0,0.0)
    if k==0: continue
    t=0.78 if k%2 else 0.7
    x,y=p[0]*t,p[1]*t
    fir(x,y,0.75 if k%2 else 0.65)
for x,y,s in [(-3.6,-1.6,0.8),(3.6,-1.6,0.8),(-2.0,-2.8,0.7),(2.0,-2.8,0.7),(-4.4,1.6,0.8),(4.4,1.6,0.8),(0.0,4.6,0.85),(-1.6,3.6,0.7),(1.6,3.6,0.7)]:
    bare(x,y,s)
for x,y,s in [(-9.6,-9.4,1.0),(-8.0,-9.8,0.85),(9.4,-9.6,1.0),(9.8,-7.8,0.85),(-9.6,9.4,1.0),(-7.6,9.8,0.85),(9.6,9.4,1.0),(9.8,7.4,0.85),
              (-2.6,-9.8,0.8),(2.8,-9.6,0.8),(-9.8,-1.2,0.8),(9.8,-1.6,0.8),(0.4,9.9,0.8)]:
    if abs(x)<FH-1.1 and abs(y)<FH-1.1 and not inside(OUTW,x,y) and edist(OUTW,x,y)>0.8: fir(x,y,s)

def ground_at(x,y):
    if on_bridge(x,y): return deckz(y)
    return G(x,y)
def terrain_at(x,y): return G(x,y)
def water_disc(x,y): return inside(OUT,x,y) and not inside(IN,x,y) and edist(IN,x,y)>0.15 and edist(OUT,x,y)>0.15 and not on_bridge(x,y)
INTERACT=(0.0,-3.3)   # just inside the gate, on the walk to the magistrate's office
STAND=(1.2,-3.6)
