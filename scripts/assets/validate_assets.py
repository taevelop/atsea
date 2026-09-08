"""Validate exported model files by importing them and evaluating real geometry motion."""
import bpy,pathlib,json
ROOT=pathlib.Path(__file__).resolve().parents[2]
models=json.loads((ROOT/'public/models/manifest.json').read_text())
results=[]
for spec in models:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(ROOT/'public'/spec['path']))
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials]
 assert objects,spec['key']+' has no visible mesh'
 def positions(frame):
  bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
  return [tuple(o.matrix_world@v.co) for original in objects for o in [original.evaluated_get(dg)] for v in o.data.vertices]
 a=positions(0);b=positions(12)
 assert len(a)==len(b)
 delta=max(sum((x-y)**2 for x,y in zip(pa,pb))**.5 for pa,pb in zip(a,b))
 if spec['animation']:assert delta>.00001,spec['key']+' animation does not deform geometry'
 assert all(abs(c)<10000 for p in a for c in p),spec['key']+' has invalid scale'
 results.append({'key':spec['key'],'visibleMeshes':len(objects),'evaluatedVertices':len(a),'animationMovement':round(delta,6),'pass':True})
 print('VERIFIED',spec['key'],round(delta,6),flush=True)
(ROOT/'assets/source/validation.json').write_text(json.dumps({'blender':bpy.app.version_string,'models':results},indent=2)+'\n')
print('ALL MODELS PASS',len(results),flush=True)
