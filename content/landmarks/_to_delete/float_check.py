# temp: down-facing model faces that sat on the sidecar surface and now float over the padded terrain
import bpy, sys, os, glob, json, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out=[]
for side in sorted(glob.glob(os.path.join(D,"..","..","src","world","landmark-grounds","*.json"))):
    g=json.load(open(side)); name=os.path.basename(side)[:-5]
    if not g.get("terrainSurface"): continue
    gh,gs,gg=g["half"],g["step"],g.get("terrain") or g["ground"]; n=len(gg)
    def grid(dx,dz):
        fx=min(n-1,max(0.0,(dx+gh)/gs)); fz=min(n-1,max(0.0,(dz+gh)/gs))
        x0=min(n-2,int(fx)); z0=min(n-2,int(fz)); tx=fx-x0; tz=fz-z0
        return gg[z0][x0]*(1-tx)*(1-tz)+gg[z0][x0+1]*tx*(1-tz)+gg[z0+1][x0]*(1-tx)*tz+gg[z0+1][x0+1]*tx*tz
    def corner(x,z): return grid(x,z)-0.04 if max(abs(x),abs(z))<gh else 0.0
    def terr(x,y):
        z=-y; x0=math.floor(x); z0=math.floor(z); tx=x-x0; tz=z-z0
        a,b,c,d=corner(x0,z0),corner(x0+1,z0),corner(x0+1,z0+1),corner(x0,z0+1)
        return (a+(c-b)*tz+(b-a)*tx) if tx>=tz else (a+(c-d)*tx+(d-a)*tz)
    bpy.ops.wm.open_mainfile(filepath=os.path.join(D,name+".blend"))
    cnt={}
    for o in bpy.data.objects:
        if o.type!="MESH": continue
        M=o.matrix_world
        for p in o.data.polygons:
            nn=(M.to_3x3()@p.normal).normalized()
            if nn.z>-0.9: continue
            c=M@p.center; t=terr(c.x,c.y)
            if 0.0<c.z-t<=0.045 and p.area>0.003:
                k=o.name; cnt[k]=cnt.get(k,0)+1
    if cnt: out.append(f"{name}: "+", ".join(f"{k}={v}" for k,v in sorted(cnt.items())))
print("FLOAT\n"+"\n".join(out))
