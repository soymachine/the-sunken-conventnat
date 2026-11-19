"""
Refit the prepared Merchantman (public/models/merchant.glb) for Convoy mode.

The generated crates are fused into the hull mesh, so the game could not take one away for each crate
plundered. This finds them by their ochre colour in the texture just above the main deck, removes that
geometry, and puts three separate crates in their place named `crate_0`, `crate_1`, `crate_2` from stern
to bow. It also records the main deck height (the measurement in tools/prepare_ship.py takes the poop).

    python tools/refit_merchant.py -- public/models/merchant.glb public/models/merchant.glb
"""
import bpy, bmesh, sys, collections, mathutils

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
for o in list(scene.objects):
    if o.name.startswith('crate_'): bpy.data.objects.remove(o, do_unlink=True)
hull = [o for o in scene.objects if o.type == 'MESH'][0]
hull.name = 'hull'
assert hull.get('hull'), 'run tools/prepare_ship.py first'

img = [i for i in bpy.data.images if i.size[0]][0]; W, H = img.size; px = img.pixels[:]
def colour(u, v):
    x = min(W - 1, max(0, int(u % 1 * W))); y = min(H - 1, max(0, int(v % 1 * H))); i = (y * W + x) * 4
    return px[i:i + 3]

bm = bmesh.new(); bm.from_mesh(hull.data); uv = bm.loops.layers.uv.active
# Main deck: the height with the most upward-facing area along the middle of the ship.
up = collections.Counter()
for f in bm.faces:
    c = f.calc_center_median()
    if abs(c.y) < 0.06 and f.normal.z > 0.9 and -0.2 < c.x < 0.3: up[round(c.z, 3)] += f.calc_area()
deck = max(up, key=up.get)

def ochre(f):
    u = sum(l[uv].uv.x for l in f.loops) / len(f.loops); v = sum(l[uv].uv.y for l in f.loops) / len(f.loops)
    r, g, b = colour(u, v)
    return r - b > 0.28 and g > 0.3 and r > 0.45
# Crates sit on the deck near the centreline: keep to that band so gilt rails and the bow are left alone.
gold = [f for f in bm.faces if abs(f.calc_center_median().y) < 0.06 and deck + 0.004 < f.calc_center_median().z < deck + 0.08
        and -0.4 < f.calc_center_median().x < 0.4 and ochre(f)]
gold.sort(key=lambda f: f.calc_center_median().x)
groups = []
for f in gold:
    x = f.calc_center_median().x
    if not groups or x - groups[-1][-1].calc_center_median().x > 0.06: groups.append([f])
    else: groups[-1].append(f)
groups = sorted(groups, key=len, reverse=True)[:3]
groups.sort(key=lambda g: g[0].calc_center_median().x)
assert len(groups) == 3, f'expected three crates, found {len(groups)}'

boxes = []
for g in groups:
    # Robust extent (ignore stray faces), then keep it crate-sized.
    cs = sorted((f.calc_center_median() for f in g), key=lambda c: c.x)
    q = lambda k, p: sorted(c[k] for c in cs)[min(len(cs) - 1, int(len(cs) * p))]
    lo = mathutils.Vector((q(0, 0.05), q(1, 0.05), deck)); hi = mathutils.Vector((q(0, 0.95), q(1, 0.95), q(2, 0.95)))
    centre = (lo + hi) / 2
    half = mathutils.Vector((min(0.055, max(0.03, (hi.x - lo.x) / 2 + 0.008)), min(0.05, max(0.03, (hi.y - lo.y) / 2 + 0.008)), 0))
    top = min(deck + 0.075, max(deck + 0.04, hi.z + 0.006))
    mn = mathutils.Vector((centre.x - half.x, centre.y - half.y, deck)); mx = mathutils.Vector((centre.x + half.x, centre.y + half.y, top))
    boxes.append((mn, mx))
# Remove everything inside each crate's volume (a little larger), above the deck.
doomed = set()
for mn, mx in boxes:
    for f in bm.faces:
        c = f.calc_center_median()
        # Only what stands above the planking; the new crate hides whatever is left at its foot.
        if mn.x <= c.x <= mx.x and mn.y <= c.y <= mx.y and deck + 0.009 < c.z <= mx.z + 0.006:
            doomed.add(f)
bmesh.ops.delete(bm, geom=list(doomed), context='FACES')
bm.to_mesh(hull.data); bm.free()
hull['deck'] = deck
print(f'main deck {deck:.3f}; removed {len(doomed)} faces; crates at x ' + ', '.join(f'{(a.x + b.x) / 2:+.3f}' for a, b in boxes))

def material(name, hexcol):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    rgb = tuple(int(hexcol[i:i + 2], 16) / 255 for i in (1, 3, 5))
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*[c ** 2.2 for c in rgb], 1)
    return m
WOOD, BAND = material('crate_wood', '#c9952f'), material('crate_band', '#5a3c1e')
for i, (mn, mx) in enumerate(boxes):
    size = mx - mn; centre = (mn + mx) / 2
    bm = bmesh.new()
    def cube(c, s, mat):
        r = bmesh.ops.create_cube(bm, size=1)
        bmesh.ops.transform(bm, matrix=mathutils.Matrix.Translation(c) @ mathutils.Matrix.Diagonal((*s, 1)), verts=r['verts'])
        for f in {f for v in r['verts'] for f in v.link_faces}: f.material_index = mat
    cube((0, 0, 0), size, 0)
    cube((0, 0, 0), (size.x * 1.02, size.y * 0.16, size.z * 1.02), 1)   # cross bands
    cube((0, 0, 0), (size.x * 0.16, size.y * 1.02, size.z * 1.02), 1)
    me = bpy.data.meshes.new(f'crate_{i}'); bm.to_mesh(me); bm.free()
    me.materials.append(WOOD); me.materials.append(BAND)
    ob = bpy.data.objects.new(f'crate_{i}', me); scene.collection.objects.link(ob); ob.location = centre

for o in scene.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=88,
                          export_extras=True, export_apply=True, use_selection=False)
print('wrote', dst)
