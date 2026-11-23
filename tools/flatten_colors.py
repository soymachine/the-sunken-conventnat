"""
Replace a ship model's texture with flat colours: every triangle takes one colour, the dominant one of the texture
under it, snapped to a short palette for that ship (k-means). The texture is dropped and the colours stored per
vertex (COLOR_0), so nothing blurs where the texture's many small UV islands met.

    python3 tools/flatten_colors.py public/models/line.glb public/models/line.glb --colors 10

Pure Python + numpy + Pillow (no Blender). Other meshes (guns, crates, refits) are kept as they are.
"""
import argparse, io, json, struct
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst'); ap.add_argument('--colors', type=int, default=10)
ap.add_argument('--smooth', type=int, default=3, help='passes that give a stray triangle the colour of its neighbours')
a = ap.parse_args()

raw = open(a.src, 'rb').read()
jl = struct.unpack('<I', raw[12:16])[0]
j = json.loads(raw[20:20 + jl])
bl = struct.unpack('<I', raw[20 + jl:24 + jl])[0]
binb = raw[28 + jl:28 + jl + bl]
CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

def view(i):
    v = j['bufferViews'][i]; o = v.get('byteOffset', 0); return binb[o:o + v['byteLength']]
def acc(i):
    ac = j['accessors'][i]; v = j['bufferViews'][ac['bufferView']]; o = v.get('byteOffset', 0) + ac.get('byteOffset', 0)
    n = ac['count'] * NC[ac['type']]
    return np.frombuffer(binb, CT[ac['componentType']], n, o).reshape(ac['count'], NC[ac['type']]).astype(np.float64)

# The textured primitive(s): flatten each.
tex_prims = [(mi, pi) for mi, m in enumerate(j['meshes']) for pi, p in enumerate(m['primitives']) if 'TEXCOORD_0' in p['attributes']
             and j['materials'][p['material']].get('pbrMetallicRoughness', {}).get('baseColorTexture')]
assert tex_prims, 'no textured mesh'

out_views, new_bytes = [], bytearray()
def add_view(data: bytes, target=None):
    global new_bytes
    while len(new_bytes) % 4: new_bytes += b'\0'
    v = {'buffer': 0, 'byteOffset': len(new_bytes), 'byteLength': len(data)}
    if target: v['target'] = target
    new_bytes += data; out_views.append(v); return len(out_views) - 1

# Re-pack every existing view first (images included for now; unused ones are dropped below).
remap = {}
for i in range(len(j['bufferViews'])):
    v = dict(j['bufferViews'][i]); nv = add_view(bytes(view(i)), v.get('target'))
    if 'byteStride' in v: out_views[nv]['byteStride'] = v['byteStride']
    remap[i] = nv
for ac in j['accessors']:
    if 'bufferView' in ac: ac['bufferView'] = remap[ac['bufferView']]
for im in j.get('images', []):
    if 'bufferView' in im: im['bufferView'] = remap[im['bufferView']]

def add_acc(arr, typ, comp=5126, target=34962):
    arr = np.ascontiguousarray(arr.astype(CT[comp]))
    vi = add_view(arr.tobytes(), target)
    ac = {'bufferView': vi, 'componentType': comp, 'count': int(arr.shape[0]), 'type': typ}
    if typ == 'VEC3' and comp == 5126: ac['min'] = arr.min(0).tolist(); ac['max'] = arr.max(0).tolist()
    j['accessors'].append(ac); return len(j['accessors']) - 1

for mi, pi in tex_prims:
    p = j['meshes'][mi]['primitives'][pi]
    mat = j['materials'][p['material']]
    tex = j['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]
    img = Image.open(io.BytesIO(bytes(view(j['images'][tex['source']]['bufferView'])))).convert('RGB')
    T = np.asarray(img).astype(np.float64); H, W, _ = T.shape
    P = acc(p['attributes']['POSITION']); N = acc(p['attributes']['NORMAL']); UV = acc(p['attributes']['TEXCOORD_0'])
    I = acc(p['indices']).astype(np.int64).reshape(-1, 3) if 'indices' in p else np.arange(len(P)).reshape(-1, 3)
    # Sample each triangle at its centre and three points towards its corners; the median resists stray texels.
    uv = UV[I]                                   # (t, 3, 2)
    c = uv.mean(1)
    pts = [c] + [c * 0.4 + uv[:, k] * 0.6 for k in range(3)]
    def tap(q):
        x = np.clip((q[:, 0] % 1) * W, 0, W - 1).astype(int); y = np.clip((q[:, 1] % 1) * H, 0, H - 1).astype(int)
        return T[y, x]
    col = np.median(np.stack([tap(q) for q in pts]), axis=0)     # (t, 3)
    # Snap to a short palette (k-means, weighted by triangle area).
    e1, e2 = P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]]
    area = np.linalg.norm(np.cross(e1, e2), axis=1) / 2 + 1e-12
    rng = np.random.default_rng(7); k = min(a.colors, len(col))
    cent = col[rng.choice(len(col), k, replace=False, p=area / area.sum())]
    for _ in range(30):
        lab = np.argmin(((col[:, None] - cent[None]) ** 2).sum(-1), 1)
        for q in range(k):
            m = lab == q
            if m.any(): cent[q] = (col[m] * area[m, None]).sum(0) / area[m].sum()
    lab = np.argmin(((col[:, None] - cent[None]) ** 2).sum(-1), 1)
    # Neighbours share an edge (matched by position, since seams split vertices). A triangle whose colour covers
    # less than a third of its neighbourhood takes the neighbourhood's colour: stray shards go, large areas stay.
    key = {}
    vk = np.round(P / (np.abs(P).max() * 1e-4)).astype(np.int64)
    vid = np.unique(vk, axis=0, return_inverse=True)[1].reshape(-1)
    T3 = vid[I]
    edges = {}
    for t, (x, y, z) in enumerate(T3):
        for e in ((x, y), (y, z), (z, x)):
            edges.setdefault((min(e), max(e)), []).append(t)
    nb = [[] for _ in range(len(T3))]
    for ts in edges.values():
        for t in ts:
            nb[t] += [u for u in ts if u != t]
    for _ in range(a.smooth):
        new = lab.copy()
        for t in range(len(lab)):
            if not nb[t]: continue
            ids = np.array(nb[t] + [t]); w = np.bincount(lab[ids], area[ids], k)
            if w[lab[t]] < w.sum() / 3: new[t] = int(np.argmax(w))
        lab = new
    tri_col = cent[lab] / 255.0
    lin = np.where(tri_col <= 0.04045, tri_col / 12.92, ((tri_col + 0.055) / 1.055) ** 2.4)   # glTF vertex colours are linear
    # Un-index: each triangle's three corners carry its colour (one byte a channel, normalised).
    pos = P[I].reshape(-1, 3); nor = N[I].reshape(-1, 3)
    vc = np.repeat(np.hstack([np.round(lin * 255), np.full((len(lin), 1), 255)]), 3, axis=0)
    ci = add_acc(vc, 'VEC4', 5121); j['accessors'][ci]['normalized'] = True
    p['attributes'] = {'POSITION': add_acc(pos, 'VEC3'), 'NORMAL': add_acc(nor, 'VEC3'), 'COLOR_0': ci}
    p.pop('indices', None)
    newmat = {'name': mat.get('name', 'flat') + '_flat', 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0, 'roughnessFactor': 1}}
    j['materials'].append(newmat); p['material'] = len(j['materials']) - 1
    pal = ', '.join('#%02x%02x%02x' % tuple(int(v) for v in cc) for cc in cent[np.argsort(-np.bincount(lab, area, k))])
    print(f'{a.src}: {len(I)} triangles in {k} colours: {pal}')

# Drop images, textures and materials nothing uses any more, then views nothing references.
used_mats = {p['material'] for m in j['meshes'] for p in m['primitives'] if 'material' in p}
used_tex = {mm['pbrMetallicRoughness']['baseColorTexture']['index'] for i, mm in enumerate(j['materials']) if i in used_mats and mm.get('pbrMetallicRoughness', {}).get('baseColorTexture')}
if not used_tex:
    for key in ('images', 'textures', 'samplers'): j.pop(key, None)
    for mm in j['materials']: mm.get('pbrMetallicRoughness', {}).pop('baseColorTexture', None)
# Rebuild the buffer with only the views still referenced.
ref = {ac['bufferView'] for ac in j['accessors'] if 'bufferView' in ac} | {im['bufferView'] for im in j.get('images', []) if 'bufferView' in im}
final, nb, vmap = [], bytearray(), {}
for i, v in enumerate(out_views):
    if i not in ref: continue
    while len(nb) % 4: nb += b'\0'
    data = new_bytes[v['byteOffset']:v['byteOffset'] + v['byteLength']]
    nv = dict(v); nv['byteOffset'] = len(nb); nb += data; vmap[i] = len(final); final.append(nv)
for ac in j['accessors']:
    if 'bufferView' in ac: ac['bufferView'] = vmap[ac['bufferView']]
for im in j.get('images', []):
    im['bufferView'] = vmap[im['bufferView']]
while len(nb) % 4: nb += b'\0'
j['bufferViews'] = final; j['buffers'] = [{'byteLength': len(nb)}]
js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
glb = b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(nb)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(nb)) + b'BIN\0' + bytes(nb)
open(a.dst, 'wb').write(glb)
print(f'wrote {a.dst}: {len(glb)//1024} KB')
