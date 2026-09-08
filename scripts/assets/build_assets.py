"""Rebuild the web GLBs with Blender 4.5 LTS. No third-party Python packages.
Run: blender --background --factory-startup --python scripts/assets/build_assets.py
Downloaded sources are never modified. Adapted editable scenes go to assets/source/atsea-adapted.
Coordinate contract after GLB export: +X forward, +Y up, +Z toward the viewer.
"""
import bpy, bmesh, math, json, pathlib, random, sys
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'public/models'; EDIT=ROOT/'assets/source/atsea-adapted'
OUT.mkdir(parents=True,exist_ok=True); EDIT.mkdir(parents=True,exist_ok=True)
OLD=ROOT/'assets/source/quaternius-animated-fish/Animated Fish Pack by @Quaternius/Blends'
CUTE=ROOT/'assets/source/quaternius-cute-fish'
manifest=[]
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
ONLY=set(args[1:]) if args and args[0]=='--only' else set()

def linear(v): return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def rgba(c):
 c=c.lstrip('#'); return tuple(linear(int(c[i:i+2],16)/255) for i in (0,2,4))+(1,)
def mat(name,color,metal=.05,rough=.48,emit=0):
 m=bpy.data.materials.new(name); m.diffuse_color=rgba(color); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=rgba(color); p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
 if emit: p.inputs['Emission Color'].default_value=rgba(color); p.inputs['Emission Strength'].default_value=emit
 return m
def recolor(m,color,metal=.08,emit=0):
 m.use_nodes=True; p=m.node_tree.nodes.get('Principled BSDF')
 if p:
  for link in list(p.inputs['Base Color'].links): m.node_tree.links.remove(link)
  p.inputs['Base Color'].default_value=rgba(color); p.inputs['Roughness'].default_value=.48; p.inputs['Metallic'].default_value=metal
  p.inputs['Emission Strength'].default_value=emit
  p.inputs['Emission Color'].default_value=rgba(color)
 m.diffuse_color=rgba(color)
def reset():
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.context.scene.render.fps=24
 bpy.context.scene.frame_start=0; bpy.context.scene.frame_end=48
 random.seed(2308)
def uv(name,loc,scale,material,segments=20,rings=12):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc)
 o=bpy.context.object; o.name=name; o.scale=scale
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(material)
 for p in o.data.polygons:p.use_smooth=True
 return o
def tube(name,points,radii,material,sides=8):
 pts=[Vector(p) for p in points]; vertices=[]; faces=[]
 for i,p in enumerate(pts):
  tangent=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
  normal=tangent.cross(Vector((0,1,0)))
  if normal.length<.01:normal=tangent.cross(Vector((1,0,0)))
  normal.normalize(); other=tangent.cross(normal).normalized()
  r=radii[i] if isinstance(radii,list) else radii
  for j in range(sides): vertices.append(p+r*(normal*math.cos(j*math.tau/sides)+other*math.sin(j*math.tau/sides)))
 for i in range(len(pts)-1):
  for j in range(sides):a=i*sides+j; b=i*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
 faces.append(tuple(range(sides-1,-1,-1)));faces.append(tuple((len(pts)-1)*sides+j for j in range(sides)))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);mesh.materials.append(material)
 for p in mesh.polygons:p.use_smooth=True
 return o
def fin(name,points,material,thickness=.015):
 verts=[(x,y-thickness/2,z) for x,y,z in points]+[(x,y+thickness/2,z) for x,y,z in points]
 n=len(points);faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);mesh.materials.append(material)
 bevel=o.modifiers.new('Soft fin edge','BEVEL');bevel.width=.012;bevel.segments=2
 bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=bevel.name)
 return o
def eyes(x,z,y,r=.055):
 ink=mat('Eyes - midnight','#081b23',.15,.2); iris=mat('Iris - silver','#d0e4d1',.1,.3)
 for sign in [-1,1]:
  uv('Iris',(x,sign*y,z),(r,r*.45,r),iris,12,8)
  uv('Eye',(x+.007,sign*(y+r*.32),z),(r*.64,r*.25,r*.64),ink,12,8)
def combine(name):
 bpy.ops.object.select_all(action='DESELECT');objs=[o for o in bpy.context.scene.objects if o.type=='MESH']
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 return o
def animate_shape(o,kind):
 o.shape_key_add(name='Basis');key=o.shape_key_add(name='Swim deformation')
 for v in key.data:
  x,y,z=v.co
  if kind=='jelly':
   if z<.3:v.co.x+=.12*math.sin(z*4+y*5)*min(1,.3-z);v.co.y+=.06*math.sin(z*3+x*4)*min(1,.3-z)
   else:v.co.x*=1.08;v.co.y*=1.08;v.co.z=.3+(z-.3)*.89
  elif kind=='octopus':
   if z<.15:v.co.z+=.13*math.sin(x*5+y*5)*min(1,abs(x)+abs(y));v.co.y+=.07*math.sin(x*4)
  elif kind=='squid':
   if x<-.4:v.co.z+=.14*math.sin(x*6+y*3)*min(1,-x-.4)
  elif kind=='seahorse':v.co.y+=.065*math.sin(z*4)*(1-min(1,abs(z-.4)))
  elif kind=='seaweed':v.co.x+=.15*max(0,z)*math.sin(z*2.3+y*3)
 for frame,value in [(0,0),(12,1),(24,0),(36,-1),(48,0)]:
  key.value=value;key.keyframe_insert('value',frame=frame)
 if o.data.shape_keys.animation_data and o.data.shape_keys.animation_data.action:o.data.shape_keys.animation_data.action.name='Swim'
 bpy.context.scene.frame_set(0)

def save(key,source,animated=True):
 if ONLY and key not in ONLY:return
 bpy.context.preferences.filepaths.save_version=0
 sc=bpy.context.scene;sc.frame_set(0)
 # Preserve exactly the editable model scene, without render-only cameras or lights.
 bpy.ops.wm.save_as_mainfile(filepath=str(EDIT/(key+'.blend')))
 bpy.ops.export_scene.gltf(filepath=str(OUT/(key+'.glb')),export_format='GLB',export_yup=True,export_animations=animated,export_animation_mode='ACTIVE_ACTIONS',export_nla_strips_merged_animation_name='Swim',export_frame_range=True,export_force_sampling=True,export_optimize_animation_size=True,export_extras=True,export_cameras=False,export_lights=False)
 meshes=[o for o in sc.objects if o.type=='MESH' and o.visible_get()]
 verts=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
 lo=[min(v[i] for v in verts) for i in range(3)];hi=[max(v[i] for v in verts) for i in range(3)]
 # glTF's dimensions are Blender X, Z, Y.
 manifest.append({'key':key,'path':f'models/{key}.glb','source':source,'editable':f'assets/source/atsea-adapted/{key}.blend','up':'+Y','forward':'+X','bytes':(OUT/(key+'.glb')).stat().st_size,'dimensions':[round(hi[i]-lo[i],4) for i in (0,2,1)],'vertices':sum(len(o.data.vertices) for o in meshes),'animation':'Swim' if animated else None})
 print('EXPORTED',key,manifest[-1]['bytes'],flush=True)

def smooth_source(o):
 # FBX-derived GLBs split every polygon into separate vertices. Weld coincident
 # vertices while retaining deform weights, then discard the imported flat normals.
 bm=bmesh.new();bm.from_mesh(o.data)
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
 bm.to_mesh(o.data);bm.free();o.data.update()
 for p in o.data.polygons:p.use_smooth=True
 if o.data.has_custom_normals:o.data.normals_split_custom_set([(0,0,0)]*len(o.data.loops))

def shrink_eyes(o,factor=.56):
 mesh=o.data
 eyeids=set(v for p in mesh.polygons if 'eye' in mesh.materials[p.material_index].name.lower() for v in p.vertices)
 if not eyeids:return
 adjacency=[set() for v in mesh.vertices]
 for e in mesh.edges:
  a,b=e.vertices;adjacency[a].add(b);adjacency[b].add(a)
 left=set(range(len(mesh.vertices)))
 while left:
  start=left.pop();ids={start};queue=[start]
  while queue:
   for n in adjacency[queue.pop()]:
    if n in left:left.remove(n);ids.add(n);queue.append(n)
  if not ids.intersection(eyeids):continue
  # The separate iris, dark rim and pupil form one island after welding.
  center=sum((mesh.vertices[i].co for i in ids),Vector())/len(ids)
  for i in ids:mesh.vertices[i].co=center+(mesh.vertices[i].co-center)*factor

def add_source_details(key,arm):
 body=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
 points=[body.matrix_world@v.co for v in body.data.vertices]
 lo=Vector(tuple(min(v[i] for v in points) for i in range(3)));hi=Vector(tuple(max(v[i] for v in points) for i in range(3)));span=hi-lo
 eye=mat('Natural dark eyes','#0d2531',.12,.22)
 glow=mat('Lantern photophores','#82dede',.05,.35,1.5) if key=='lantern' else None
 added=[]
 for sign in [-1,1]:
  for index in range(7 if key=='lantern' else 1):
   yy=lo.y+span.y*(.12 if index==0 else .22+index*.073)
   zz=lo.z+span.z*((.45 if key in ('shark','megalodon') else .60) if index==0 else .36)
   origin=Vector((sign*(max(abs(lo.x),abs(hi.x))+10),yy,zz))
   inv=body.matrix_world.inverted();direction=Vector((-sign,0,0))
   hit,loc,normal,_=body.ray_cast(inv@origin,(inv.to_3x3()@direction).normalized())
   if not hit:continue
   pos=body.matrix_world@loc;pos.x+=sign*.025
   radius=span.y*(.011 if index==0 else .007)
   part=uv('Eye' if index==0 else 'Photophore',pos,(radius*.38,radius,radius),eye if index==0 else glow,12,8)
   bpy.context.view_layer.objects.active=part;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
   bone=min(arm.data.bones,key=lambda b:abs((arm.matrix_world@b.head_local).y-yy))
   if index==0 and 'Face' in arm.data.bones:bone=arm.data.bones['Face']
   group=part.vertex_groups.new(name=bone.name);group.add(list(range(len(part.data.vertices))),1,'REPLACE')
   modifier=part.modifiers.new('Swim with source rig','ARMATURE');modifier.object=arm
   added.append(part)
 if added:
  bpy.ops.object.select_all(action='DESELECT')
  for o in added:o.select_set(True)
  bpy.context.view_layer.objects.active=added[0];bpy.ops.object.join()


def source_fish(key,file,colors,cute=False,stretch=(1,1,1)):
 if ONLY and key not in ONLY:return
 reset();path=(CUTE/file) if cute else (OLD/file)
 if cute:bpy.ops.import_scene.gltf(filepath=str(path))
 else:bpy.ops.wm.open_mainfile(filepath=str(path))
 sc=bpy.context.scene;sc.render.fps=24
 for o in list(sc.objects):
  if o.type in ('CAMERA','LIGHT') or (o.type=='MESH' and not o.data.materials):bpy.data.objects.remove(o,do_unlink=True)
 arm=next(o for o in sc.objects if o.type=='ARMATURE')
 selected=next((a for a in bpy.data.actions if a.name.endswith('Swimming_Normal')),None) if cute else list(bpy.data.actions)[0]
 for o in sc.objects:
  if o.animation_data:
   for t in list(o.animation_data.nla_tracks):o.animation_data.nla_tracks.remove(t)
   o.animation_data.action=None
 if selected:
  arm.animation_data_create();arm.animation_data.action=selected
  if selected.slots:arm.animation_data.action_slot=selected.slots[0]
  selected.name='Swim';sc.frame_start=int(selected.frame_range[0]);sc.frame_end=int(selected.frame_range[1]);sc.frame_set(0)
 for o in sc.objects:
  if o.type!='MESH':continue
  smooth_source(o)
  if cute:shrink_eyes(o)
  for p in o.data.polygons:p.use_smooth=True
  for m in o.data.materials:
   if m.name in colors:recolor(m,colors[m.name],emit=.65 if m.name=='Light' else 0)
   else:
    m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    if p:p.inputs['Roughness'].default_value=.5;p.inputs['Metallic'].default_value=.08
 if not cute and key!='ray':add_source_details(key,arm)
 # Empty normalizes author sources (-Y forward, Z up) without disturbing rigs.
 roots=[o for o in sc.objects if o.parent is None]
 orient=bpy.data.objects.new('AtSea +X forward',None);sc.collection.objects.link(orient)
 for o in roots:o.parent=orient
 orient.rotation_euler.z=math.pi/2
 orient.scale=stretch
 orient['source']=path.relative_to(ROOT).as_posix();orient['author']='Quaternius';orient['license']='CC0-1.0'
 sc.frame_set(0);bpy.context.view_layer.update()
 save(key,path.relative_to(ROOT).as_posix())

# Licensed, rigged base models: material and proportion changes are intentionally modest.
source_fish('fish0','Tetra.glb',{'Tetra_Main':'#397a94','Tetra_Light':'#60efeb','Tetra_Fins':'#88bcca','Eyes':'#102738'},True,(.8,1.18,.68))
source_fish('fish1','Fish1.blend',{'Bottom':'#71c6cf','Top':'#1975b3','Fins':'#f2c36f'},False,(1,1,.98))
source_fish('fish2','BlueTang.glb',{'BlueTang_Main':'#2469d1','BlueTang_Dark':'#12284e','BlueTang_Fins':'#f5d35a','Eyes':'#0a1d34'},True,(.8,1,.96))
source_fish('fish3','ButterflyFish.glb',{'Butterfly_Dark':'#19355c','Butterfly_Light':'#e6c85b','Butterfly_Main':'#d9dfcd','Eyes':'#0c2739'},True,(.75,1,.97))
source_fish('fish4','Puffer.glb',{'Pufferfish_Main':'#b1a967','Pufferfish_Light':'#e6dbb4','Puffefish_Black':'#435648','Eyes':'#172921'},True,(.86,1,.9))
source_fish('fish5','Fish1.blend',{'Bottom':'#cadce0','Top':'#658f98','Fins':'#557787'},False,(.74,1.45,.67))
source_fish('fish6','Fish3.blend',{'Body':'#ed8b40','Stripes':'#f7e9cf','Outline':'#293b44'})
source_fish('ray','Manta ray.blend',{'Top':'#397788','Bottom':'#c0d8d5'})
source_fish('shark','Shark.blend',{'Top':'#688b9b','Bottom':'#d0e2dc'})
source_fish('megalodon','Shark.blend',{'Top':'#476572','Bottom':'#9bb7bb'},False,(1.15,1,.95))
source_fish('angler','Anglerfish.glb',{'Anglerfish_Main':'#735065','Anglerfish_Light':'#ad718d','Anglerfish_Teeth':'#c4c8ba','Anglerfish_Fins':'#68506f','Light':'#80efec','Eyes':'#102532'},True,(.85,1,.9))
source_fish('lantern','Fish1.blend',{'Bottom':'#87cad0','Top':'#285267','Fins':'#6ab7ba'},False,(.7,1.12,.7))
source_fish('dolphin','Dolphin.blend',{'Top':'#8cc7da','Bottom':'#d1e2e5'})
source_fish('whale','Whale.blend',{'Top':'#729ab9','Bottom':'#c0d3db'})

reset()
pink=mat('Jelly bell','#aaafd9',0,.32,.16);pale=mat('Jelly tentacles','#93d2dc',0,.44,.18);inner=mat('Jelly inner crown','#d3a3c3',0,.44,.14)
# A hollow umbrella, with a gently scalloped lower rim.
verts=[];faces=[];rings=12;sides=32
for i in range(rings):
 t=(i/(rings-1))*math.pi/2
 for j in range(sides):
  a=j/sides*math.tau;r=.65*math.sin(t);z=.34+.53*math.cos(t)+.025*math.cos(a*8)*math.sin(t)**8
  verts.append((r*math.cos(a),r*.75*math.sin(a),z))
for i in range(rings-1):
 for j in range(sides):a=i*sides+j;b=i*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
mesh=bpy.data.meshes.new('Jelly bell');mesh.from_pydata(verts,[],faces);mesh.materials.append(pink);o=bpy.data.objects.new('Jelly bell',mesh);bpy.context.collection.objects.link(o)
for p in mesh.polygons:p.use_smooth=True
for j in range(10):
 a=j/10*math.tau
 points=[(.48*math.cos(a)+.07*math.sin(k*.6+a),.34*math.sin(a)+.05*math.cos(k*.5),.35-k*.077) for k in range(21)]
 tube('Trailing tentacle',points,[.018*(1-k/25) for k in range(21)],pale,6)
for j in range(4):
 a=j/4*math.tau;tube('Oral arm',[(.19*math.cos(a)+.05*math.sin(k),.12*math.sin(a),.4-k*.09) for k in range(11)],[.065*(1-k/13) for k in range(11)],inner)
o=combine('Moon jelly');animate_shape(o,'jelly');save('jelly','At Sea original Blender geometry')

reset();orange=mat('Seahorse ochre','#dfb563');ridge=mat('Seahorse ridge','#c18b45');finmat=mat('Seahorse fin','#e9d091')
points=[(-.1+.23*math.cos(t),0,-.65+.2*math.sin(t)) for t in [i*.27 for i in range(22)]]
points += [(-.2,0,-.38),(-.26,0,-.12),(-.24,0,.13),(-.36,0,.4),(-.37,0,.68),(-.2,0,.9),(.07,0,.89),(.21,0,.72)]
radii=[.019+i*.0018 for i in range(22)]+[.08,.13,.2,.17,.14,.17,.15,.11]
tube('Curled seahorse',points,radii,orange,12)
tube('Long snout',[(.15,0,.77),(.31,0,.64),(.53,0,.59)],[.1,.07,.054],orange,12)
uv('Chest',(-.14,0,.09),(.24,.15,.36),orange)
fin('Dorsal fin',[(-.37,0,.35),(-.69,0,.21),(-.38,0,-.13)],finmat)
for k in range(9):uv('Bony ridge',(-.4+.09*math.sin(k*.55),0,.69-k*.105),(.05,.055,.055),ridge,8,6)
for k in range(4):uv('Coronet',(-.23+k*.07,0,1.02+(.07 if k==1 else 0)),(.035,.043,.08),ridge,8,6)
eyes(.095,.84,.133,.038)
o=combine('Seahorse');animate_shape(o,'seahorse');save('seahorse','At Sea original Blender geometry')

reset();rose=mat('Squid mantle','#b9859f');light=mat('Squid underside','#dcc4c8');finmat=mat('Squid fin','#bd91af')
uv('Mantle',(.42,0,.1),(.83,.23,.27),rose)
uv('Head',(-.35,0,.055),(.25,.25,.22),light)
for sign in [-1,1]:
 fin('Mantle fin',[(1.11,0,.1),(.35,sign*.58,.04),(.01,0,.1)],finmat,.025)
 for j in range(4):
  points=[(-.49-k*.075,sign*(.035+j*.041)+math.sin(k*.45+j)*.025,.09-j*.045+math.sin(k*.3+j)*.04) for k in range(16)]
  tube('Squid arm',points,[.037*(1-k/18) for k in range(16)],light,6)
 for j in [0]:
  points=[(-.45-k*.092,sign*.12+math.sin(k*.38)*.055,-.1+math.sin(k*.25)*.06) for k in range(22)]
  tube('Long feeding tentacle',points,[.015]*19+[.035,.025,.008],rose,6)
eyes(-.37,.1,.25,.072)
o=combine('Squid');animate_shape(o,'squid');save('squid','At Sea original Blender geometry')

reset();rust=mat('Octopus mantle','#c17d70');tips=mat('Octopus arms','#bf887c');suck=mat('Octopus suckers','#deb5a0')
uv('Octopus mantle',(-.09,0,.46),(.42,.32,.5),rust);uv('Octopus head',(.06,0,.18),(.35,.32,.25),rust)
for j in range(8):
 a=j/8*math.tau;pts=[]
 for k in range(19):
  t=k/18;r=.2+t*.98;angle=a+t*t*.95;pts.append((math.cos(angle)*r,math.sin(angle)*r*.55,.14-.2*math.sin(t*math.pi)+.04*math.sin(t*6+j)))
 tube('Octopus arm',pts,[.094*(1-k/21)**1.2 for k in range(19)],tips,8)
 for k in range(4,16,3):
  x,y,z=pts[k];uv('Sucker',(x,y,z-.026),(.035,.027,.015),suck,8,4)
eyes(.28,.29,.24,.057)
o=combine('Octopus');animate_shape(o,'octopus');save('octopus','At Sea original Blender geometry')

reset();hull=mat('Submarine golden hull','#d6ae58',.42,.35);trim=mat('Submarine rim','#71878b',.65,.34);glass=mat('Submarine glass','#4fbdcc',.32,.18,.16);dark=mat('Submarine seals','#294852',.42,.4)
uv('Pressure hull',(0,0,0),(1.16,.37,.43),hull,32,16)
uv('Observation nose',(.95,0,.015),(.37,.32,.33),glass,24,12)
for x in [-.37,.12,.56]:
 for side in [-1,1]:
  uv('Porthole rim',(x,side*.352,.045),(.153,.046,.153),trim,20,10)
  uv('Porthole',(x,side*.387,.045),(.116,.022,.116),glass,20,10)
uv('Conning tower',(-.2,0,.45),(.32,.22,.27),hull)
tube('Periscope',[(-.22,0,.62),(-.22,0,.94),(.02,0,.94)],[.055,.055,.055],trim)
for sign in [-1,1]:
 fin('Diving plane',[(-.83,0,.02),(-.6,sign*.63,.01),(-1.06,sign*.56,.01)],hull,.045)
fin('Tail plane',[(-.97,0,-.12),(-1.4,0,-.43),(-1.35,0,.46),(-1.0,0,.19)],hull,.04)
tube('Propeller axle',[(-1.05,0,0),(-1.5,0,0)],[.045,.045],dark)
for j in range(4):
 a=j*math.pi/2;uv('Propeller blade',(-1.44,math.cos(a)*.15,math.sin(a)*.15),(.038,.16 if j%2==0 else .05,.05 if j%2==0 else .16),trim,12,8)
combine('Survey submarine');save('sub','At Sea original Blender geometry',False)

reset();coralmat=mat('Coral rose','#be7c83');coraltip=mat('Coral tips','#e6a394')
for j in range(7):
 a=j*2.4;dx=math.cos(a)*.37;dy=math.sin(a)*.28;height=.64+(j%3)*.22
 pts=[(dx*t,dy*t,height*t) for t in [i/8 for i in range(9)]]
 tube('Coral main branch',pts,[.072*(1-i/12) for i in range(9)],coralmat,7)
 for k in [3,5,7]:
  base=Vector(pts[k]);offset=Vector((math.cos(a+k)*.24,math.sin(a+k)*.15,.2))
  tube('Coral side twig',[base+offset*t for t in [0,.3,.6,1]],[.039,.03,.024,.013],coralmat,7)
  uv('Coral tip',base+offset,(.023,.023,.033),coraltip,8,6)
combine('Branching coral');save('coral','At Sea original Blender geometry',False)

reset();red=mat('Starfish ochre','#dba475');spots=mat('Starfish details','#bd835b')
uv('Starfish center',(0,0,.03),(.24,.24,.09),red,16,8)
for j in range(5):
 a=j/5*math.tau+math.pi/2;pts=[]
 for k in range(7):
  r=.13+k*.072;pts.append((r*math.cos(a),r*math.sin(a),.035+.025*math.sin(k*.45)))
 tube('Starfish arm',pts,[.115,.095,.08,.06,.04,.025,.005],red,8)
 for k in [1,3,5]:
  x,y,z=pts[k];uv('Starfish granule',(x,y,z+.06*(1-k/7)),(.022,.022,.017),spots,8,4)
combine('Starfish');save('starfish','At Sea original Blender geometry',False)

reset();green=mat('Kelp jade','#438776');light=mat('Kelp tips','#73ac87')
for j in range(7):
 height=.7+(j%4)*.22;x=(j-3)*.08;y=math.sin(j*2)*.14
 pts=[(x+.06*math.sin(i*.5+j),y,height*i/10) for i in range(11)]
 tube('Kelp stipe',pts,.012,green,5)
 for k in range(2,10,2):
  px,py,pz=pts[k];sgn=1 if k%4==0 else -1
  fin('Kelp blade',[(px,py,pz),(px+sgn*.19,py+.02,pz+.10),(px+sgn*.28,py+.03,pz+.32),(px+sgn*.065,py,pz+.18)],light if j%2 else green,.012)
o=combine('Kelp cluster');animate_shape(o,'seaweed');save('seaweed','At Sea original Blender geometry')

reset();rockmat=mat('Reef stone','#627e80',0,.94)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1);o=bpy.context.object;o.name='Reef rock'
for v in o.data.vertices:
 r=random.uniform(.86,1.13);v.co.x*=r*1.05;v.co.y*=r*.68;v.co.z*=r*.54
 if v.co.z<-.25:v.co.z=-.25+(v.co.z+.25)*.22
for p in o.data.polygons:p.use_smooth=True
o.data.materials.append(rockmat);save('rock','At Sea original Blender geometry',False)

sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from new_species import build_new_species
build_new_species(reset,mat,uv,tube,fin,eyes,combine,save,ONLY)
if ONLY:
 previous=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
 manifest=[entry for entry in previous if entry['key'] not in ONLY]+manifest
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print('COMPLETE',len(manifest),'models',sum(m['bytes'] for m in manifest),'bytes',flush=True)
