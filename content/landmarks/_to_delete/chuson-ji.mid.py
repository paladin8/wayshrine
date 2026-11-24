import random
rng=random.Random(64)
EXTRA_SOLIDS=[]; NOSOLID={"fir"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=9.6   # footprint half-width (the sidecar's half): a single feature, the Golden Hall in its cover hall
TERRAIN_SURFACE=True; EDGE_LEVEL=0.0

# ---- the hilltop terrace among the cedars, reached by stone steps from the front
TX0,TX1,TY0,TY1=-3.8,3.8,-1.6,5.0; TZ=0.9
def dd(x,y):
    dx=max(TX0-x,0.0,x-TX1); dy=max(TY0-y,0.0,y-TY1); return math.hypot(dx,dy)
def G(x,y): return TZ*(1-smooth(0.0,1.6,dd(x,y)))
for k in range(8):
    y=-3.35+0.22*k; z=G(0,y+0.11)
    box("stone",0,y+0.11,z-0.3,z+0.03,0.75,0.12)
box("stone",0,-1.0,TZ-0.05,TZ+0.03,0.7,0.65)                       # the paved walk to the hall

# ---- Konjikido: the Golden Hall on its black lacquered dais, gilded walls and pyramidal roof, the sacred jewel
# on the peak. (Shown open to the sky, as it stood before its cover halls were built)
z0=TZ; KX,KY=0.0,1.4
box("stone",KX,KY,z0-0.1,z0+0.12,2.0,2.0)
box("lacquer",KX,KY,z0+0.12,z0+0.45,1.55,1.55)
box("gold",KX,KY,z0+0.45,z0+0.53,1.62,1.62)
box("gold",KX,KY,z0+0.53,z0+1.85,1.2,1.2)
for sx in (-1,1):
    for sy in (-1,1): box("gold",KX+sx*1.22,KY+sy*1.22,z0+0.53,z0+1.85,0.09,0.09)
for sx in (-1,0,1):
    if sx: box("gold",KX+sx*0.42,KY-1.22,z0+0.53,z0+1.85,0.07,0.04)
box("lacquer",KX,KY-1.21,z0+0.6,z0+1.55,0.34,0.02)                    # the doors, dark between gilded posts
box("glow_altar",KX,KY-1.22,z0+0.8,z0+1.35,0.2,0.02)
for sx in (-1,1):
    box("lacquer",KX+sx*0.8,KY-1.21,z0+0.75,z0+1.45,0.3,0.02); box("lacquer",KX+sx*1.21,KY,z0+0.75,z0+1.45,0.02,0.6)
box("lacquer",KX,KY-1.21,z0+1.62,z0+1.7,1.2,0.02)
for k in range(3):                                                     # steps up the dais
    box("lacquer",KX,KY-1.62-0.16*k,z0+0.12,z0+0.45-0.11*k,0.45,0.08)
flared_roof([(1.75,1.75,z0+1.85,0.16),(1.75,1.75,z0+1.96,0.16),(0.07,0.07,z0+2.85,0.0)],"gold",KX,KY)
prism("gold",KX,KY,z0+2.85,z0+3.0,0.11,0.07,6); ico("gold",KX,KY,z0+3.05,0.1,0.1,0.1)

# stone lanterns at the top of the steps
for k,sx in enumerate((-1.35,1.35)):
    x,y=sx,-1.25
    prism("stone",x,y,TZ-0.05,TZ+0.6,0.1,0.08,6); box("stone",x,y,TZ+0.6,TZ+0.66,0.2,0.2)
    box("glow_lanterns",x,y,TZ+0.66,TZ+0.88,0.12,0.12)
    flared_roof([(0.25,0.25,TZ+0.88,0.04),(0.25,0.25,TZ+0.93,0.04),(0.03,0.03,TZ+1.13,0.0)],"stone",x,y)
    cone("snow",[(x+0.22*math.cos(a),y+0.22*math.sin(a),TZ+0.95) for a in [2*math.pi*j/6 for j in range(6)]],(x,y,TZ+1.16))

# ---- the old cover hall (Kyu-Ooido): weathered timber under a hip roof, on the level ground to the left
QX,QY=-6.2,3.2
box("stone",QX,QY,-0.1,0.15,1.35,1.35)
box("wood",QX,QY,0.15,1.6,1.15,1.15)
for k in range(5): box("lacquer",QX-1.15+k*0.575,QY-1.16,0.15,1.6,0.05,0.02)
flared_roof([(1.65,1.65,1.6,0.14),(1.65,1.65,1.68,0.14),(0.9,0.9,2.2,0.04),(0.06,0.06,2.75,0.0)],"roof",QX,QY)
flared_roof([(1.56,1.56,1.69,0.05),(1.56,1.56,1.73,0.05),(0.85,0.85,2.26,0.03),(0.04,0.04,2.8,0.0)],"snow",QX,QY)

# ---- the tall cedars of the precinct, lining the approach and closing in behind
def cedar(x,y,s):
    z=G(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.14,-0.3,5),ngon(0.09,1.4,5)],"wood",T)
    for zc,r,hh in ((1.1,0.62,1.2),(1.9,0.45,1.1),(2.6,0.3,0.9)):
        cone("fir",ngon(r,zc,6,rng.uniform(0,1)),(0,0,zc+hh),T)
        cone("snow",ngon(r*0.5,zc+hh*0.48,6,0.3),(0,0,zc+hh+0.05),T)
for x,y,s in [(-1.9,-7.6,1.1),(1.9,-7.2,1.15),(-2.0,-5.2,1.2),(2.1,-4.8,1.1),(-4.6,-2.6,1.2),(4.8,-2.2,1.25),
              (-5.0,0.8,1.3),(5.4,1.4,1.2),(4.6,4.4,1.3),(-3.4,7.2,1.3),(-0.6,7.6,1.35),(2.4,7.4,1.25),(5.6,7.0,1.2),
              (-7.6,6.6,1.15),(-8.0,-0.6,1.1),(7.8,-5.6,1.1),(-7.4,-6.4,1.1),(7.6,4.0,1.15),(-4.2,4.8,1.2)]:
    cedar(x,y,s)

def ground_at(x,y): return G(x,y)
def water_disc(x,y): return False
INTERACT=(0.0,-1.0)   # at the top of the steps, before the Golden Hall
STAND=(0.0,-2.8)
