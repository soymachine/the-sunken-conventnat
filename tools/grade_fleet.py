"""
Grade the textures of the prepared ships so the fleet reads as one set.

Each model generated separately came out with its own brightness, saturation and wood colour. This
remaps every texture to a common palette:

  * the average brightness of what is visible on the ship is brought to the same value (by a gamma
    curve, so whites and blacks keep their place);
  * saturation is brought to the same level;
  * browns and ochres (the wood) are pulled towards one wood hue; reds, whites and greys keep theirs;
  * a light shared sepia tone ties them to the engraved charts.

Iron is iron: ships listed in IRON are kept grey, only warmed and lifted a little.

Run after tools/prepare_ship.py and the refits. A graded file is marked and skipped next time.

    python tools/grade_fleet.py -- public/models/*.glb
"""
import bpy, sys, numpy as np, colorsys

argv = sys.argv[sys.argv.index('--') + 1:]
force = '--force' in argv
files = [a for a in argv if a.endswith('.glb')]
WOOD_LUM, WOOD_SAT, IRON_LUM = 0.47, 0.40, 0.30
WOOD_HUE, HUE_PULL, SEPIA, IRON_SEPIA = 0.085, 0.5, 0.14, 0.30
SAT_STRENGTH = 0.5
IRON = {'ironclad'}
SEPIA_RGB = np.array([1.12, 0.96, 0.72])

def rgb_to_hsv(c):
    r, g, b = c[:, 0], c[:, 1], c[:, 2]
    mx = c.max(1); mn = c.min(1); d = mx - mn
    h = np.zeros_like(mx); s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0); v = mx
    m = d > 1e-6
    rc = np.where(m, (mx - r) / np.maximum(d, 1e-6), 0); gc = np.where(m, (mx - g) / np.maximum(d, 1e-6), 0); bc = np.where(m, (mx - b) / np.maximum(d, 1e-6), 0)
    h = np.where(r == mx, bc - gc, np.where(g == mx, 2 + rc - bc, 4 + gc - rc))
    h = np.where(m, (h / 6) % 1, 0)
    return h, s, v

def hsv_to_rgb(h, s, v):
    i = np.floor(h * 6).astype(int) % 6; f = h * 6 - np.floor(h * 6)
    p = v * (1 - s); q = v * (1 - s * f); t = v * (1 - s * (1 - f))
    r = np.choose(i, [v, q, p, p, t, v]); g = np.choose(i, [t, v, v, q, p, p]); b = np.choose(i, [p, p, t, v, v, q])
    return np.stack([r, g, b], 1)

lum = lambda c: c @ np.array([0.2126, 0.7152, 0.0722])

for path in files:
    kind = path.rsplit('/', 1)[-1][:-4]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    scene = bpy.context.scene
    hull = scene.objects.get('hull') or next(o for o in scene.objects if o.type == 'MESH' and o.get('hull'))
    if hull.get('graded') and not force:
        print(f'{kind}: already graded, skipped'); continue
    me = hull.data
    img = next(n.image for m in me.materials if m and m.node_tree for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image)
    W, H = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    rgb = px[:, :3].copy()

    # What the ship actually shows: one texel per face, weighted by the face's area.
    uv = me.uv_layers.active.data
    idx, wts = [], []
    for p in me.polygons:
        u = sum(uv[l].uv.x for l in p.loop_indices) / p.loop_total; v = sum(uv[l].uv.y for l in p.loop_indices) / p.loop_total
        idx.append(min(H - 1, int(v % 1 * H)) * W + min(W - 1, int(u % 1 * W))); wts.append(p.area)
    idx = np.array(idx); wts = np.array(wts) / sum(wts)
    seen = rgb[idx]
    iron = kind in IRON

    # 1. brightness: a gamma curve that moves the visible average to the target
    m_l = float(np.clip(lum(seen) @ wts, 0.05, 0.95))
    gamma = np.log(IRON_LUM if iron else WOOD_LUM) / np.log(m_l)
    h, s, v = rgb_to_hsv(np.clip(rgb, 0, 1))
    v = np.power(np.clip(v, 1e-6, 1), gamma)
    if not iron:
        # 2. saturation, measured on the visible texels
        _, s_seen, _ = rgb_to_hsv(np.clip(seen, 0, 1))
        # Only part of the way: a full correction overdoes details that were already vivid or already dull.
        k = (WOOD_SAT / max(0.05, float(s_seen @ wts))) ** SAT_STRENGTH
        s = np.clip(s * k, 0, 1)
        # 3. one wood hue: browns and ochres only (not the reds of the pennants, not near-greys)
        wood = (h > 0.02) & (h < 0.17) & (s > 0.12)
        red = (h < 0.04) | (h > 0.95)
        pull = np.where(wood & ~red, HUE_PULL, 0)
        h = h + (WOOD_HUE - h) * pull
    out = hsv_to_rgb(h, s, v)
    # 4. shared sepia
    tone = np.clip(lum(out)[:, None] * SEPIA_RGB, 0, 1)
    out = out * (1 - (IRON_SEPIA if iron else SEPIA)) + tone * (IRON_SEPIA if iron else SEPIA)
    px[:, :3] = np.clip(out, 0, 1)
    img.pixels.foreach_set(px.ravel())
    img.update()
    hull['graded'] = 1

    after = px[idx, :3]
    _, s_a, _ = rgb_to_hsv(after)
    print(f'{kind}: lum {m_l:.3f} -> {float(lum(after) @ wts):.3f}, sat -> {float(s_a @ wts):.3f}')
    for o in scene.objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=88,
                              export_extras=True, export_apply=True, use_selection=False)
