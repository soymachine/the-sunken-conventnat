"""
Prepare a ship model from an image-to-3D service (Meshy, Tripo...) for the game.

Run with Blender's Python (the `bpy` package works):

    python tools/prepare_ship.py -- IN.glb OUT.glb [--bow=-x|--bow=+x] [--waterline 0.45]
        [--beam 0.74] [--height 2.6] [--squares 5] [--texture 1024]

What it does:
  * merges duplicate vertices and drops loose ones;
  * turns the ship so the bow faces +X (the game's "ahead");
  * measures the hull (everything below the deck, ignoring masts and bowsprit), scales it so the hull is
    exactly 1.0 long, centres it, and puts the waterline at height 0;
  * narrows the beam and lowers the masts, if needed, so the ship fits its row of squares (never stretches);
  * shrinks the texture and saves it as JPEG;
  * records the deck height in the node's extras, which the game reads (src/render/ships.ts).
"""
import bpy, bmesh, sys, argparse, mathutils

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--bow', default='-x', choices=['-x', '+x'], help='axis the bow points along in the source model; write it as --bow=-x')
ap.add_argument('--waterline', type=float, default=0.45, help='waterline as a fraction of keel-to-deck height')
ap.add_argument('--deck', type=float, default=None, help='deck height in source units (measured if omitted)')
ap.add_argument('--squares', type=float, default=5, help='length of the ship on the chart, in squares')
ap.add_argument('--beam', type=float, default=0.74, help='hull beam wanted, in squares')
ap.add_argument('--height', type=float, default=2.6, help='mast-top height above water wanted, in squares')
ap.add_argument('--texture', type=int, default=1024)
a = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in bpy.context.scene.objects: o.select_set(o in meshes)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# --- clean ---
bm = bmesh.new(); bm.from_mesh(ob.data)
before = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context='VERTS')
tiny = [f for f in bm.faces if f.calc_area() < 1e-10]
bmesh.ops.delete(bm, geom=tiny, context='FACES')
bm.to_mesh(ob.data); bm.free()
print(f'cleaned: {before} -> {len(ob.data.vertices)} vertices, {len(tiny)} degenerate faces removed')

# --- bow to +X ---
if a.bow == '-x':
    ob.data.transform(mathutils.Matrix.Rotation(3.14159265, 4, 'Z'))

# --- measure the hull ---
vs = [v.co.copy() for v in ob.data.vertices]
keel = min(v.z for v in vs)
if a.deck is None:
    # The deck is where the hull ends: the highest slice that still holds a dense band of vertices.
    zs = sorted(v.z for v in vs)
    top = max(v.z for v in vs); n = 40; step = (top - keel) / n
    counts = [sum(1 for z in zs if keel + i * step <= z < keel + (i + 1) * step) for i in range(n)]
    peak = max(range(n), key=lambda i: counts[i])
    i = peak
    while i + 1 < n and counts[i + 1] > counts[peak] * 0.2: i += 1
    deck = keel + (i + 1) * step
else:
    deck = a.deck
hull = [v for v in vs if v.z < deck - (deck - keel) * 0.15]
x0, x1 = min(v.x for v in hull), max(v.x for v in hull)
y0, y1 = min(v.y for v in hull), max(v.y for v in hull)
wl = keel + (deck - keel) * a.waterline
tops = max(v.z for v in vs)
L = x1 - x0
print(f'hull: length {L:.3f}, beam {y1 - y0:.3f}, keel {keel:.3f}, deck {deck:.3f}, waterline {wl:.3f}, mast top {tops:.3f}')

# --- normalise: hull 1.0 long, centred, waterline at 0; beam and height to the game's proportions ---
hull_sq = a.squares * 0.94                      # hull length on the chart, as in the procedural ships
sx = 1 / L
# Only ever narrow or lower a model to fit its row: never stretch it past its own proportions.
sy = min(sx, (a.beam / hull_sq) / (y1 - y0))
sz = min(sx, (a.height / hull_sq) / (tops - wl))
m = mathutils.Matrix.Diagonal((sx, sy, sz, 1)) @ mathutils.Matrix.Translation((-(x0 + x1) / 2, -(y0 + y1) / 2, -wl))
ob.data.transform(m)
ob.data.update()
ob['deck'] = (deck - wl) * sz                    # deck height above water, in hull lengths
ob['hull'] = 1.0
print(f'squeeze: beam x{sy / sx:.2f}, height x{sz / sx:.2f} relative to length')

# --- texture: smaller, JPEG ---
for img in bpy.data.images:
    if img.size[0] > a.texture:
        img.scale(a.texture, a.texture)

bpy.ops.export_scene.gltf(filepath=a.dst, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85,
                          export_extras=True, export_apply=True, use_selection=False)
tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
print(f'wrote {a.dst}: {tris} triangles')
