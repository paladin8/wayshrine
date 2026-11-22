# Renders <name>-alive.png and <name>-dead.png next to a landmark .blend, from the game's isometric camera.
# Run: Blender -b content/landmarks/<name>.blend --python content/landmarks/preview.py
import bpy, math, os, json
import numpy as np
from mathutils import Vector, Euler
D=os.path.dirname(bpy.data.filepath)
sc=bpy.context.scene
col=bpy.data.collections.new("preview_rig"); sc.collection.children.link(col)
cam_d=bpy.data.cameras.new("PreviewCam"); cam_d.type='ORTHO'; cam_d.ortho_scale=16.0; cam_d.sensor_fit='VERTICAL'
cam_d.clip_start=0.1; cam_d.clip_end=300
cam=bpy.data.objects.new("PreviewCam",cam_d); col.objects.link(cam)
cam.rotation_euler=Euler((math.radians(54.7),0,math.radians(45)),'XYZ')
R=cam.rotation_euler.to_matrix()
fwd=R@Vector((0,0,-1)); up=R@Vector((0,1,0))
VCENTER=float(os.environ.get("FI_VCENTER","1.5"))
cam.location=up*VCENTER - fwd*60
sc.camera=cam
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
