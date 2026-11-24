import random
rng=random.Random(65)
EXTRA_SOLIDS=[]; NOSOLID={"fir","forest"}
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
FH=11.2   # footprint half-width (the sidecar's half): the middle size, the temple mountain and its halls
TERRAIN_SURFACE=False; EDGE_LEVEL=0.0          # the model draws its own landform: the crags, the ledge, the valley

# ---- Hojusan in winter: a valley floor at the front, a rock face rising to the ledge where the Kaisando and the
# little red Nokyodo stand on their crag, the Godaido built out over the drop; higher crags behind
CRAGS=[(-3.75,0.05,1.25,0.75),(-6.2,5.6,1.6,1.4),(-2.6,6.4,1.9,1.5),(1.2,6.0,1.4,1.3),(4.4,5.4,1.7,1.4),(6.6,3.0,1.1,1.2),(-7.0,2.2,1.0,1.1)]
def H(x,y):
    h=3.2*smooth(-1.6,0.7,y+0.5*math.sin(0.7*x))+2.3*smooth(3.0,5.2,y+0.4*math.sin(0.9*x+1.0))
    for cx,cy,ch,cr in CRAGS:
        d=math.hypot(x-cx,y-cy)/cr; h+=ch*max(0.0,1-d*d)**1.5
    return h*smooth(11.0,8.4,y)*smooth(11.0,8.6,abs(x))
STEP=0.55; N=int(round(2*FH/STEP)); STEP=2*FH/N
g={}
for j in range(N+1):
    for i in range(N+1):
        x,y=-FH+i*STEP,-FH+j*STEP
        if 0<i<N and 0<j<N: x+=rng.uniform(-0.12,0.12); y+=rng.uniform(-0.12,0.12)
        g[(i,j)]=(x,y,H(x,y))
vs=[];ix={}
for k,vv in g.items(): ix[k]=len(vs); vs.append(vv)
fs=[];ms=[]
for j in range(N):
    for i in range(N):
        a,b,c,d=(i,j),(i+1,j),(i+1,j+1),(i,j+1)
        for t in ([(a,b,c),(a,c,d)] if (i+j)%2==0 else [(a,b,d),(b,c,d)]):
            ps=[g[k] for k in t]; hh=[p[2] for p in ps]
            sl=(max(hh)-min(hh))/STEP; h=sum(hh)/3
            m="snow"
            if sl>0.95: m="rock"
            elif sl>0.35 and h>0.4: m="forest"
            fs.append([ix[k] for k in t]); ms.append(m)
emit(vs,fs,ms)

def hall(cx,cy,hx,hy,h,wall="wood",roofz=None,ridge=None,rot=0.0):
    z=H(cx,cy) if roofz is None else roofz
    T=dict(cx=cx,cy=cy,rot=rot)
    box("stone",0,0,z-0.4,z+0.12,hx+0.15,hy+0.15,T)
    box(wall,0,0,z+0.12,z+h,hx,hy,T)
    return z
def roof(cx,cy,hx,hy,z,rise,ridge):
    flared_roof([(hx+0.35,hy+0.35,z,0.12),(hx+0.35,hy+0.35,z+0.08,0.12),(hx*0.55,hy*0.4,z+rise*0.6,0.04),(ridge,0.05,z+rise,0.0)],"roof",cx,cy)
    flared_roof([(hx+0.29,hy+0.29,z+0.09,0.04),(hx+0.29,hy+0.29,z+0.12,0.04),(hx*0.52,hy*0.38,z+rise*0.6+0.04,0.02),(ridge*0.95,0.04,z+rise+0.04,0.0)],"snow",cx,cy)

# the Konponchudo, the great main hall on the valley floor
z=hall(-4.6,-6.2,1.7,1.15,1.15)
for k in range(5): box("glow_doors",-4.6-1.2+0.6*k,-6.2-1.16,z+0.2,z+0.95,0.2,0.02)
roof(-4.6,-6.2,1.7,1.15,z+1.15,1.3,1.1)
# the Sanmon at the foot of the steps
z=H(0.0,-4.3)
for sx in (-0.75,0.75):
    for sy in (-0.3,0.3): box("wood",sx,-4.3+sy,z-0.1,z+1.4,0.07,0.07)
box("wood",0,-4.3,z+1.25,z+1.4,0.9,0.4)
roof(0.0,-4.3,0.95,0.45,z+1.4,0.75,0.75)
# the stone steps: up the valley, then switching back and forth up the face to the ledge
PATH=[(0.0,-5.2),(0.0,-3.6),(0.2,-2.2),(-0.4,-1.3),(0.8,-0.6),(-0.2,0.2),(-0.9,1.0),(-1.6,1.3)]
for (x0,y0),(x1,y1) in zip(PATH,PATH[1:]):
    L=math.hypot(x1-x0,y1-y0); n=max(2,int(L/0.3)); a=math.atan2(y1-y0,x1-x0)
    for k in range(n):
        t=(k+0.5)/n; x,y=x0+(x1-x0)*t,y0+(y1-y0)*t; z=H(x,y)
        box("stone",0,0,z-0.35,z+0.06,0.16,0.42,dict(cx=x,cy=y,rot=a))

# ---- on the ledge: the Kaisando, and the little vermilion Nokyodo on the crag's tip beside it
z=hall(-2.1,1.85,0.75,0.6,0.85)
box("glow_doors",-2.1,1.85-0.61,z+0.2,z+0.7,0.35,0.02)
roof(-2.1,1.85,0.75,0.6,z+0.85,0.8,0.5)
nx,ny=-3.75,0.05; nz=H(nx,ny)
box("red",nx,ny,nz-0.2,nz+0.62,0.38,0.38)
box("glow_doors",nx,ny-0.39,nz+0.12,nz+0.48,0.18,0.02)
flared_roof([(0.62,0.62,nz+0.62,0.08),(0.62,0.62,nz+0.68,0.08),(0.04,0.04,nz+1.08,0.0)],"roof",nx,ny)
flared_roof([(0.55,0.55,nz+0.69,0.03),(0.55,0.55,nz+0.72,0.03),(0.03,0.03,nz+1.12,0.0)],"snow",nx,ny)
# ---- the Godaido: an open timber stage built out over the drop on a frame of posts, the view hall of the valley
GX,GY=2.5,0.55; GZ=H(GX,GY+0.8)+0.15
box("wood",GX,GY,GZ-0.1,GZ,1.05,0.8)
for sx in (-1,0,1):
    for sy in (-1,0,1):
        x,y=GX+sx*0.95,GY+sy*0.7; box("wood",x,y,H(x,y)-0.2,GZ-0.1,0.06,0.06)
for zc in (0.35,0.6):
    zz=GZ-0.1-(GZ-H(GX,GY-0.7))*zc
    box("wood",GX,GY-0.7,zz-0.04,zz+0.04,1.0,0.04); box("wood",GX-0.95,GY,zz-0.04,zz+0.04,0.04,0.75); box("wood",GX+0.95,GY,zz-0.04,zz+0.04,0.04,0.75)
for sx in (-1,1):
    for sy in (-1,1): box("wood",GX+sx*0.95,GY+sy*0.7,GZ,GZ+1.0,0.06,0.06)
box("wood",GX,GY-0.78,GZ+0.35,GZ+0.42,1.02,0.03); box("wood",GX-1.03,GY,GZ+0.35,GZ+0.42,0.03,0.78); box("wood",GX+1.03,GY,GZ+0.35,GZ+0.42,0.03,0.78)
box("glow_doors",GX,GY+0.68,GZ+0.1,GZ+0.8,0.6,0.02)
roof(GX,GY,1.0,0.75,GZ+1.0,0.85,0.7)

# ---- snowed cedars on the slopes and in the valley
def cedar(x,y,s):
    z=H(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.13,-0.3,5),ngon(0.08,1.2,5)],"wood",T)
    for zc,r,hh in ((0.9,0.58,1.1),(1.6,0.4,1.0)):
        cone("fir",ngon(r,zc,6,rng.uniform(0,1)),(0,0,zc+hh),T)
        cone("snow",ngon(r*0.5,zc+hh*0.48,6,0.3),(0,0,zc+hh+0.05),T)
keep=[(-4.6,-6.2,2.4),(0,-4.3,1.3),(-2.1,1.85,1.3),(-3.75,0.05,0.9),(2.5,0.55,1.6)]+[(x,y,0.55) for x,y in PATH]
tp=[]
for k in range(260):
    x,y=rng.uniform(-9.8,9.8),rng.uniform(-9.8,8.6)
    h=H(x,y)
    if h>4.2 or any(math.hypot(x-a,y-b)<r+0.4 for a,b,r in keep) or any(math.hypot(x-a,y-b)<1.1 for a,b in tp): continue
    gx=(H(x+0.3,y)-H(x-0.3,y))/0.6; gy=(H(x,y+0.3)-H(x,y-0.3))/0.6
    if math.hypot(gx,gy)>1.3: continue
    if y<-3.0 and rng.random()<0.55: continue
    tp.append((x,y)); cedar(x,y,rng.uniform(0.8,1.1))
    if len(tp)>=34: break

def ground_at(x,y):
    if abs(x-GX)<1.05 and abs(y-GY)<0.8: return GZ
    return H(x,y)
def water_disc(x,y): return False
INTERACT=(0.0,-5.0)   # before the Sanmon at the foot of the thousand steps
STAND=(-0.2,-6.8)
