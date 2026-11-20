"""
Arm a prepared ship (public/models/<kind>.glb) with a deck gun the game can lay and fire.

The gun is named the way src/render/ships.ts expects: an empty `cannon` (the pivot that turns about the
vertical), its child `barrel` (recoils), and an empty `muzzle` at the barrel's mouth.

    --x       where along the hull (hull lengths, bow towards +x)
    --deck    deck height there (hull lengths); measure it by casting a ray from below the sails
    --scale   size against the Ship of the Line's gun (smaller hulls get a relatively larger gun)
    --turret  an ironclad's armoured turret instead of a swivel gun on a carriage

Run with Blender's Python after tools/prepare_ship.py (and before tools/grade_fleet.py). It removes its own
earlier additions first, so it can be run again:

    python tools/refit_guns.py -- public/models/frigate.glb public/models/frigate.glb --x 0.22 --deck 0.049 --scale 1.14
"""
import argparse, bpy, bmesh, sys, mathutils

argv = sys.argv[sys.argv.index('--') + 1:]
ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--x', type=float, required=True)
ap.add_argument('--deck', type=float, required=True)
ap.add_argument('--scale', type=float, default=1.0)
ap.add_argument('--turret', action='store_true')
a = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
scene = bpy.context.scene
for o in list(scene.objects):
    if o.name in ('cannon', 'barrel', 'muzzle') or o.name.startswith('cannon_') or o.name.startswith('gun_'):
        bpy.data.objects.remove(o, do_unlink=True)

def material(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*[c ** 2.2 for c in rgb], 1)
    bsdf.inputs['Roughness'].default_value = 1
    return m
hexrgb = lambda h: tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
IRON, IRON_LIGHT = material('gun_iron', hexrgb('#262422')), material('gun_iron_light', hexrgb('#4a4640'))
WOOD, GILT, PORT = material('gun_wood', hexrgb('#5e4224')), material('gun_gilt', hexrgb('#c9a24a')), material('gun_port', hexrgb('#0d0b08'))

def new_object(name, bm, mats, parent=None):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    if parent: ob.parent = parent
    return ob

def empty(name, parent=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None); scene.collection.objects.link(e)
    if parent: e.parent = parent
    e.location = loc; e.empty_display_size = 0.02
    return e

def box(bm, centre, size, mat=0):
    r = bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.transform(bm, matrix=mathutils.Matrix.Translation(centre) @ mathutils.Matrix.Diagonal((*size, 1)), verts=r['verts'])
    for f in {f for v in r['verts'] for f in v.link_faces}: f.material_index = mat

def cylinder(bm, start, end, r0, r1, segs=10, mat=0):
    d = mathutils.Vector(end) - mathutils.Vector(start)
    r = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r0, radius2=r1, depth=d.length)
    rot = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=mathutils.Matrix.Translation((mathutils.Vector(start) + mathutils.Vector(end)) / 2) @ rot, verts=r['verts'])
    for f in {f for v in r['verts'] for f in v.link_faces}: f.material_index = mat

k = a.scale
if not a.turret:
    # A swivel gun on a turntable, the same piece as the Ship of the Line's.
    bm = bmesh.new()
    cylinder(bm, (a.x, 0, a.deck), (a.x, 0, a.deck + 0.006 * k), 0.032 * k, 0.030 * k, 12)
    new_object('gun_turntable', bm, [WOOD])
    pivot = empty('cannon', loc=(a.x, 0, a.deck + 0.006 * k))
    bm = bmesh.new()
    box(bm, (0, 0, 0.009 * k), (0.052 * k, 0.036 * k, 0.012 * k))
    box(bm, (-0.012 * k, 0, 0.019 * k), (0.022 * k, 0.03 * k, 0.01 * k))
    for s in (-1, 1):
        for x in (-0.017, 0.017):
            cylinder(bm, (x * k, s * 0.019 * k, 0.008 * k), (x * k, s * 0.025 * k, 0.008 * k), 0.009 * k, 0.009 * k, 8, 1)
    new_object('cannon_carriage', bm, [WOOD, IRON], pivot)
    barrel = empty('barrel', pivot)
    bm = bmesh.new()
    y = 0.026 * k
    cylinder(bm, (-0.03 * k, 0, y), (0.062 * k, 0, y), 0.0135 * k, 0.0095 * k, 10, 0)
    cylinder(bm, (-0.038 * k, 0, y), (-0.03 * k, 0, y), 0.008 * k, 0.0125 * k, 8, 0)
    cylinder(bm, (0.056 * k, 0, y), (0.066 * k, 0, y), 0.0118 * k, 0.0118 * k, 10, 0)
    cylinder(bm, (-0.005 * k, 0, y), (0, 0, y), 0.0148 * k, 0.0148 * k, 10, 1)
    cylinder(bm, (0, -0.02 * k, y), (0, 0.02 * k, y), 0.004 * k, 0.004 * k, 6, 0)
    new_object('cannon_barrel', bm, [IRON, GILT], barrel)
    empty('muzzle', barrel, (0.067 * k, 0, y))
else:
    # A low armoured turret on the casemate roof: the whole drum turns, and a heavy gun runs out of its port.
    R, H = 0.052 * k, 0.034 * k
    pivot = empty('cannon', loc=(a.x, 0, a.deck))
    bm = bmesh.new()
    cylinder(bm, (0, 0, -0.004 * k), (0, 0, H), R, R, 20, 0)                       # drum
    cylinder(bm, (0, 0, H), (0, 0, H + 0.006 * k), R * 0.97, R * 0.82, 20, 1)      # bevelled roof plate
    cylinder(bm, (0, 0, H * 0.55), (0, 0, H * 0.7), R * 1.03, R * 1.03, 20, 1)     # armour band
    box(bm, (R * 0.97, 0, H * 0.5), (0.006 * k, 0.026 * k, 0.02 * k), 2)           # gun port
    cylinder(bm, (0, 0, H + 0.006 * k), (0, 0, H + 0.014 * k), 0.012 * k, 0.01 * k, 10, 1)  # sighting hood
    new_object('cannon_turret', bm, [IRON, IRON_LIGHT, PORT], pivot)
    barrel = empty('barrel', pivot)
    bm = bmesh.new()
    y = H * 0.5
    cylinder(bm, (R * 0.7, 0, y), (R + 0.05 * k, 0, y), 0.0125 * k, 0.0095 * k, 12, 0)
    cylinder(bm, (R + 0.044 * k, 0, y), (R + 0.054 * k, 0, y), 0.0118 * k, 0.0118 * k, 12, 0)
    new_object('cannon_barrel', bm, [IRON], barrel)
    empty('muzzle', barrel, (R + 0.055 * k, 0, y))

for o in scene.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=a.dst, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=88,
                          export_extras=True, export_apply=True, use_selection=False)
print(f'wrote {a.dst}: objects {sorted(o.name for o in scene.objects)}')
