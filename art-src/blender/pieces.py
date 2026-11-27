# Bathhouse Letters: 3D pieces for the board table, built in Blender's Python and exported as compact meshes.
#   npm run build:meshes    (uses BLENDER_BIN env var, falling back to `blender` on PATH)
#   blender -b --factory-startup --python art-src/blender/pieces.py -- export src/js/pieces-mesh.js
#   (pass "render <dir>" instead of "export <file>" to render a preview of each piece with Cycles)
# Units are board cells (one square = 1). Pieces:
#   tile    a glazed ceramic tile, 0.9 x 0.9 x 0.24 with a soft bevel; its top faces use material 'tiletop', which the
#           game replaces with the letter texture (flat-crown [-0.38..+0.38] → [0..1] UVs are made in board3d.js)
#   frame   a mitred walnut moulding with a brass bead that wraps the 16 x 16 board slab
#   towels  one modular folded bathhouse linen towel corner (clamped z >= 0, box UVs) cropped off the left counter border
#   bell    a compact 1920s brass front-desk call bell (~2.1 cells diameter) on a chamfered warm-bronze plinth
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
BRONZE = lambda: mat('bronze', '#6B4C2E', 0.55, 0.34)   # no coat: the bell base is a MeshStandardMaterial (CD-WF6-01)

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
    # a faint crown on the glazed top: poke the flat top face so it has a centre vertex, and lift that a hair
    top = [f for f in bm.faces if f.normal.z > 0.99 and f.calc_center_median().z > 0.2]
    for v in bmesh.ops.poke(bm, faces=top)['verts']: v.co.z += 0.010
    bm.normal_update()
    for f in bm.faces: f.material_index = 0 if f.normal.z > 0.92 and f.calc_center_median().z > 0.2 else 1
    mesh_from(bm, 'tile', [TILETOP(), TILEBODY()], smooth=True)

def square_lathe(profile, mats_idx, name, mats):
    """A mitred square frame: each profile point (half-size, z) becomes a square ring; mats_idx gives each band's material."""
    bm = bmesh.new(); rings = []
    uv_layer = bm.loops.layers.uv.new('UVMap')
    arc = [0.0]
    for (s0, z0), (s1, z1) in zip(profile, profile[1:]):
        arc.append(arc[-1] + math.hypot(s1 - s0, z1 - z0))
    total_arc = arc[-1] or 1.0
    max_s = max(s for s, _ in profile) or 1.0
    for s, z in profile:
        rings.append([bm.verts.new((sx * s, sy * s, z)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    for k, (a, b) in enumerate(zip(rings, rings[1:])):
        v0 = arc[k] / total_arc
        v1 = arc[k + 1] / total_arc
        for i in range(4):
            f = bm.faces.new((a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]))
            f.material_index = mats_idx[k]
            # W3-S2-02: mitred along-rail UVs (U runs along rail length: X on south/north, Y on east/west;
            # V follows cumulative profile arc length so vertical inner/outer walls never collapse).
            for lp in f.loops:
                co = lp.vert.co
                along = co.x if i in (0, 2) else co.y
                u = max(0.0, min(1.0, (along + max_s) / (2.0 * max_s)))
                v = v0 if lp.vert in (a[i], a[(i + 1) % 4]) else v1
                lp[uv_layer].uv = (u, v)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from(bm, name, mats)

def frame():
    # board slab half-size 8 (16 cells: the 15 squares plus the painted border); the slab face sits at z = 0.3
    P = [(8.0, 0.0), (8.0, 0.36), (8.06, 0.44), (8.16, 0.46), (8.2, 0.52), (8.26, 0.56), (8.32, 0.52), (8.36, 0.46),
         (8.55, 0.42), (8.75, 0.34), (8.88, 0.22), (8.92, 0.1), (8.92, 0.0), (8.0, 0.0)]
    idx = [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]
    square_lathe(P, idx, 'frame', [WALNUT(), BRASS()])

def box_uvs(bm, scale=4.0):
    """Assign box/triplanar UVs in [0, 1] so cloth textures wrap cleanly around folded vertical sides."""
    uv_layer = bm.loops.layers.uv.new('UVMap')
    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    zs = [v.co.z for v in bm.verts]
    x0, y0, z0 = min(xs), min(ys), min(zs)
    span = max(max(xs) - x0, max(ys) - y0, max(zs) - z0, scale)
    for f in bm.faces:
        ax, ay, az = abs(f.normal.x), abs(f.normal.y), abs(f.normal.z)
        for lp in f.loops:
            co = lp.vert.co
            if az >= ax and az >= ay:
                u, v = (co.x - x0) / span, (co.y - y0) / span
            elif ax >= ay:
                u, v = (co.y - y0) / span, (co.z - z0) / span
            else:
                u, v = (co.x - x0) / span, (co.z - z0) / span
            lp[uv_layer].uv = (max(0.0, min(1.0, u)), max(0.0, min(1.0, v)))

def towels():
    # W3-S3-01 / CD-WF3-04: single modular folded linen towel corner (<= 300 tris, clamped z >= 0, box UVs)
    # scaled to true 1:1 human tabletop proportions (~12.3 x 17.6 cm folded corner, 1 cell = 2.2 cm) and
    # positioned off the left viewport border in board3d.js so its folded corner drapes naturally onto the counter.
    w, d, h = 5.6, 8.0, 0.56
    bm = rounded_box(w, d, h, 0.18, segs=2, z0=0.0)
    for v in bm.verts:
        # soft folded-edge roll along the visible inner right edge (+x) and near end (-y)
        if v.co.x > w * 0.42:
            v.co.x += 0.06 * math.sin(math.pi * max(0.0, min(1.0, v.co.z / h)))
        if v.co.z < 0.0:
            v.co.z = 0.0
    box_uvs(bm, scale=max(w, d))
    mesh_from(bm, 'towel0', [CLOTH()], smooth=True)
    # woven bathhouse stripe band near the far end (y0 = +2.25 in Blender, z0 strictly >= 0.0)
    sb = rounded_box(w + 0.06, 0.52, h + 0.012, 0.06, segs=1, z0=0.0, y0=2.25)
    for v in sb.verts:
        if v.co.z < 0.0:
            v.co.z = 0.0
    box_uvs(sb, scale=max(w, d))
    mesh_from(sb, 'stripe0', [STRIPE()], smooth=True)

def lathe(profile, m, segs=20, name='lathe', smooth=True, cap_bottom=True, cap_top=True):
    bm = bmesh.new(); rings = []
    for r, z in profile:
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for a in [i * 2 * math.pi / segs for i in range(segs)]])
    for a, b in zip(rings, rings[1:]):
        for i in range(segs): bm.faces.new((a[i], a[(i + 1) % segs], b[(i + 1) % segs], b[i]))
    if cap_bottom and profile[0][0] > 0: bm.faces.new(rings[0][::-1])
    if cap_top and profile[-1][0] > 0: bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from(bm, name, [m], smooth)

def bell():
    # W3-S3-01 / CD-WF3-04: compact 1920s front-desk call bell (~2.10 cells diameter, <= 400 tris, z >= 0)
    # on a chamfered warm-bronze plinth seated cleanly inside the right desktop counter margin.
    lathe([(1.05, 0.0), (1.05, 0.13), (0.96, 0.24), (0.86, 0.26)], BRONZE(), segs=18, name='bellbase', cap_bottom=False, cap_top=False)
    dome = [(0.88 * math.cos(t), 0.26 + 0.68 * math.sin(t)) for t in [i * (math.pi / 2) / 5 for i in range(5)]]
    dome.append((0.09, 0.94))
    lathe(dome, BRASS(), segs=18, name='belldome', cap_bottom=False, cap_top=False)
    lathe([(0.08, 0.92), (0.08, 1.08), (0.19, 1.12), (0.18, 1.19), (0.0, 1.21)], BRASS(), segs=12, name='bellknob', cap_bottom=False, cap_top=False)

# ---------- export ----------
def material_params(m):
    b = m.node_tree.nodes['Principled BSDF']
    c = b.inputs['Base Color'].default_value
    to_s = lambda x: (1.055 * x ** (1 / 2.4) - 0.055) if x > 0.0031308 else x * 12.92
    out = {'name': m.name, 'c': '#' + ''.join('%02X' % max(0, min(255, round(to_s(v) * 255))) for v in c[:3]),
           'm': round(b.inputs['Metallic'].default_value, 2), 'r': round(b.inputs['Roughness'].default_value, 2)}
    if b.inputs['Coat Weight'].default_value > 0:
        out['k'] = round(b.inputs['Coat Weight'].default_value, 2)
        out['kr'] = round(b.inputs['Coat Roughness'].default_value, 2)
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
        uv_layer = me.uv_layers.active.data if me.uv_layers.active else None
        for tri in me.loop_triangles:
            m = mats[tri.material_index] if tri.material_index < len(mats) else None
            key = m.name if m else 'none'
            g = groups.setdefault(key, {'mat': material_params(m), 'v': {}, 'pos': [], 'nor': [], 'uv': [], 'idx': []})
            for li in tri.loops:
                vi = me.loops[li].vertex_index
                co = mw @ me.vertices[vi].co
                n = (nm @ corner_n[li]).normalized()
                if uv_layer is not None:
                    uv = uv_layer[li].uv
                    ux = max(0.0, min(1.0, uv.x)); uy = max(0.0, min(1.0, uv.y))
                    k = (round(co.x, 4), round(co.y, 4), round(co.z, 4), round(n.x, 2), round(n.y, 2), round(n.z, 2), round(ux, 4), round(uy, 4))
                else:
                    k = (round(co.x, 4), round(co.y, 4), round(co.z, 4), round(n.x, 2), round(n.y, 2), round(n.z, 2))
                if k not in g['v']:
                    g['v'][k] = len(g['pos']) // 3; g['pos'] += [co.x, co.y, co.z]; g['nor'] += [n.x, n.y, n.z]
                    if uv_layer is not None: g['uv'] += [ux, uy]
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
        rec = {'mat': g['mat'], 'p': base64.b64encode(pb).decode(), 'n': base64.b64encode(nb).decode(), 'i': base64.b64encode(ib).decode()}
        if g['uv']:
            ub = struct.pack('<%dH' % len(g['uv']), *[max(0, min(65535, int(round(v * 65535)))) for v in g['uv']])
            rec['u'] = base64.b64encode(ub).decode()
        out['g'].append(rec)
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
