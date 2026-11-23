# Yoshino-yama (hills clouded with cherry blossom, the road up the ridge through the village to Kinpusen-ji's Zao-do) landmark generator for Wayshrine.
# Run: Blender -b --factory-startup --python yoshino-yama.py
# Rebuilds content/landmarks/yoshino-yama.blend and public/models/landmarks/yoshino-yama.glb
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
GLB=ROOT+"/public/models/landmarks/yoshino-yama.glb"
BLEND=ROOT+"/content/landmarks/yoshino-yama.blend"
os.makedirs(os.path.dirname(GLB),exist_ok=True); os.makedirs(os.path.dirname(BLEND),exist_ok=True)

PAL={"grass":"7da15c","grassd":"668a4b","path":"c8bfa8","stone":"9a958c","wood":"7a5236","roof":"4a4440","plaster":"e9e4d8","blossom":"f2c4d0","blossom2":"e3a3b6","cedar":"2f4a35","bark":"5a4334","glow_cream":"e8dcb0"}
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
rng=random.Random(20)
EXTRA_SOLIDS=[]
FH=11.2   # footprint half-width (the sidecar's half): the middle size, a scene with its hills
def smooth(e0,e1,x):
    t=max(0.0,min(1.0,(x-e0)/(e1-e0))); return t*t*(3-2*t)
S2=math.sqrt(0.5)
# axes: u runs toward the viewer (+X/-Y), v across (+X/+Y, screen right)
def to_xy(u,v): return (S2*(u+v),S2*(v-u))
def to_uv(x,y): return (S2*(x-y),S2*(x+y))
ROT=math.pi/4
def hsh(i,j,k=0):
    n=(i*73856093)^(j*19349663)^(k*83492791); n=(n<<13)^n
    return ((n*(n*n*15731+789221)+1376312589)&0x7fffffff)/0x7fffffff

# ---- the hills: a ridge climbing from the front to the back of the footprint, where the Zao-do stands on a levelled
# terrace, with lower hills either side; all walkable, easing to the base height at the footprint edge
def H_raw(x,y):
    u,v=to_uv(x,y)
    ridge=4.3*math.exp(-((v+0.6+0.18*u)/4.2)**2)*smooth(8.0,-5.0,u)
    right=2.8*math.exp(-((u+0.5)**2+(v-7.2)**2)/11.0)
    left=2.5*math.exp(-((u-2.5)**2+(v+7.8)**2)/10.0)
    back=1.6*math.exp(-((u+9.0)**2+(v-3.5)**2)/12.0)
    n=0.22*math.sin(0.9*x+0.4)*math.sin(0.8*y+1.1)
    f=smooth(0.0,2.6,FH-max(abs(x),abs(y)))
    return max(0.0,f*(ridge+right+left+back+n))
HU,HV=-4.0,-0.4; HXc,HYc=to_xy(HU,HV)
TZ=round(H_raw(HXc,HYc)-0.25,2)
def H(x,y):
    h=H_raw(x,y); d=math.hypot(x-HXc,y-HYc)
    w=1-smooth(3.0,4.6,d)                       # the terrace the hall stands on
    return h+(TZ-h)*w
GS=0.8; NG=int(round(2*FH/GS))
HV_={}
for i in range(NG+1):
    for j in range(NG+1):
        x,y=-FH+i*GS,-FH+j*GS; HV_[(i,j)]=(x,y,H(x,y))
verts=[]; faces=[]; fm=[]; vid={}
def vi(k):
    if k not in vid: vid[k]=len(verts); verts.append(HV_[k])
    return vid[k]
for i in range(NG):
    for j in range(NG):
        q=[(i,j),(i+1,j),(i+1,j+1),(i,j+1)]
        if max(HV_[k][2] for k in q)<=0.0: continue
        for tri in ([q[0],q[1],q[2]],[q[0],q[2],q[3]]) if (i+j)%2==0 else ([q[0],q[1],q[3]],[q[1],q[2],q[3]]):
            a,b,c=[Vector(HV_[k]) for k in tri]; n=(b-a).cross(c-a).normalized()
            faces.append([vi(k) for k in tri]); fm.append("grass" if n.z>0.86 else "grassd")
emit(verts,faces,fm,orient=False)

# ---- the approach: a pale road winding up the ridge to the terrace, draped on the slope
def path_v(u): return -0.4+1.2*math.sin(0.42*u+0.3)*smooth(-1.5,2.0,u)
PW=0.75
rings=[]
for k in range(52):
    u=11.6-(11.6-(HU+3.0))*k/51; c=path_v(u)
    pa=to_xy(u,c-PW); pb=to_xy(u,c+PW); pm=to_xy(u,c)
    za=H(*pa); zb=H(*pb); zm=max(H(*pm),(za+zb)/2)
    # a crowned cross-section a little above the slope, so the triangulated hill never pokes through
    rings.append([(pa[0],pa[1],za-0.15),(pb[0],pb[1],zb-0.15),(pb[0],pb[1],zb+0.1),(pm[0],pm[1],zm+0.14),(pa[0],pa[1],za+0.1)])
solid(rings,"path")
box("path",0,0,TZ-0.12,TZ+0.04,2.8,2.6,dict(cx=HXc,cy=HYc,rot=ROT))      # the terrace's gravel court
def path_dist(x,y):
    u,v=to_uv(x,y)
    if u<HU+3.0: return 99.0
    return abs(v-path_v(u))

# ---- the Zao-do: Kinpusen-ji's great hall, dark timber on a stone base, under a deep two-tier roof
TH=dict(cx=HXc,cy=HYc,rot=ROT)
box("stone",0,0.4,TZ-0.6,TZ+0.3,2.4,2.2,TH)
for k in range(3): box("stone",0,-1.8-0.22*k-0.11,TZ-0.6,TZ+0.3-0.1*(k+1),1.2,0.11,TH)   # steps
box("wood",0,0.4,TZ+0.3,TZ+1.9,2.0,1.8,TH)
box("plaster",0,-1.41,TZ+0.95,TZ+1.55,1.6,0.02,TH)
for x in (-2.0,-1.2,-0.4,0.4,1.2,2.0): box("roof",x,-1.42,TZ+0.3,TZ+1.9,0.07,0.04,TH)
for k in range(4): box("glow_door_%d"%k,-1.2+k*0.8,-1.43,TZ+0.35,TZ+0.9,0.25,0.02,TH)
def roof_at(spec,dy=0.4):
    before=len(B.get("roof",([],[]))[0])
    flared_roof(spec,"roof",0.0,0.0)
    bv=B["roof"][0]
    for i in range(before,len(bv)):
        x,y,z=bv[i]; bv[i]=xf([(x,y+dy,z)],**TH)[0]
roof_at([(2.85,2.65,TZ+1.9,0.2),(2.85,2.65,TZ+2.0,0.2),(2.1,1.9,TZ+2.3,0.04)])            # the lower roof (mokoshi)
box("wood",0,0.4,TZ+2.3,TZ+2.95,1.75,1.55,TH)
roof_at([(2.7,2.45,TZ+2.95,0.32),(2.7,2.45,TZ+3.07,0.32),(1.8,1.45,TZ+3.9,0.08),(1.4,0.2,TZ+4.7,0.0)])
for sx in (-1,1):                                                     # lanterns at the foot of the steps
    lx,ly=xf([(sx*1.7,-2.6,0)],**TH)[0][:2]
    prism("stone",lx,ly,TZ-0.05,TZ+0.15,0.26,0.26,4,math.pi/4); prism("stone",lx,ly,TZ+0.15,TZ+0.75,0.09,0.09,4,math.pi/4)
    prism("stone",lx,ly,TZ+0.75,TZ+0.84,0.22,0.22,4,math.pi/4); prism("glow_lamp_%d"%(1 if sx<0 else 2),lx,ly,TZ+0.84,TZ+1.06,0.15,0.15,4,math.pi/4)
    cone("roof",ngon(0.34,TZ+1.06,4,math.pi/4,lx,ly),(lx,ly,TZ+1.3))

# ---- the village strung along the road below the hall: small timber houses with dark roofs
def house(u,side,w=0.75,d=0.6,h=0.9,gi=None):
    v=path_v(u)+side*(PW+1.25); x,y=to_xy(u,v)
    T=dict(cx=x,cy=y,rot=ROT)
    zs=[H(*xf([(sx*w,sy*d,0)],**T)[0][:2]) for sx in (-1,1) for sy in (-1,1)]
    z0=min(zs)-0.3; z1=max(zs)
    box("plaster",0,0,z0,z1+h,w,d,T)
    box("wood",0,0,z0,z1+0.35,w+0.02,d+0.02,T)
    if gi is not None: box("glow_window_%d"%gi,0,-side*0.0-d-0.01,z1+0.45,z1+0.75,0.3,0.02,T)
    extrude_x("roof",[(-d-0.25,z1+h-0.05),(d+0.25,z1+h-0.05),(d+0.25,z1+h+0.05),(0,z1+h+0.6),(-d-0.25,z1+h+0.05)],-w-0.2,w+0.2,T)
    return (x,y,max(w,d)+0.4)
HOUSES=[house(6.4,1,gi=1),house(4.6,-1),house(2.6,1,0.9,0.65,1.0,gi=2),house(0.8,-1,0.7,0.6)]

# ---- the cherry trees: pale pink clouds over the slopes, dark cedars among them
placed=[(x,y,r) for x,y,r in HOUSES]+[(HXc,HYc,3.6)]
def free(x,y,d): return all(math.hypot(x-px,y-py)>=d+pr for px,py,pr in placed)
def sakura(x,y,s):
    z=H(x,y); T=dict(cx=x,cy=y,cz=z,s=s,rot=rng.uniform(0,6.28))
    solid([ngon(0.13,-0.4,5),ngon(0.1,0.85,5,0,0.08,0),ngon(0.07,1.25,5,0,0.03,0.08)],"bark",T)
    m1="blossom" if rng.random()<0.65 else "blossom2"
    ico(m1,0,0,1.55,1.0,0.95,0.7,T); ico("blossom" if m1=="blossom2" else "blossom2",0.55,0.3,1.3,0.6,0.55,0.45,T)
def cedar(x,y,s):
    z=H(x,y); T=dict(cx=x,cy=y,cz=z,s=s)
    prism("bark",0,0,-0.4,1.0,0.16,0.13,5,0,T)
    cone("cedar",ngon(0.8,0.8,6,rng.uniform(0,1)),(0,0,2.6),T); cone("cedar",ngon(0.55,1.8,6,rng.uniform(0,1)),(0,0,3.4),T)
tries=0; n_s=0; n_c=0
while tries<5000 and (n_s<46 or n_c<12):
    tries+=1
    x,y=rng.uniform(-FH+1.2,FH-1.2),rng.uniform(-FH+1.2,FH-1.2); u,v=to_uv(x,y)
    if path_dist(x,y)<PW+0.9: continue
    if HU-3.0<u<HU+9.5 and abs(v-(path_v(u) if u>HU+3.0 else HV))<2.4 and u>HU+2.0: continue   # the view up the road to the hall
    if not free(x,y,0.95): continue
    if n_s<46 and (n_c>=12 or rng.random()<0.8):
        sakura(x,y,rng.uniform(0.85,1.1)); placed.append((x,y,0.45)); n_s+=1
    elif n_c<12:
        cedar(x,y,rng.uniform(0.85,1.05)); placed.append((x,y,0.45)); n_c+=1
STAND=to_xy(10.4,path_v(10.4))

# ---- sidecar for the game: ground heights, solid footprints and where to stand.
# Written to src/world/landmark-grounds/yoshino-yama.json and read by the world layer (see docs/landmarks.md).
# Game coordinates: x = Blender x, z = -Blender y, height = Blender z; the model's origin is the region's site.
HALF=FH; GSTEP=0.8; GN=int(round(2*HALF/GSTEP))+1
def ground_at(x,y): return H(x,y)   # the hills, the road and the terrace are all walkable; the game draws the ground beneath
ground=[[round(ground_at(-HALF+GSTEP*ix, -(-HALF+GSTEP*iz)),3) for ix in range(GN)] for iz in range(GN)]
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
INTERACT=xf([(0,-2.4,0)],**TH)[0][:2]   # the terrace in front of the Zao-do
# STAND (set above): the foot of the road
side={"half":HALF,"step":GSTEP,"ground":ground,"solids":solids,
      "interact":[INTERACT[0],-INTERACT[1]],"reach":3.6,"stand":[STAND[0],-STAND[1]],"terrainSurface":True}
_p=os.environ.get("LM_SIDECAR_OUT") or ROOT+"/src/world/landmark-grounds/yoshino-yama.json"
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
    objname=key if key.startswith("glow_") else "yoshino_"+key
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
