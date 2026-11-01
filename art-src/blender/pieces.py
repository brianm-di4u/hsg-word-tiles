# Bathhouse Letters: 3D pieces for the board table, built in Blender's Python and exported as compact meshes.
#   "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup --python art-src/blender/pieces.py -- export src/js/pieces-mesh.js
#   (add "render <dir>" instead of "export <file>" to render a preview of each piece with Cycles)
# Units are board cells (one square = 1). Pieces:
#   tile    a glazed ceramic tile, 0.9 x 0.9 x 0.24 with a soft bevel; its top faces use material 'tiletop', which the
#           game replaces with the letter texture (UVs are made from positions in board3d.js)
#   frame   a mitred walnut moulding with a brass bead that wraps the 16 x 16 board slab
#   towels  three folded white bath towels with a teal stripe, as stacked on a bathhouse counter
#   bell    a brass front-desk call bell on a black base
# Mesh export (positions int16 over the bounding box, normals int8, indices uint16, one group per material) follows
# Bathhouse Barons' art-src/blender/pieces.py.
import bpy, bmesh, math, os, sys, json
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

_mats = {}
def mat(name, color, metal=0.0, rough=0.5, coat=0.0):
    if name in _mats: return _mats[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(color), 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if coat: b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = 0.08
    _mats[name] = m
    return m

TILETOP = lambda: mat('tiletop', '#F7F0DE', 0.0, 0.35, 0.6)
TILEBODY = lambda: mat('tilebody', '#EADFC4', 0.0, 0.4, 0.5)
WALNUT = lambda: mat('walnut', '#6B4428', 0.0, 0.4, 0.45)
BRASS = lambda: mat('brass', '#C9A14A', 1.0, 0.28)
CLOTH = lambda: mat('cloth', '#F4F0E6', 0.0, 0.95)
STRIPE = lambda: mat('stripe', '#2A9D8F', 0.0, 0.9)
BLACK = lambda: mat('black', '#1F1A16', 0.2, 0.35, 0.5)

def link(ob):
    bpy.context.scene.collection.objects.link(ob); return ob

def mesh_from(bm, name, mats, smooth=False):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    if smooth: me.shade_smooth()
    return link(bpy.data.objects.new(name, me))

def clear():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)

def rounded_box(w, d, h, r, segs=3, z0=0.0, x0=0.0, y0=0.0):
    """bmesh of a box w x d x h (bottom at z0) with every edge bevelled by r."""
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts: v.co = Vector((x0 + v.co.x * w, y0 + v.co.y * d, z0 + (v.co.z + 0.5) * h))
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=r, segments=segs, profile=0.5, affect='EDGES')
    return bm

def tile():
    bm = rounded_box(0.9, 0.9, 0.24, 0.07, 4)
    # a faint crown on the glazed top: lift the centre of the top face a hair
    for v in bm.verts:
        if v.co.z > 0.239: v.co.z += 0.012 * max(0.0, 1 - (abs(v.co.x) / 0.38) ** 2) * max(0.0, 1 - (abs(v.co.y) / 0.38) ** 2)
    for f in bm.faces: f.material_index = 0 if f.normal.z > 0.92 and f.calc_center_median().z > 0.2 else 1
    mesh_from(bm, 'tile', [TILETOP(), TILEBODY()], smooth=True)

def square_lathe(profile, mats_idx, name, mats):
    """A mitred square frame: each profile point (half-size, z) becomes a square ring; mats_idx gives each band's material."""
    bm = bmesh.new(); rings = []
    for s, z in profile:
        rings.append([bm.verts.new((sx * s, sy * s, z)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    for k, (a, b) in enumerate(zip(rings, rings[1:])):
        for i in range(4):
            f = bm.faces.new((a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]))
            f.material_index = mats_idx[k]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from(bm, name, mats)

def frame():
    # board slab half-size 8 (16 cells: the 15 squares plus the painted border); the slab face sits at z = 0.3
    P = [(8.0, 0.0), (8.0, 0.36), (8.06, 0.44), (8.16, 0.46), (8.2, 0.52), (8.26, 0.56), (8.32, 0.52), (8.36, 0.46),
         (8.55, 0.42), (8.75, 0.34), (8.88, 0.22), (8.92, 0.1), (8.92, 0.0), (8.0, 0.0)]
    idx = [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]
    square_lathe(P, idx, 'frame', [WALNUT(), BRASS()])

def towels():
    for k, (dx, dy, rot) in enumerate(((0, 0, 0.0), (0.12, -0.08, 0.05), (-0.06, 0.1, -0.04))):
        z = k * 0.42
        bm = rounded_box(3.2, 2.0, 0.4, 0.16, 3, z0=z)
        for v in bm.verts:  # soft folded edge: the front face bulges a little
            if v.co.y < -0.9: v.co.y -= 0.05 * math.sin(math.pi * (v.co.z - z) / 0.4)
        ob = mesh_from(bm, f'towel{k}', [CLOTH()], smooth=True)
        ob.location = (dx, dy, 0); ob.rotation_euler = (0, 0, rot)
        # the woven stripe band across the fold
        sb = rounded_box(0.36, 2.04, 0.41, 0.06, 2, z0=z - 0.005, x0=0.9)
        so = mesh_from(sb, f'stripe{k}', [STRIPE()], smooth=True)
        so.location = (dx, dy, 0); so.rotation_euler = (0, 0, rot)

def lathe(profile, m, segs=48, name='lathe', smooth=True):
    bm = bmesh.new(); rings = []
    for r, z in profile:
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for a in [i * 2 * math.pi / segs for i in range(segs)]])
    for a, b in zip(rings, rings[1:]):
        for i in range(segs): bm.faces.new((a[i], a[(i + 1) % segs], b[(i + 1) % segs], b[i]))
    if profile[0][0] > 0: bm.faces.new(rings[0][::-1])
    if profile[-1][0] > 0: bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from(bm, name, [m], smooth)

def bell():
    lathe([(0.95, 0.0), (0.95, 0.18), (0.9, 0.24), (0.0, 0.24)], BLACK(), name='bellbase')
    dome = [(0.82 * math.cos(t), 0.26 + 0.62 * math.sin(t)) for t in [i * (math.pi / 2) / 16 for i in range(17)]]
    lathe([(0.84, 0.24)] + dome, BRASS(), name='belldome')
    lathe([(0.07, 0.86), (0.07, 1.06), (0.16, 1.08), (0.16, 1.14), (0.0, 1.16)], BRASS(), name='bellknob', segs=24)

# ---------- export ----------
def material_params(m):
    b = m.node_tree.nodes['Principled BSDF']
    c = b.inputs['Base Color'].default_value
    to_s = lambda x: (1.055 * x ** (1 / 2.4) - 0.055) if x > 0.0031308 else x * 12.92
    out = {'name': m.name, 'c': '#' + ''.join('%02X' % max(0, min(255, round(to_s(v) * 255))) for v in c[:3]),
           'm': round(b.inputs['Metallic'].default_value, 2), 'r': round(b.inputs['Roughness'].default_value, 2)}
    if b.inputs['Coat Weight'].default_value > 0: out['k'] = round(b.inputs['Coat Weight'].default_value, 2)
    return out

def export_piece():
    import base64, struct
    dg = bpy.context.evaluated_depsgraph_get()
    groups = {}
    for o in bpy.data.objects:
        if o.type != 'MESH': continue
        ev = o.evaluated_get(dg); me = ev.to_mesh(); me.calc_loop_triangles()
        mw = o.matrix_world; nm = mw.to_3x3().inverted().transposed()
        mats = [ms.material for ms in o.material_slots]
        corner_n = [cn.vector.copy() for cn in me.corner_normals]
        for tri in me.loop_triangles:
            m = mats[tri.material_index] if tri.material_index < len(mats) else None
            key = m.name if m else 'none'
            g = groups.setdefault(key, {'mat': material_params(m), 'v': {}, 'pos': [], 'nor': [], 'idx': []})
            for li in tri.loops:
                vi = me.loops[li].vertex_index
                co = mw @ me.vertices[vi].co
                n = (nm @ corner_n[li]).normalized()
                k = (round(co.x, 4), round(co.y, 4), round(co.z, 4), round(n.x, 2), round(n.y, 2), round(n.z, 2))
                if k not in g['v']:
                    g['v'][k] = len(g['pos']) // 3; g['pos'] += [co.x, co.y, co.z]; g['nor'] += [n.x, n.y, n.z]
                g['idx'].append(g['v'][k])
        ev.to_mesh_clear()
    allp = [x for g in groups.values() for x in g['pos']]
    xs, ys, zs = allp[0::3], allp[1::3], allp[2::3]
    lo = [min(xs), min(ys), min(zs)]; hi = [max(xs), max(ys), max(zs)]
    out = {'lo': [round(v, 4) for v in lo], 'hi': [round(v, 4) for v in hi], 'g': []}
    for g in groups.values():
        q = []
        for i in range(0, len(g['pos']), 3):
            for a in range(3):
                span = (hi[a] - lo[a]) or 1
                q.append(int(round((g['pos'][i + a] - lo[a]) / span * 65535)) - 32768)
        pb = struct.pack('<%dh' % len(q), *q)
        nb = struct.pack('<%db' % len(g['nor']), *[max(-127, min(127, int(round(v * 127)))) for v in g['nor']])
        ib = struct.pack('<%dH' % len(g['idx']), *g['idx'])
        out['g'].append({'mat': g['mat'], 'p': base64.b64encode(pb).decode(), 'n': base64.b64encode(nb).decode(), 'i': base64.b64encode(ib).decode()})
    return out

PIECES = (('tile', tile), ('frame', frame), ('towels', towels), ('bell', bell))

def render_preview(outdir):
    os.makedirs(outdir, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.render.resolution_x = 512; sc.render.resolution_y = 384
    sc.render.film_transparent = True
    for name, fn in PIECES:
        clear(); fn()
        objs = [o for o in bpy.data.objects if o.type == 'MESH']
        pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
        ctr = sum(pts, Vector()) / len(pts); size = max((p - ctr).length for p in pts)
        cam = link(bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))); sc.camera = cam
        cam.location = ctr + Vector((size * 1.3, -size * 1.9, size * 1.5)); cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sun = link(bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))); sun.data.energy = 4; sun.rotation_euler = (0.8, 0.2, 0.6)
        world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
        world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.5, 0.45, 0.4, 1)
        sc.render.filepath = os.path.join(outdir, name + '.png'); bpy.ops.render.render(write_still=True)

if ARGS and ARGS[0] == 'export':
    data = {}
    for name, fn in PIECES:
        clear(); fn(); data[name] = export_piece()
    js = ('// GENERATED by art-src/blender/pieces.py (export mode). Do not edit.\n'
          '// Each piece: lo/hi bounds (board cells, z up) and groups of base64 int16 positions, int8 normals, uint16 indices.\n'
          'export const MESHES = ' + json.dumps(data, separators=(',', ':')) + ';\n')
    open(os.path.abspath(ARGS[1]), 'w', newline='\n').write(js)
    print('exported', len(data), 'pieces', round(len(js) / 1024, 1), 'KB')
elif ARGS and ARGS[0] == 'render':
    render_preview(os.path.abspath(ARGS[1]))
