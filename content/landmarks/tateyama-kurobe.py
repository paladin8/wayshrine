# Yuki-no-Otani, Tateyama Kurobe (the road cut through the spring snowfield between banded snow walls) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python tateyama-kurobe.py
# Rebuilds content/landmarks/tateyama-kurobe.blend and public/models/landmarks/tateyama-kurobe.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/tateyama-kurobe.glb"
BLEND=ROOT+"/content/landmarks/tateyama-kurobe.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"snow":"f3f6f7","band":"aab4bc","dirt":"928a80","asphalt":"3e3f44","line":"e2b53c","rock":"6b6767","pine":"3f5a3e","white":"eef0f0","stripe":"3f7a52","glass":"2b3238"}
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
rng=random.Random(18)
EXTRA_SOLIDS=[]
FH=9.6   # footprint half-width (the sidecar's half): the default size, a single feature
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)

# ---- the road: a gentle S through the snowfield, entering on the near-right edge and leaving on the far-left, so
# the camera looks down the corridor and sees the far wall's face
PA=(9.3,-3.9); PB=(-9.3,2.9)
DX,DY=PB[0]-PA[0],PB[1]-PA[1]; LEN=math.hypot(DX,DY); RX,RY=DX/LEN,DY/LEN; NX,NY=RY,-RX     # n points to the far (+y) side, away from the camera
NS=30
def path(t):
    off=0.9*math.sin(2*math.pi*t)
    return (PA[0]+DX*t+NX*off,PA[1]+DY*t+NY*off)
PTS=[path(k/(NS-1)) for k in range(NS)]
def frame_t(t):
    a=path(t-0.01); b=path(t+0.01); dx,dy=b[0]-a[0],b[1]-a[1]; L=math.hypot(dx,dy)
    return dx/L,dy/L,dy/L,-dx/L
def frame(k):
    a=PTS[max(0,k-1)]; b=PTS[min(NS-1,k+1)]; dx,dy=b[0]-a[0],b[1]-a[1]; L=math.hypot(dx,dy)
    return dx/L,dy/L,dy/L,-dx/L
def edge_out(px,py,nx,ny):
    t=1e9; Bd=FH-0.35
    if abs(nx)>1e-6: t=min(t,((Bd if nx>0 else -Bd)-px)/nx)
    if abs(ny)>1e-6: t=min(t,((Bd if ny>0 else -Bd)-py)/ny)
    return t
RW=1.0; WALK=0.45; W=RW+WALK      # carriageway half-width, the walkway along the far wall, wall offset
def ribbon(mat,o0,o1,z0,z1):
    rings=[]
    for k,(px,py) in enumerate(PTS):
        _,_,nx,ny=frame(k)
        c=lambda x: max(-FH+0.05,min(FH-0.05,x))     # the road meets the footprint edge flush
        rings.append([(c(px+nx*o0),c(py+ny*o0),z0),(c(px+nx*o1),c(py+ny*o1),z0),(c(px+nx*o1),c(py+ny*o1),z1),(c(px+nx*o0),c(py+ny*o0),z1)])
    solid(rings,mat)
ribbon("asphalt",-W,W,-0.05,0.03)
ribbon("line",-0.035,0.035,0.03,0.045)
ribbon("dirt",RW,W,0.03,0.06)                       # the walkway along the far wall
for sg in (-1,1): ribbon("white",sg*RW-0.03,sg*RW+0.03,0.03,0.045)   # edge lines

# ---- the snow walls: sheer faces banded with the winter's layers, a rounded lip, the snowfield beyond falling to
# the footprint edge. The far wall stands taller. The near one is low at the entrance and through the first bend, so
# the road shows past it there, then rises along the middle of the cut so the road reads as running between walls.
SEG=["snow","dirt","snow","band","snow","dirt","snow","band","snow","snow","snow","snow","snow"]
def wall(sg,Hmax,hof=None):
    rings=[]
    CL=FH-0.25
    for k in range(NS):
        t=0.035+0.93*k/(NS-1); px,py=path(t); _,_,nx,ny=frame_t(t); ox,oy=nx*sg,ny*sg
        env=max(0.03,smooth(0.035,0.24,t)*smooth(0.035,0.24,1-t))   # the walls rise from nothing at each end of the cut
        H=(hof(t) if hof else Hmax)*env*(0.92+0.08*math.sin(7*t+sg))
        oo=max(W+3.0,min(W+6.4,edge_out(px,py,ox,oy)))     # twin berms, the bare ground showing beyond them
        j=0.03*math.sin(13*t+2*sg)
        prof=[(W,-0.1),(W+0.02+j,0.2*H),(W-0.01+j,0.25*H),(W+0.04,0.4*H),(W+0.0,0.45*H),(W+0.05+j,0.62*H),(W+0.01+j,0.67*H),
              (W+0.07,0.8*H),(W+0.03,0.845*H),(W+0.02,0.97*H),(W+0.3,H+0.1),(W+0.4*(oo-W),H+0.25*env),(oo-1.6,0.4*H),(oo,-0.1)]
        ring=[]
        for o,z in prof:   # the snow eases down to the ground near the footprint edge, so it meets the game's terrain (and the walkable berm's edge is 0)
            x,y=px+ox*o,py+oy*o; de=FH-max(abs(x),abs(y))
            ring.append((max(-CL,min(CL,x)),max(-CL,min(CL,y)),-0.1+(z+0.1)*smooth(0.0,3.8,de)))
        rings.append(ring)
    n=len(rings[0]); verts=[p for r in rings for p in r]; faces=[]; fm=[]
    for k in range(NS-1):
        for i in range(n):
            j=(i+1)%n; q=[k*n+i,k*n+j,(k+1)*n+j,(k+1)*n+i]
            faces+=[[q[0],q[1],q[2]],[q[0],q[2],q[3]]]; m=SEG[i] if i<len(SEG) else "snow"; fm+=[m,m]
    faces.append(list(range(n))); fm.append("snow"); faces.append([(NS-1)*n+i for i in range(n)]); fm.append("snow")
    emit(verts,faces,fm)
    return rings
FAR=wall(1,4.6); NEAR=wall(-1,0,lambda t: 2.2+1.9*smooth(0.3,0.46,t)*smooth(0.98,0.8,t))
def snow_top(rings,k):
    r=rings[k]; return r[11]           # a point on the snowfield top
# rocks and creeping pine (haimatsu) breaking through the snowfield where it thins toward the edges
def rock(cx,cy,cz,s):
    T=dict(cx=cx,cy=cy,cz=cz,rot=rng.uniform(0,6.28),s=s)
    ico("rock",0,0,0.15,0.6,0.45,0.4,T)
def haimatsu(cx,cy,cz,s):
    T=dict(cx=cx,cy=cy,cz=cz,rot=rng.uniform(0,6.28),s=s)
    ico("pine",0,0,0.12,0.75,0.55,0.28,T); ico("pine",0.5,0.2,0.1,0.45,0.4,0.22,T)
def slope_pt(rings,k,f):
    """A point part-way down the outer slope of a wall (f=0 at the plateau's far edge, 1 at the bottom)."""
    a=rings[k][11]; b=rings[k][13]
    return (a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f)
for rings,ks in ((FAR,[4,9,15,21,26]),(NEAR,[5,12,19,25])):
    for k in ks:
        f=rng.uniform(0.55,0.85); x,y,z=slope_pt(rings,k,f)
        if abs(x)>FH-0.8 or abs(y)>FH-0.8: continue
        (rock if rng.random()<0.5 else haimatsu)(x,y,z-0.12,rng.uniform(0.7,1.0))
# on the bare ground beyond the berms
for x,y in [(6.8,4.2),(3.0,7.4),(-1.6,8.6),(-5.6,7.2),(8.4,1.0),(-6.8,-4.6),(-2.6,-7.8),(1.8,-8.6),(-8.6,-1.2),(5.6,-8.2)]:
    if min(math.hypot(x-px,y-py) for px,py in PTS)<W+6.7: continue      # under the berm
    (rock if rng.random()<0.4 else haimatsu)(x,y,0.0,rng.uniform(0.8,1.15))
for k in (7,13,18,24):
    x,y,z=FAR[k][11]; x2,y2,z2=FAR[k][10]
    rock((x+x2)/2,(y+y2)/2,(z+z2)/2-0.1,0.6)

# ---- a Tateyama highland bus coming through the first bend, for the height of the walls and the width of the road
BT=0.24; bx,by=path(BT); tx,ty,nx_,ny_=frame_t(BT); BR=math.atan2(ty,tx)
TB=dict(cx=bx-nx_*0.5,cy=by-ny_*0.5,rot=BR)
box("white",0,0,0.16,0.95,1.5,0.36,TB)
box("stripe",0,0,0.3,0.42,1.51,0.37,TB)
box("glass",-0.15,0,0.55,0.82,1.3,0.37,TB)                 # the side windows
box("glass",1.5,0,0.45,0.85,0.01,0.3,TB)                   # the windscreen, leading
box("white",0,0,0.95,1.0,1.4,0.3,TB)
for wx in (-1.0,0.95):
    for wy in (-0.33,0.33): box("glass",wx,wy,0.0,0.3,0.17,0.05,TB)
STAND=path(0.08); STAND=(STAND[0]+frame(2)[2]*0.4,STAND[1]+frame(2)[3]*0.4)

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/tateyama-kurobe.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=FH; GSTEP=0.4; GN=int(round(2*HALF/GSTEP))+1   # a fine grid, so the climbable berm's edge stays crisp
# The near berm is climbable: its top and outer slope are walkable ground, reached from the bare ground beyond it
# or from the low ends of the cut. The road is at ground level; the far berm is solid. The game draws the ground
# beneath (terrainSurface).
NT=[]
for k in range(NS-1):
    for i in range(len(NEAR[0])-1):
        a,b,c,d4=NEAR[k][i],NEAR[k][i+1],NEAR[k+1][i+1],NEAR[k+1][i]
        for tri in ((a,b,c),(a,c,d4)):
            (x0,y0,z0),(x1,y1,z1),(x2,y2,z2)=tri
            ux,uy,uz=x1-x0,y1-y0,z1-z0; vx,vy,vz=x2-x0,y2-y0,z2-z0
            cx,cy,cz=uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx; ln=math.sqrt(cx*cx+cy*cy+cz*cz)
            if ln>1e-9 and abs(cz)/ln>0.25: NT.append(tri)      # top and slope faces, not the sheer wall
NTB={}
for tri in NT:
    xs=[p[0] for p in tri]; ys=[p[1] for p in tri]
    for bx in range(int(math.floor(min(xs))),int(math.floor(max(xs)))+1):
        for by in range(int(math.floor(min(ys))),int(math.floor(max(ys)))+1): NTB.setdefault((bx,by),[]).append(tri)
def berm_h(x,y):
    best=0.0
    for (x0,y0,z0),(x1,y1,z1),(x2,y2,z2) in NTB.get((int(math.floor(x)),int(math.floor(y))),()):
        den=(y1-y2)*(x0-x2)+(x2-x1)*(y0-y2)
        if abs(den)<1e-12: continue
        l0=((y1-y2)*(x-x2)+(x2-x1)*(y-y2))/den; l1=((y2-y0)*(x-x2)+(x0-x2)*(y-y2))/den; l2=1-l0-l1
        if min(l0,l1,l2)>=-1e-6: best=max(best,l0*z0+l1*z1+l2*z2)
    return best
def ground_at(x,y): return round(berm_h(x,y),3)
ground=[[ground_at(-HALF+GSTEP*ix, -(-HALF+GSTEP*iz)) for ix in range(GN)] for iz in range(GN)]
# a fence of solids along the top of the near wall: no walking up the sheer face, or off it
for q in range(240):
    t=0.035+0.93*q/239; px,py=path(t); _,_,nx,ny=frame_t(t)
    x,y=px-nx*(W+0.14),py-ny*(W+0.14)
    if berm_h(px-nx*(W+0.6),py-ny*(W+0.6))>0.55 and abs(x)<FH-0.3 and abs(y)<FH-0.3:
        if not EXTRA_SOLIDS or math.hypot(x-EXTRA_SOLIDS[-1][0],y-EXTRA_SOLIDS[-1][1])>=0.28: EXTRA_SOLIDS.append((x,y,0.2))
CELL=0.3
solid_cells=set(); cellg={}
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
                    ck=(int((x+HALF)/CELL),int((y+HALF)/CELL)); g=cellg.get(ck)
                    if g is None: g=cellg[ck]=ground_at(-HALF+CELL*(ck[0]+0.5),-HALF+CELL*(ck[1]+0.5))
                    if z<g+BAND0 or z>g+BAND1: continue
                    if nz>0.92 and z<g+0.6: continue
                    solid_cells.add(ck)
solids=[[round(-HALF+CELL*(cx+0.5),2), round(-(-HALF+CELL*(cy+0.5)),2), 0.22] for cx,cy in sorted(solid_cells)]
solids+=[[round(x,2),round(-y,2),r] for x,y,r in EXTRA_SOLIDS]
INTERACT=path(0.5)   # the middle of the corridor
# STAND (set above): the walkway at the near entrance
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]],"terrainSurface":True,
      # the terrain stays at the plateau under the snow walls: the climbable berm is the model's own snow
      "terrain":[[0.0]*GN for _ in range(GN)]}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/tateyama-kurobe.json"
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
    objname=key if key.startswith("glow_") else "yuki_"+key
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
clr=min(math.hypot(s[0]-STAND[0],s[1]+STAND[1])-s[2] for s in solids)
res={"stand_clear":round(clr,3),"tris":sum(stats.values()),"per_obj":stats,"materials":len(bpy.data.materials),"min":[round(v,3) for v in mn],"max":[round(v,3) for v in mx],"glb_bytes":os.path.getsize(GLB)}
json.dump(res,open("/tmp/lm_build.json","w"))
