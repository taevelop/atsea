"""Original low-poly sea creatures, with editable rigs and a single Swim clip."""
import math
import bpy
from mathutils import Vector


def build_new_species(reset, mat, uv, tube, fin, eyes, combine, save, only):
    def wanted(key):
        return not only or key in only

    def rig(parts, joints, motion, duration=48):
        # Parts retain material slots and rigid bone weights after joining into one mesh.
        all_meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
        for obj in all_meshes:
            name = parts.get(obj.name, 'Root')
            obj.vertex_groups.new(name=name).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
        mesh = combine('Animated body')
        armature = bpy.data.armatures.new('Swimming skeleton')
        arm = bpy.data.objects.new('Swim rig', armature)
        bpy.context.collection.objects.link(arm)
        bpy.context.view_layer.objects.active = arm
        arm.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        root = armature.edit_bones.new('Root')
        root.head = (0, 0, 0)
        root.tail = (0, 0, .2)
        for name, (head, tail) in joints.items():
            bone = armature.edit_bones.new(name)
            bone.head, bone.tail = head, tail
            bone.parent = root
        bpy.ops.object.mode_set(mode='OBJECT')
        modifier = mesh.modifiers.new('Swim deformation', 'ARMATURE')
        modifier.object = arm
        mesh.parent = arm
        for name, (axis, amplitude, phase) in motion.items():
            bone = arm.pose.bones[name]
            bone.rotation_mode = 'XYZ'
            for frame in range(0, duration + 1, 4):
                bone.rotation_euler[axis] = amplitude * math.sin(frame / duration * math.tau + phase)
                bone.keyframe_insert(data_path='rotation_euler', frame=frame)
        arm.animation_data.action.name = 'Swim'
        bpy.context.scene.frame_start = 0
        bpy.context.scene.frame_end = duration
        bpy.context.scene.frame_set(0)

    if wanted('turtle'):
        reset()
        shell = mat('Turtle shell', '#678c65')
        seams = mat('Turtle shell seams', '#3c6656')
        skin = mat('Turtle skin', '#a7b98b')
        belly = mat('Turtle underside', '#d6ce9e')
        uv('Carapace', (0, 0, .13), (.82, .58, .32), shell, 24, 12)
        uv('Plastron', (0, 0, -.025), (.79, .55, .09), belly, 24, 8)
        # Curves follow the domed surface and remain visible from a tilted side view.
        for x in [-.42, 0, .42]:
            points = []
            for j in range(15):
                y = -.50 + j / 14
                z = .13 + .325 * math.sqrt(max(.015, 1 - (x / .84) ** 2 - (y / .60) ** 2))
                points.append((x + .025 * math.cos(j * .8), y, z))
            tube('Shell scute seam', points, .009, seams, 5)
        for y in [-.23, .23]:
            points = [(x, y, .13 + .328 * math.sqrt(max(.015, 1 - (x / .84) ** 2 - (y / .60) ** 2))) for x in [j * .09 - .63 for j in range(15)]]
            tube('Shell length seam', points, .009, seams, 5)
        uv('Neck', (.77, 0, .10), (.25, .19, .13), skin)
        uv('Head', (1.04, 0, .13), (.26, .22, .17), skin)
        eyes(1.14, .19, .196, .037)
        tube('Beak line', [(1.22, -.16, .075), (1.285, 0, .07), (1.22, .16, .075)], .008, seams, 5)
        tube('Tail', [(-.72, 0, .02), (-.96, 0, -.04)], [.09, .008], skin, 8)
        parts, joints, motion = {}, {}, {}
        for sign in [-1, 1]:
            for front in [True, False]:
                name = ('Front' if front else 'Rear') + str(sign)
                x = .48 if front else -.53
                shape = uv(name, (x - .12, sign * .76, -.09), (.22 if front else .16, .53 if front else .31, .065), skin, 16, 8)
                shape.rotation_euler.z = sign * (.36 if front else -.4)
                parts[shape.name] = name
                joints[name] = ((x, sign * .38, .03), (x, sign * .9, -.04))
                motion[name] = (0, sign * (.43 if front else .28), 0 if front else math.pi)
        rig(parts, joints, motion, 64)
        save('turtle', 'At Sea original Blender geometry')

    if wanted('crab'):
        reset()
        shell = mat('Crab shell', '#d78663')
        legs = mat('Crab legs', '#e6a17a')
        dark = mat('Crab eye stalks', '#965849')
        eye = mat('Eyes', '#10232c')
        uv('Carapace', (0, 0, .12), (.58, .34, .23), shell, 20, 10)
        for sign in [-1, 1]:
            tube('Eye stalk', [(sign * .19, -.24, .28), (sign * .22, -.34, .48)], [.035, .025], dark, 8)
            uv('Eye', (sign * .22, -.35, .49), (.055, .047, .057), eye, 12, 8)
        parts, joints, motion = {}, {}, {}
        for sign in [-1, 1]:
            for j in range(4):
                name = f'Leg{sign}_{j}'
                y = -.17 + j * .14
                pts = [(sign * .43, y, .08), (sign * (.82 + j * .035), y + .04, .015), (sign * (.96 + j * .02), y - .06, -.24)]
                part = tube(name, pts, [.065, .046, .017], legs, 8)
                parts[part.name] = name
                if j == 3:
                    paddle = uv('Swimming paddle', pts[-1], (.19, .11, .032), legs, 14, 8)
                    parts[paddle.name] = name
                joints[name] = (pts[0], pts[1])
                motion[name] = (0, .40 if j == 3 else .24, j * .8 + (math.pi if sign == -1 else 0))
            name = f'Claw{sign}'
            arm = tube(name, [(sign * .43, -.15, .15), (sign * .73, -.43, .29), (sign * .78, -.51, .57)], [.08, .072, .06], shell, 10)
            palm = uv('Claw palm', (sign * .78, -.51, .63), (.16, .12, .17), shell, 14, 8)
            parts[arm.name] = parts[palm.name] = name
            for offset in [-1, 1]:
                finger = tube('Pincer', [(sign * .78 + offset * .10, -.51, .70), (sign * .78 + offset * .14, -.51, .85), (sign * .78 + offset * .06, -.51, .93)], [.06, .043, .008], legs, 8)
                parts[finger.name] = name
            joints[name] = ((sign * .43, -.15, .15), (sign * .73, -.43, .29))
            motion[name] = (0, .10, sign * .6)
        rig(parts, joints, motion, 40)
        save('crab', 'At Sea original Blender geometry')

    if wanted('shrimp'):
        reset()
        shell = mat('Shrimp shell', '#dfa6a3')
        legs = mat('Shrimp legs', '#f0c5b9')
        trim = mat('Shrimp segment edges', '#af7783')
        parts, joints, motion = {}, {}, {}
        centers = [(-.65, 0, -.20), (-.79, 0, .01), (-.75, 0, .26), (-.54, 0, .42), (-.23, 0, .47), (.10, 0, .46)]
        for i, pos in enumerate(centers):
            uv('Abdomen segment', pos, (.20 if i < 3 else .25, .17 + i * .007, .20), shell, 16, 8)
            if i >= 3:
                x, _, z = pos
                tube('Segment rim', [(x - .16, math.sin(t) * .20, z + math.cos(t) * .205) for t in [j * math.pi / 10 - math.pi / 2 for j in range(11)]], .009, trim, 5)
        uv('Head shield', (.43, 0, .40), (.42, .235, .26), shell, 20, 10)
        tube('Rostrum', [(.64, 0, .49), (1.07, 0, .57)], [.07, .006], shell, 8)
        eyes(.70, .47, .21, .055)
        for sign in [-1, 1]:
            name = f'Antenna{sign}'
            pts = [(.68, sign * .13, .46), (.99, sign * .20, .67), (1.43, sign * .25, .76), (1.80, sign * .34, .94)]
            part = tube('Long antenna', pts, [.012, .009, .006, .002], legs, 5)
            parts[part.name] = name
            joints[name] = (pts[0], pts[1])
            motion[name] = (0, .09, sign)
            for i in range(5):
                name = f'Swimmeret{sign}_{i}'
                x = .51 - i * .17
                pts = [(x, sign * .13, .22), (x - .07, sign * .23, -.01), (x - .17, sign * .27, -.18)]
                leg = tube(name, pts, [.025, .016, .008], legs, 6)
                paddle = uv('Swimmeret tip', pts[-1], (.065, .018, .04), legs, 8, 6)
                parts[leg.name] = parts[paddle.name] = name
                joints[name] = (pts[0], (x, sign * .4, .22))
                motion[name] = (0, .5, i * .8)
        for sign in [-1, 0, 1]:
            part = uv('Tail fan', (-.87, sign * .16, -.40), (.25, .13, .045), shell, 12, 6)
            part.rotation_euler.z = sign * .42
            parts[part.name] = 'Tail'
        joints['Tail'] = ((-.65, 0, -.20), (-.88, 0, -.4))
        motion['Tail'] = (0, .12, 0)
        rig(parts, joints, motion, 32)
        save('shrimp', 'At Sea original Blender geometry')

    if wanted('oarfish'):
        reset()
        silver = mat('Oarfish silver', '#cdd9e3', .36, .34)
        red = mat('Oarfish red fins', '#d76178', .12, .5)
        spots = mat('Oarfish markings', '#758a9f', .22, .4)
        # Upright ribbon, broad side facing the camera. The narrow tip hangs downward.
        count, sides = 43, 8
        vertices, faces = [], []
        for i in range(count):
            t = i / (count - 1)
            z = 1.75 - t * 4.8
            x = -.10 + .16 * math.sin(t * math.tau * 1.2) * t
            width = .22 * (1 - t * .9)
            for j in range(sides):
                angle = j / sides * math.tau
                vertices.append((x + width * math.cos(angle), .055 * (1 - t * .8) * math.sin(angle), z))
        for i in range(count - 1):
            for j in range(sides):
                a = i * sides + j
                b = i * sides + (j + 1) % sides
                faces.append((a, b, b + sides, a + sides))
        faces += [tuple(range(sides - 1, -1, -1)), tuple((count - 1) * sides + j for j in range(sides))]
        mesh = bpy.data.meshes.new('Ribbon mesh')
        mesh.from_pydata(vertices, [], faces)
        mesh.materials.append(silver)
        body = bpy.data.objects.new('Silver ribbon', mesh)
        bpy.context.collection.objects.link(body)
        for polygon in mesh.polygons:
            polygon.use_smooth = True
        # A laterally compressed fish head: broad gill cover, sloped forehead and tapered jaws.
        profiles = [(-.33, 1.76, .038, .09), (-.23, 1.84, .085, .22),
                    (-.09, 1.88, .10, .25), (.08, 1.88, .095, .21),
                    (.25, 1.85, .07, .12), (.39, 1.84, .035, .055)]
        head_vertices, head_faces = [], []
        ring_size = 16
        for x, z, thickness, height in profiles:
            for j in range(ring_size):
                angle = j / ring_size * math.tau
                head_vertices.append((x, thickness * math.sin(angle), z + height * math.cos(angle)))
        for i in range(len(profiles) - 1):
            for j in range(ring_size):
                a, b = i * ring_size + j, i * ring_size + (j + 1) % ring_size
                head_faces.append((a, b, b + ring_size, a + ring_size))
        head_faces += [tuple(range(ring_size - 1, -1, -1)),
                       tuple((len(profiles) - 1) * ring_size + j for j in range(ring_size))]
        head_mesh = bpy.data.meshes.new('Tapered fish head')
        head_mesh.from_pydata(head_vertices, [], head_faces)
        head_mesh.materials.append(silver)
        head = bpy.data.objects.new('Fish head with gill covers', head_mesh)
        bpy.context.collection.objects.link(head)
        for polygon in head_mesh.polygons:
            polygon.use_smooth = True
        outline = mat('Oarfish mouth and gill outline', '#344856', .05, .55)
        for sign in [-1, 1]:
            tube('Mouth crease', [(.393, sign * .033, 1.834), (.30, sign * .067, 1.818),
                                 (.19, sign * .083, 1.798)], [.009, .008, .003], outline, 6)
            tube('Gill cover edge', [(-.17, sign * .065, 2.035), (-.115, sign * .101, 1.95),
                                     (-.10, sign * .104, 1.83), (-.15, sign * .075, 1.71)],
                 [.006, .009, .009, .003], outline, 6)
        eyes(.145, 1.955, .091, .049)
        fin_vertices, fin_faces = [], []
        for i in range(43):
            t = i / 42
            z = 1.75 - t * 4.8
            x = -.10 + .16 * math.sin(t * math.tau * 1.2) * t - .22 * (1 - t * .9)
            fin_vertices += [(x, 0, z), (x - .12 * (1 - t * .7), 0, z + .025)]
            if i:
                a = i * 2
                fin_faces.append((a - 2, a - 1, a + 1, a))
            if i % 4 == 1:
                for sign in [-1, 1]:
                    uv('Body fleck', (x + .16 * (1 - t), sign * .058 * (1 - t * .8), z), (.023, .006, .045), spots, 6, 4)
        mesh = bpy.data.meshes.new('Continuous dorsal fin')
        mesh.from_pydata(fin_vertices, [], fin_faces)
        mesh.materials.append(red)
        dorsal = bpy.data.objects.new('Continuous dorsal fin', mesh)
        bpy.context.collection.objects.link(dorsal)
        for j in range(4):
            x = -.13 + j * .075
            tube('Crown ray', [(x, 0, 1.97), (x - .11, 0, 2.28 + j * .025), (x - .21 + j * .06, 0, 2.51 - abs(j - 1) * .09)], [.016, .014, .004], red, 6)
        for sign in [-1, 1]:
            tube('Long pelvic ray', [(.12, sign * .05, 1.62), (.41, sign * .11, 1.16), (.55, sign * .18, .70)], [.016, .01, .002], red, 6)
        obj = combine('Upright oarfish')
        obj.shape_key_add(name='Basis')
        # Four spatially phased shapes keep both body and dorsal edge waving continuously.
        basis = [v.co.copy() for v in obj.data.vertices]
        for index in range(4):
            key = obj.shape_key_add(name=f'Ribbon wave {index}')
            phase = index * math.pi / 2
            for vertex, original in zip(key.data, basis):
                x, y, z = original
                depth = max(0, 1.55 - z)
                vertex.co.x += .10 * min(1, depth / 2) * math.sin(depth * 2.4 + phase)
                vertex.co.y += .055 * min(1, depth) * math.sin(depth * 3 + phase)
                if x < -.2 and z < 1.65:
                    vertex.co.y += .065 * math.sin(depth * 5 + phase)
            for frame in range(0, 97, 4):
                value = max(0, math.cos(frame / 96 * math.tau - phase)) ** 2
                key.value = value
                key.keyframe_insert('value', frame=frame)
        obj.data.shape_keys.animation_data.action.name = 'Swim'
        bpy.context.scene.frame_start = 0
        bpy.context.scene.frame_end = 96
        bpy.context.scene.frame_set(0)
        save('oarfish', 'At Sea original Blender geometry')
