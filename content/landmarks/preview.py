# Renders <name>-alive.png and <name>-dead.png next to a landmark .blend, from the game's isometric camera.
# Run: Blender -b content/landmarks/<name>.blend --python content/landmarks/preview.py
import bpy, math, os, json
import numpy as np
from mathutils import Vector, Euler
D=os.path.dirname(bpy.data.filepath)
sc=bpy.context.scene
col=bpy.data.collections.new("preview_rig"); sc.collection.children.link(col)
cam_d=bpy.data.cameras.new("PreviewCam"); cam_d.type='ORTHO'; cam_d.ortho_scale=float(os.environ.get("FI_ORTHO","16.0"));   # FI_ORTHO for an overview of a large footprint
cam_d.sensor_fit='VERTICAL'
cam_d.clip_start=0.1; cam_d.clip_end=300
cam=bpy.data.objects.new("PreviewCam",cam_d); col.objects.link(cam)
cam.rotation_euler=Euler((math.radians(54.7),0,math.radians(45)),'XYZ')
R=cam.rotation_euler.to_matrix()
fwd=R@Vector((0,0,-1)); up=R@Vector((0,1,0))
VCENTER=float(os.environ.get("FI_VCENTER","1.5"))
cam.location=up*VCENTER - fwd*60
sc.camera=cam
if os.environ.get("FI_GROUND"):
    # stand-in for the game's terrain under terrainSurface models (preview only; the .blend is not saved)
    gm=bpy.data.meshes.new("PreviewGround"); h=float(os.environ.get("FI_HALF","9.6"))+0.2   # FI_HALF for a larger footprint
    name=os.path.splitext(os.path.basename(bpy.data.filepath))[0]
    side=os.path.join(D,"..","..","src","world","landmark-grounds",name+".json")
    gj=json.load(open(side)) if os.path.exists(side) else None
    if gj and gj.get("terrainSurface"):
        # follow the sidecar's surface as the game's terrain does: 1-unit tiles whose corners sample the grid
        # bilinearly (terrain-grid.ts cornerOf) 0.01 below it (SURFACE_PAD), so sunken ground (gorges, moats) and hills show as in game
        gh,gs,gg=gj["half"],gj["step"],gj.get("terrain") or gj["ground"]; n=len(gg)
        def surf(dx,dz):
            fx=min(n-1,max(0.0,(dx+gh)/gs)); fz=min(n-1,max(0.0,(dz+gh)/gs))
            x0=min(n-2,int(fx)); z0=min(n-2,int(fz)); tx=fx-x0; tz=fz-z0
            return gg[z0][x0]*(1-tx)*(1-tz)+gg[z0][x0+1]*tx*(1-tz)+gg[z0+1][x0]*(1-tx)*tz+gg[z0+1][x0+1]*tx*tz
        m=int(math.ceil(gh))+1; k=2*m+1
        gm.from_pydata([(ix-m,-(iz-m),surf(ix-m,iz-m)-0.01 if max(abs(ix-m),abs(iz-m))<gh else 0.0) for iz in range(k) for ix in range(k)],[],
                       [[iz*k+ix,(iz+1)*k+ix,(iz+1)*k+ix+1,iz*k+ix+1] for iz in range(k-1) for ix in range(k-1)])
    else:
        gm.from_pydata([(-h,-h,-0.01),(h,-h,-0.01),(h,h,-0.01),(-h,h,-0.01)],[],[[0,1,2,3]])
    gc={"snow":(0.88,0.91,0.93,1),"mountain":(0.235,0.22,0.22,1),"marsh":(0.138,0.202,0.065,1),"forest":(0.031,0.087,0.055,1),"volcanic":(0.102,0.053,0.053,1)}.get(os.environ["FI_GROUND"],(0.195,0.42,0.15,1))   # FI_GROUND=snow|mountain|marsh|forest|volcanic for those regions (base tone of each biome palette, linear)
    mat=bpy.data.materials.new("PreviewGrass"); mat.diffuse_color=gc
    p=[n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'][0]; p.inputs["Base Color"].default_value=gc; p.inputs["Roughness"].default_value=1.0
    gm.materials.append(mat); g=bpy.data.objects.new("PreviewGround",gm); col.objects.link(g)
if os.environ.get("FI_WATER"):
    # stand-in for the water region's sea round a model that ends in open water (preview only)
    wz=float(os.environ["FI_WATER"]); h=40.0
    wm=bpy.data.meshes.new("PreviewWater")
    wm.from_pydata([(-h,-h,wz),(h,-h,wz),(h,h,wz),(-h,h,wz)],[],[[0,1,2,3]])
    mat=bpy.data.materials.new("PreviewWater"); c=(0.022,0.09,0.19,1) if wz<-0.7 else (0.05,0.44,0.51,1); mat.diffuse_color=c   # the open sea (-0.75) is darker than a water region (-0.6)
    p=[n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'][0]; p.inputs["Base Color"].default_value=c; p.inputs["Roughness"].default_value=1.0
    wm.materials.append(mat); w=bpy.data.objects.new("PreviewWater",wm); col.objects.link(w)
sun_d=bpy.data.lights.new("PreviewSun",'SUN'); sun_d.energy=float(os.environ.get("FI_SUN","2.2")); sun_d.angle=math.radians(3)
sun=bpy.data.objects.new("PreviewSun",sun_d); col.objects.link(sun)
ldir=Vector((0.35,0.55,-0.76)).normalized()
sun.rotation_euler=ldir.to_track_quat('-Z','Y').to_euler()
w=bpy.data.worlds.new("PreviewWorld"); sc.world=w
try:
    w.use_nodes=True
except Exception: pass
bg=[n for n in w.node_tree.nodes if n.type=='BACKGROUND'][0]
bg.inputs[0].default_value=(0.62,0.72,0.78,1); bg.inputs[1].default_value=float(os.environ.get("FI_AMB","0.9"))
for eng in ('BLENDER_EEVEE','BLENDER_EEVEE_NEXT','BLENDER_WORKBENCH'):
    try:
        sc.render.engine=eng; break
    except Exception: pass
sc.view_settings.view_transform='Standard'
sc.render.resolution_x=1600; sc.render.resolution_y=900; sc.render.resolution_percentage=100
sc.render.film_transparent=False
sc.render.image_settings.file_format='PNG'
STEM=os.path.splitext(os.path.basename(bpy.data.filepath))[0]
alive=os.path.join(D,STEM+"-alive.png"); dead=os.path.join(D,STEM+"-dead.png")
sc.render.filepath=alive
bpy.ops.render.render(write_still=True)
img=bpy.data.images.load(alive)
px=np.empty(len(img.pixels),dtype=np.float32); img.pixels.foreach_get(px)
px=px.reshape(-1,4)
lum=(0.2126*px[:,0]+0.7152*px[:,1]+0.0722*px[:,2])[:,None]
px[:,:3]=np.clip((lum+0.12*(px[:,:3]-lum))*0.62,0,1)
img.pixels.foreach_set(px.ravel())
img.filepath_raw=dead; img.file_format='PNG'; img.save()
json.dump({"engine":sc.render.engine,"alive":alive,"dead":dead},open("/tmp/lm_prev.json","w"))
