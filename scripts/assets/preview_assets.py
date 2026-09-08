import bpy,pathlib,math
from mathutils import Vector
import sys
root=pathlib.Path.cwd();out=root/'.tools/asset-preview';out.mkdir(exist_ok=True)
keys=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['fish0','fish1','fish2','fish3','fish4','fish5','fish6','ray','shark','angler','jelly','seahorse','squid','octopus','sub','coral','starfish','seaweed','rock','turtle','crab','shrimp','dolphin','whale','oarfish']
for key in keys:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(root/'public/models'/(key+'.glb')))
 for o in list(bpy.context.scene.objects):
  if o.type=='MESH' and not o.data.materials:bpy.data.objects.remove(o,do_unlink=True)
 bpy.context.scene.frame_set(0);bpy.context.view_layer.update()
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
 lo=Vector(tuple(min(v[i] for v in points) for i in range(3)));hi=Vector(tuple(max(v[i] for v in points) for i in range(3)));center=(lo+hi)/2;size=hi-lo;extent=max(size.x,size.z*1.4,size.y*.4)
 bpy.ops.object.camera_add(location=center+Vector((extent*.06,-extent*2,extent*.2)));cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=extent*1.22;bpy.context.scene.camera=cam
 for loc,energy,color in [(center+Vector((extent*.1,-extent,extent*1.5)),1200,(.8,.95,1)),(center+Vector((-extent,extent*.8,extent*.6)),850,(.35,.75,1))]:
  bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=energy*extent*extent/6;light.data.color=color;light.data.shape='DISK';light.data.size=extent;light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
 sc=bpy.context.scene;sc.world=bpy.data.worlds.new('Sea');sc.world.color=(.055,.075,.08);sc.render.engine='CYCLES';sc.cycles.samples=12;sc.render.resolution_x=320;sc.render.resolution_y=240;sc.render.resolution_percentage=100;sc.render.film_transparent=False;sc.view_settings.view_transform='AgX';sc.render.filepath=str(out/(key+'.png'))
 bpy.ops.render.render(write_still=True)
 print('RENDERED',key,flush=True)
