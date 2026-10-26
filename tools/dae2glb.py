# tools/dae2glb.py — used for models/door-hardware/drop-seal.glb (2026-10-26): python3 tools/dae2glb.py in.dae out.glb
# SketchUp Collada (inch, Z-up) -> GLB (metres, Y-up), positions + normals, one primitive per material colour
import sys, re, struct, json, math
import xml.etree.ElementTree as ET
src, out = sys.argv[1], sys.argv[2]
ns = {'c': 'http://www.collada.org/2005/11/COLLADASchema'}
T = ET.parse(src).getroot()
def q(e, p): return e.find(p, ns)
def qa(e, p): return e.findall(p, ns)
unit = float(q(T, 'c:asset/c:unit').get('meter'))
def floats(e): return [float(v) for v in (e.text or "").split()] if e is not None else []
# effects -> colour (texture = aluminium)
eff = {}
for e in qa(T, 'c:library_effects/c:effect'):
    col = e.find('.//c:diffuse/c:color', ns)
    eff[e.get('id')] = tuple(floats(col)[:3]) if col is not None else (0.77, 0.78, 0.80)
mat = {m.get('id'): eff[q(m, 'c:instance_effect').get('url')[1:]] for m in qa(T, 'c:library_materials/c:material')}
geoms = {}
for g in qa(T, 'c:library_geometries/c:geometry'):
    m = q(g, 'c:mesh'); srcs = {s.get('id'): floats(q(s, 'c:float_array')) for s in qa(m, 'c:source')}
    verts = {}
    for v in qa(m, 'c:vertices'):
        d = {i.get('semantic'): srcs[i.get('source')[1:]] for i in qa(v, 'c:input')}
        verts[v.get('id')] = d
    tris = []
    for t in qa(m, 'c:triangles'):
        ins = qa(t, 'c:input'); stride = max(int(i.get('offset')) for i in ins) + 1
        vin = [i for i in ins if i.get('semantic') == 'VERTEX'][0]; off = int(vin.get('offset')); vd = verts[vin.get('source')[1:]]
        idx = [int(x) for x in q(t, 'c:p').text.split()]
        P = vd['POSITION']; N = vd.get('NORMAL')
        pts = []
        for k in range(0, len(idx), stride):
            i = idx[k + off]; pts.append((P[3*i:3*i+3], N[3*i:3*i+3] if N else None))
        tris.append((t.get('material'), pts))
    geoms[g.get('id')] = tris
lib_nodes = {n.get('id'): n for n in qa(T, 'c:library_nodes/c:node')}
def mmul(a, b): return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
I4 = [[1 if i == j else 0 for j in range(4)] for i in range(4)]
buckets = {}
def walk(node, M):
    mx = q(node, 'c:matrix')
    if mx is not None:
        f = floats(mx); M = mmul(M, [f[0:4], f[4:8], f[8:12], f[12:16]])
    for ig in qa(node, 'c:instance_geometry'):
        bind = {im.get('symbol'): im.get('target')[1:] for im in ig.findall('.//c:instance_material', ns)}
        for sym, pts in geoms[ig.get('url')[1:]]:
            col = mat.get(bind.get(sym), (0.7, 0.7, 0.7))
            b = buckets.setdefault(col, [])
            for p, n in pts:
                x = [M[r][0]*p[0] + M[r][1]*p[1] + M[r][2]*p[2] + M[r][3] for r in range(3)]
                nn = [M[r][0]*n[0] + M[r][1]*n[1] + M[r][2]*n[2] for r in range(3)] if n else [0, 0, 1]
                L = math.sqrt(sum(v*v for v in nn)) or 1
                # Z-up -> Y-up, inch -> m
                # Z-up -> Y-up, inch -> m, then turned so the length runs along X (a door's bottom edge): x' = z, z' = -x
                X, Y, Z = x[0]*unit, x[2]*unit, -x[1]*unit; nx, ny, nz = nn[0]/L, nn[2]/L, -nn[1]/L
                b.append(((Z, Y, -X), (nz, ny, -nx)))
    for inn in qa(node, 'c:instance_node'): walk(lib_nodes[inn.get('url')[1:]], M)
    for ch in qa(node, 'c:node'): walk(ch, M)
for n in qa(T, 'c:library_visual_scenes/c:visual_scene/c:node'): walk(n, I4)
allp = [v[0] for b in buckets.values() for v in b]
mn = [min(p[i] for p in allp) for i in range(3)]; mxv = [max(p[i] for p in allp) for i in range(3)]
print('bbox m', mn, mxv, 'size mm', [round((mxv[i]-mn[i])*1000, 1) for i in range(3)], 'tris', len(allp)//3)
# centre x and z, bottom at y=0
c = [(mn[0]+mxv[0])/2, mn[1], (mn[2]+mxv[2])/2]
bin_ = b''; views = []; acc = []; meshes = []; mats = []
for k, (col, vs) in enumerate(buckets.items()):
    pos = b''.join(struct.pack('<3f', p[0]-c[0], p[1]-c[1], p[2]-c[2]) for p, n in vs)
    nor = b''.join(struct.pack('<3f', *n) for p, n in vs)
    for data, typ, extra in ((pos, 'POSITION', True), (nor, 'NORMAL', False)):
        views.append({'buffer': 0, 'byteOffset': len(bin_), 'byteLength': len(data), 'target': 34962}); bin_ += data
        a = {'bufferView': len(views)-1, 'componentType': 5126, 'count': len(vs), 'type': 'VEC3'}
        if extra:
            ps = [(p[0]-c[0], p[1]-c[1], p[2]-c[2]) for p, n in vs]
            a['min'] = [min(p[i] for p in ps) for i in range(3)]; a['max'] = [max(p[i] for p in ps) for i in range(3)]
        acc.append(a)
    metal = 0.1 if col[0] < 0.3 else 0.6
    mats.append({'name': 'm%d' % k, 'pbrMetallicRoughness': {'baseColorFactor': [col[0], col[1], col[2], 1], 'metallicFactor': metal, 'roughnessFactor': 0.45 if metal > 0.5 else 0.85}, 'doubleSided': True})
    meshes.append({'attributes': {'POSITION': len(acc)-2, 'NORMAL': len(acc)-1}, 'material': k})
gl = {'asset': {'version': '2.0', 'generator': 'dae2glb.py (Björninn)'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': 'drop_seal'}],
      'meshes': [{'primitives': meshes}], 'materials': mats, 'accessors': acc, 'bufferViews': views, 'buffers': [{'byteLength': len(bin_)}]}
js = json.dumps(gl, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4); bin_ += b'\0' * ((4 - len(bin_) % 4) % 4)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(bin_), 0x004E4942) + bin_
open(out, 'wb').write(glb); print('glb bytes', len(glb), 'colours', list(buckets.keys()))
