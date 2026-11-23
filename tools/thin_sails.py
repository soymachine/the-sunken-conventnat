"""
Make a flattened ship's sails thinner: every sail (one connected piece in the sail colour) is squeezed fore-and-aft
towards the line of its top edge, where it hangs from the yard, and its normals are corrected to match.

    python3 tools/thin_sails.py public/models/line.glb public/models/line.glb --factor 0.45

Works on models already run through tools/flatten_colors.py (one colour per triangle, triangles unshared).
The sail colour is found as the palest colour above the deck unless --color r,g,b is given.
"""
import argparse, json, struct
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--factor', type=float, default=0.45, help='new fore-and-aft depth as a share of the old')
ap.add_argument('--color', help='sail colour as r,g,b (0-255)')
a = ap.parse_args()

raw = bytearray(open(a.src, 'rb').read())
jl = struct.unpack('<I', raw[12:16])[0]
j = json.loads(raw[20:20 + jl])
B0 = 28 + jl  # the binary chunk's first byte
NC = {'VEC3': 3, 'VEC4': 4}

def where(i):
    ac = j['accessors'][i]; v = j['bufferViews'][ac['bufferView']]
    return B0 + v.get('byteOffset', 0) + ac.get('byteOffset', 0), ac['count'] * NC[ac['type']]

done = 0
for m in j['meshes']:
    for p in m['primitives']:
        at = p['attributes']
        if 'COLOR_0' not in at or 'indices' in p: continue
        po, pn = where(at['POSITION']); no, nn = where(at['NORMAL']); co, cn = where(at['COLOR_0'])
        P = np.frombuffer(raw, np.float32, pn, po).reshape(-1, 3).astype(np.float64)
        N = np.frombuffer(raw, np.float32, nn, no).reshape(-1, 3).astype(np.float64)
        C = np.frombuffer(raw, np.uint8, cn, co).reshape(-1, 4)[:, :3].astype(int)
        TC = C[::3]
        if a.color: sail = np.array([int(x) for x in a.color.split(',')])
        else:
            cols = np.unique(TC, axis=0); sail = cols[np.argmax(cols.sum(1))]
        tri = np.where((TC == sail).all(1))[0]
        # Sails are the connected pieces of that colour (vertices welded by position).
        par = list(range(len(tri))); seen = {}
        def root(k):
            while par[k] != k: par[k] = par[par[k]]; k = par[k]
            return k
        for k, t in enumerate(tri):
            for v in P[3 * t:3 * t + 3]:
                q = tuple(np.round(v, 5))
                if q in seen: par[root(k)] = root(seen[q])
                else: seen[q] = k
        roots = np.array([root(k) for k in range(len(tri))])
        for r in np.unique(roots):
            vi = (3 * tri[roots == r][:, None] + np.arange(3)).ravel()
            V = P[vi]; top = V[:, 1] > V[:, 1].max() - 0.1 * (V[:, 1].max() - V[:, 1].min())
            pivot = V[top, 0].mean()
            P[vi, 0] = pivot + (V[:, 0] - pivot) * a.factor
            n = N[vi]; n[:, 0] /= a.factor; N[vi] = n / np.linalg.norm(n, axis=1, keepdims=True)
            done += 1
        raw[po:po + 4 * pn] = P.astype(np.float32).tobytes()
        raw[no:no + 4 * nn] = N.astype(np.float32).tobytes()
        # Keep the accessor bounds true.
        ac = j['accessors'][at['POSITION']]; ac['min'] = P.min(0).tolist(); ac['max'] = P.max(0).tolist()

js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
out = raw[:12] + struct.pack('<I', len(js)) + b'JSON' + js + raw[20 + jl:]
out[8:12] = struct.pack('<I', len(out))
open(a.dst, 'wb').write(out)
print(f'thin_sails: {done} sails squeezed to {a.factor:.0%} of their depth -> {a.dst}')
