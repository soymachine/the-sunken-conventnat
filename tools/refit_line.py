"""
Refit the prepared Ship of the Line (public/models/line.glb):

  * a clean plank deck laid over the blotchy hollow of the generated model, and a second one on the poop;
  * stern gallery and quarter windows with frames and amber glass, set on the hull surface;
  * a low-poly swivel cannon on the main deck, named so the game can turn it and fire from its muzzle:
    an empty `cannon` (the pivot), its child `barrel`, and an empty `muzzle` at the barrel's mouth.

Run with Blender's Python after tools/prepare_ship.py. It removes its own earlier additions first, so it
can be run again:

    python tools/refit_line.py -- public/models/line.glb public/models/line.glb
"""
import bpy, bmesh, sys, math, mathutils
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene

# Drop anything a previous run added, keep the hull.
for o in list(scene.objects):
    if o.name.startswith('refit_') or o.name in ('cannon', 'barrel', 'muzzle') or o.name.startswith('cannon_'):
        bpy.data.objects.remove(o, do_unlink=True)
hull = [o for o in scene.objects if o.type == 'MESH'][0]
hull.name = 'hull'
assert hull.get('hull'), 'run tools/prepare_ship.py first: the hull has no measurements'

def material(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*[c ** 2.2 for c in rgb], 1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1
    return m
hexrgb = lambda h: tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
PLANK_A, PLANK_B = material('refit_plank_a', hexrgb('#a07a48')), material('refit_plank_b', hexrgb('#8d6a3c'))
SEAM = material('refit_seam', hexrgb('#4a3520'))
FRAME = material('refit_frame', hexrgb('#3a2a18'))
GILT = material('refit_gilt', hexrgb('#c9a24a'))
GLASS = material('refit_glass', hexrgb('#f3c766'))
IRON = material('refit_iron', hexrgb('#262422'))
WOOD = material('refit_wood', hexrgb('#5e4224'))

def new_object(name, bm, mats, parent=None):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    if parent: ob.parent = parent
    return ob

def box(bm, centre, size, mat=0, rot=None):
    r = bmesh.ops.create_cube(bm, size=1)
    m = mathutils.Matrix.Translation(centre) @ (rot or mathutils.Matrix.Identity(4)) @ mathutils.Matrix.Diagonal((*size, 1))
    bmesh.ops.transform(bm, matrix=m, verts=r['verts'])
    for f in {f for v in r['verts'] for f in v.link_faces}: f.material_index = mat

def cylinder(bm, start, end, r0, r1, segs=8, mat=0):
    d = mathutils.Vector(end) - mathutils.Vector(start)
    r = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r0, radius2=r1, depth=d.length)
    rot = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    m = mathutils.Matrix.Translation((mathutils.Vector(start) + mathutils.Vector(end)) / 2) @ rot
    bmesh.ops.transform(bm, matrix=m, verts=r['verts'])
    for f in {f for v in r['verts'] for f in v.link_faces}: f.material_index = mat

# --- measure the hull ---
deps = bpy.context.evaluated_depsgraph_get()
bvh = BVHTree.FromObject(hull, deps)
vs = [hull.matrix_world @ v.co for v in hull.data.vertices]

def half_width(x, z0, z1):
    """Outer half-beam at station x between heights z0 and z1, ignoring shrouds and chains."""
    ys = sorted(abs(v.y) for v in vs if abs(v.x - x) < 0.012 and z0 <= v.z <= z1 and abs(v.y) < 0.085)
    return ys[int(len(ys) * 0.9)] if len(ys) > 4 else None

# --- 1. plank decks ---
def deck(name, x0, x1, z, inset, planks=7, constant=False):
    xs = [x0 + (x1 - x0) * i / 40 for i in range(41)]
    hw = []
    for x in xs:
        w = half_width(x, z - 0.012, z + 0.012)
        hw.append(max(0.0, (w or 0) - inset))
    if constant:
        # a short raised deck reads best as a plain rectangle
        w = sorted(hw)[len(hw) // 2]; hw = [w] * len(hw)
    else:
        # smooth and keep the outline convex enough to read as a deck
        hw = [sum(hw[max(0, i - 2):i + 3]) / len(hw[max(0, i - 2):i + 3]) for i in range(len(hw))]
    bm = bmesh.new()
    for p in range(planks):
        a, b = -1 + 2 * p / planks, -1 + 2 * (p + 1) / planks
        for i in range(len(xs) - 1):
            if hw[i] <= 0.002 and hw[i + 1] <= 0.002: continue
            q = [bm.verts.new((xs[i], a * hw[i], z)), bm.verts.new((xs[i + 1], a * hw[i + 1], z)),
                 bm.verts.new((xs[i + 1], b * hw[i + 1], z)), bm.verts.new((xs[i], b * hw[i], z))]
            f = bm.faces.new(q); f.material_index = p % 2
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    ob = new_object(name, bm, [PLANK_A, PLANK_B])
    return ob, xs, hw

deck('refit_deck', -0.362, 0.345, 0.0595, 0.006)
deck('refit_poop', -0.488, -0.372, 0.1185, 0.006, planks=5, constant=True)

# --- 2. windows ---
def window(bm, centre, normal, w, h, mat_offset=0):
    n = mathutils.Vector(normal).normalized()
    rot = n.to_track_quat('Z', 'Y').to_matrix().to_4x4()   # local z out of the hull, local y up
    c = mathutils.Vector(centre)
    def part(off, size, mat):
        box(bm, c + rot.to_3x3() @ mathutils.Vector(off), size, mat, rot)
    part((0, 0, 0.0015), (w + 0.006, h + 0.006, 0.003), 0)          # frame
    part((0, 0, 0.0032), (w, h, 0.002), 2)                          # glass
    part((0, 0, 0.0045), (0.0016, h, 0.0016), 0)                    # mullion
    part((0, 0, 0.0045), (w, 0.0016, 0.0016), 0)                    # transom
    part((0, -h / 2 - 0.006, 0.003), (w + 0.012, 0.004, 0.006), 1)  # gilt sill

def on_hull(origin, direction):
    hit = bvh.ray_cast(mathutils.Vector(origin), mathutils.Vector(direction).normalized(), 0.3)
    return (hit[0], hit[1]) if hit[0] is not None else (None, None)

def backing(name, rays, cols, z0, z1, rows=4, lift=0.0012):
    """A panel of dark wood laid on the hull surface, to hide the windows painted in the texture."""
    bm = bmesh.new(); grid = []
    for r in range(rows + 1):
        z = z0 + (z1 - z0) * r / rows; line = []
        for c in range(cols + 1):
            o, d = rays(c / cols, z)
            p, n = on_hull(o, d)
            line.append(bm.verts.new(p - mathutils.Vector(d).normalized() * lift) if p is not None else None)
        grid.append(line)
    for r in range(rows):
        for c in range(cols):
            q = [grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]]
            if all(q): bm.faces.new(q)
    return new_object(name, bm, [FRAME])

backing('refit_stern_panel', lambda t, z: ((-0.7, -0.05 + 0.1 * t, z), (1, 0, 0)), 10, 0.036, 0.104)
for side in (-1, 1):
    backing(f'refit_quarter_panel_{"port" if side < 0 else "star"}', lambda t, z, s=side: ((-0.488 + 0.152 * t, s * 0.3, z), (0, -s, 0)), 13, 0.044, 0.11, lift=0.0065)

bm = bmesh.new()
placed = 0
# stern gallery: two rows across the transom
for row, (z, n) in enumerate([(0.086, 5), (0.052, 4)]):
    for i in range(n):
        y = (i - (n - 1) / 2) * 0.019
        p, nrm = on_hull((-0.7, y, z), (1, 0, 0))
        if p is None: continue
        window(bm, p - mathutils.Vector((0.0024, 0, 0)), nrm if nrm.x < 0 else -nrm, 0.012, 0.016 if row == 0 else 0.013); placed += 1
# quarter windows on each side of the poop
for side in (-1, 1):
    for x in (-0.468, -0.438, -0.408, -0.378):
        p, nrm = on_hull((x, side * 0.3, 0.086), (0, -side, 0))
        if p is None: continue
        window(bm, p + mathutils.Vector((0, side * 0.0072, 0)), nrm if nrm.y * side > 0 else -nrm, 0.014, 0.017); placed += 1
new_object('refit_windows', bm, [FRAME, GILT, GLASS])
print('windows placed:', placed)

# --- 3. swivel cannon on the main deck ---
DECK_Z, X = 0.0595, 0.19
bm = bmesh.new()
cylinder(bm, (X, 0, DECK_Z), (X, 0, DECK_Z + 0.006), 0.032, 0.030, 12, 0)   # turntable ring
new_object('refit_turntable', bm, [WOOD])

pivot = bpy.data.objects.new('cannon', None); scene.collection.objects.link(pivot)
pivot.location = (X, 0, DECK_Z + 0.006); pivot.empty_display_size = 0.02
bm = bmesh.new()
box(bm, (0, 0, 0.009), (0.052, 0.036, 0.012), 0)                 # carriage bed
box(bm, (-0.012, 0, 0.019), (0.022, 0.03, 0.01), 0)               # rear step
for s in (-1, 1):
    for x in (-0.017, 0.017):
        cylinder(bm, (x, s * 0.019, 0.008), (x, s * 0.025, 0.008), 0.009, 0.009, 8, 1)   # trucks (wheels)
carriage = new_object('cannon_carriage', bm, [WOOD, IRON], pivot)
barrel = bpy.data.objects.new('barrel', None); scene.collection.objects.link(barrel); barrel.parent = pivot
bm = bmesh.new()
cylinder(bm, (-0.03, 0, 0.026), (0.062, 0, 0.026), 0.0135, 0.0095, 10, 0)     # tapered barrel
cylinder(bm, (-0.038, 0, 0.026), (-0.03, 0, 0.026), 0.008, 0.0125, 8, 0)      # cascabel
cylinder(bm, (0.056, 0, 0.026), (0.066, 0, 0.026), 0.0118, 0.0118, 10, 0)     # muzzle swell
cylinder(bm, (-0.005, 0, 0.026), (0.0, 0, 0.026), 0.0148, 0.0148, 10, 1)      # reinforce ring
cylinder(bm, (0, -0.02, 0.026), (0, 0.02, 0.026), 0.004, 0.004, 6, 0)         # trunnions
new_object('cannon_barrel', bm, [IRON, GILT], barrel)
muzzle = bpy.data.objects.new('muzzle', None); scene.collection.objects.link(muzzle)
muzzle.parent = barrel; muzzle.location = (0.067, 0, 0.026)

for o in scene.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=88,
                          export_extras=True, export_apply=True, use_selection=False)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in scene.objects if o.type == 'MESH')
print(f'wrote {dst}: {tris} triangles, objects {sorted(o.name for o in scene.objects)}')
