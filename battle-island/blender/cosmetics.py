"""
Benton Kids: Battle Island cosmetics, modelled in Blender.

Builds every pickaxe and back bling as its own object tree, exports them all
to one glTF binary, and bakes each weapon wrap to a PNG with Cycles.

Run with Blender 4.2+ (the app or the `bpy` Python module):
    blender --background --python battle-island/blender/cosmetics.py
    python battle-island/blender/cosmetics.py        # with `pip install bpy`

Outputs (the game imports these):
    battle-island/src/assets/cosmetics.glb      pickaxe_<id>, backbling_<id> nodes
    battle-island/src/assets/wraps/<id>.png     256x256 wrap textures

Axes: Blender is Z-up and glTF/three.js is Y-up (the exporter converts), so
  * pickaxes: grip at the origin, the shaft runs along -Y (the game's +Z),
    the head stands up along +Z;
  * back blings: the origin sits on the wearer's back, the bling sticks out
    along +Y (behind the character) and up along +Z.
Everything is low-poly and flat-coloured to match the game's toon look.
"""

import math
import os
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_GLB = os.path.join(HERE, '..', 'src', 'assets', 'cosmetics.glb')
OUT_WRAPS = os.path.join(HERE, '..', 'src', 'assets', 'wraps')
PI = math.pi

# ------------------------------------------------------------------ helpers
_mats = {}


def mat(color, emit=0.0, metal=0.0, rough=0.7):
    """A flat principled material (cached by its settings)."""
    key = (color, emit, metal, rough)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(f'm_{color.strip("#")}_{len(_mats)}')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    r, g, bl = (int(color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    b.inputs['Base Color'].default_value = (lin(r), lin(g), lin(bl), 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (lin(r), lin(g), lin(bl), 1)
        b.inputs['Emission Strength'].default_value = emit
    _mats[key] = m
    return m


def root(name):
    """An empty that groups one cosmetic (exported as a named glTF node)."""
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    return e


def part(parent, kind, color, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), bevel=0.0, smooth=False, sub=0, **kw):
    """Adds a primitive, colours it and parents it to the cosmetic's root."""
    op = {
        'cube': bpy.ops.mesh.primitive_cube_add,
        'cyl': bpy.ops.mesh.primitive_cylinder_add,
        'cone': bpy.ops.mesh.primitive_cone_add,
        'sphere': bpy.ops.mesh.primitive_uv_sphere_add,
        'ico': bpy.ops.mesh.primitive_ico_sphere_add,
        'torus': bpy.ops.mesh.primitive_torus_add,
    }[kind]
    op(location=loc, rotation=rot, **kw)
    o = bpy.context.active_object
    o.scale = scale
    o.data.materials.append(color if isinstance(color, bpy.types.Material) else mat(color))
    if bevel:
        m = o.modifiers.new('bevel', 'BEVEL')
        m.width = bevel
        m.segments = 2
        m.limit_method = 'ANGLE'
    if sub:
        m = o.modifiers.new('sub', 'SUBSURF')
        m.levels = sub
        m.render_levels = sub
    if smooth:
        bpy.ops.object.shade_smooth()
    o.parent = parent
    return o


def handle(r, length=0.82, color='#8a5a33', grip='#2c3440'):
    """A pickaxe shaft from the grip (origin) forward along -Y."""
    part(r, 'cyl', color, loc=(0, -length / 2, 0), rot=(PI / 2, 0, 0), radius=0.032, depth=length, vertices=10)
    part(r, 'cyl', grip, loc=(0, -0.08, 0), rot=(PI / 2, 0, 0), radius=0.038, depth=0.18, vertices=10)
    part(r, 'cyl', grip, loc=(0, 0.01, 0), rot=(PI / 2, 0, 0), radius=0.045, depth=0.03, vertices=10)


# ------------------------------------------------------------------ pickaxes
HEAD_Y = -0.78


def pickaxe_pickle():
    r = root('pickaxe_pickle')
    handle(r, color='#a0703f')
    # a big bumpy pickle as the head
    part(r, 'sphere', '#5bbf3a', loc=(0, HEAD_Y, 0.02), scale=(0.09, 0.1, 0.3), segments=16, ring_count=10, smooth=True)
    for i, z in enumerate((-0.2, -0.08, 0.05, 0.17)):
        for s in (-1, 1):
            part(r, 'ico', '#3f9a2a', loc=(0.075 * s, HEAD_Y + 0.02 * s, z), scale=(0.022, 0.022, 0.022), subdivisions=1)
    part(r, 'cyl', '#3f9a2a', loc=(0, HEAD_Y, 0.31), radius=0.025, depth=0.05, vertices=8)


def pickaxe_wrench():
    r = root('pickaxe_wrench')
    handle(r, color='#9fb2c4', grip='#e8453c')
    # an oversized adjustable wrench
    part(r, 'cube', '#c9d3dd', loc=(0, HEAD_Y, 0.02), scale=(0.035, 0.05, 0.2), bevel=0.01)
    part(r, 'cyl', '#c9d3dd', loc=(0, HEAD_Y, 0.25), radius=0.11, depth=0.07, vertices=20, rot=(0, PI / 2, 0))
    part(r, 'cube', '#2c3440', loc=(0, HEAD_Y, 0.31), scale=(0.04, 0.06, 0.07))  # the jaw gap
    part(r, 'cube', '#c9d3dd', loc=(0, HEAD_Y, -0.22), scale=(0.035, 0.07, 0.05), bevel=0.01)
    part(r, 'cyl', '#ffcf3f', loc=(0.04, HEAD_Y, 0.12), radius=0.02, depth=0.03, vertices=10, rot=(0, PI / 2, 0))


def pickaxe_lollipop():
    r = root('pickaxe_lollipop')
    handle(r, length=0.86, color='#f4f4f4', grip='#ff7ac8')
    part(r, 'cyl', '#ff7ac8', loc=(0, HEAD_Y - 0.06, 0.12), rot=(0, PI / 2, 0), radius=0.22, depth=0.07, vertices=28, bevel=0.015)
    # the swirl: rings in alternating colours
    for i, rad in enumerate((0.19, 0.14, 0.09, 0.045)):
        part(r, 'torus', '#ffffff' if i % 2 == 0 else '#39f0ff', loc=(0, HEAD_Y - 0.06, 0.12), rot=(0, PI / 2, 0), major_radius=rad, minor_radius=0.016, major_segments=24, minor_segments=6)
    part(r, 'cube', '#ff7ac8', loc=(0, HEAD_Y - 0.06, -0.12), scale=(0.03, 0.03, 0.08))


def pickaxe_dino():
    r = root('pickaxe_dino')
    handle(r, color='#f4efe6', grip='#8a5a33')
    # bone knobs where the handle ends
    for s in (-1, 1):
        part(r, 'sphere', '#f4efe6', loc=(0.03 * s, -0.86, 0), scale=(0.045, 0.045, 0.045), segments=10, ring_count=6)
    # two curved raptor-claw blades
    for s in (-1, 1):
        c = part(r, 'cone', '#ffe9c2', loc=(0, HEAD_Y, 0.16 * s), rot=(0 if s > 0 else PI, 0, 0), radius1=0.06, radius2=0.0, depth=0.3, vertices=8)
        c.rotation_euler[0] += 0.35 * s
    part(r, 'sphere', '#3fb24a', loc=(0, HEAD_Y, 0), scale=(0.07, 0.07, 0.09), segments=12, ring_count=8)


def pickaxe_crankbolt():
    r = root('pickaxe_crankbolt')
    handle(r, color='#4a5566', grip='#ff8a3d')
    # a little robot claw arm with a glowing eye
    part(r, 'cube', '#ff8a3d', loc=(0, HEAD_Y, 0), scale=(0.07, 0.07, 0.09), bevel=0.012)
    part(r, 'sphere', '#39f0ff', loc=(0, HEAD_Y - 0.07, 0.02), scale=(0.035, 0.02, 0.035), segments=12, ring_count=8)
    for s in (-1, 1):
        a = part(r, 'cube', '#9fb2c4', loc=(0, HEAD_Y, 0.2 * s), scale=(0.025, 0.03, 0.12), bevel=0.006)
        a.rotation_euler[1] = 0.25 * s
        part(r, 'cone', '#c9d3dd', loc=(0, HEAD_Y, 0.34 * s), rot=(0 if s > 0 else PI, 0, 0), radius1=0.035, radius2=0, depth=0.1, vertices=6)


def pickaxe_star():
    r = root('pickaxe_star')
    handle(r, length=0.86, color='#6a3fd0', grip='#ffcf3f')
    # a golden five-point star (a 5-sided cylinder with spikes)
    centre = (0, HEAD_Y - 0.05, 0.1)
    part(r, 'cyl', '#ffcf3f', loc=centre, rot=(PI / 2, 0, 0), radius=0.09, depth=0.06, vertices=5)
    for i in range(5):
        a = i * 2 * PI / 5 + PI / 2
        x, z = math.cos(a) * 0.14, math.sin(a) * 0.14
        sp = part(r, 'cone', '#ffcf3f', loc=(x, centre[1], centre[2] + z), radius1=0.05, radius2=0, depth=0.12, vertices=4)
        sp.rotation_euler = (0, -(a - PI / 2), 0)
    part(r, 'ico', mat('#ff7ac8', emit=0.6), loc=(0, centre[1] - 0.035, centre[2]), scale=(0.035, 0.035, 0.035), subdivisions=1)


# ------------------------------------------------------------------ back blings
def bling_dino():
    r = root('backbling_dino')
    # a plush dino riding in a little pack
    part(r, 'cube', '#ffe066', loc=(0, 0.08, 0), scale=(0.15, 0.08, 0.15), bevel=0.03)
    part(r, 'sphere', '#3fb24a', loc=(0, 0.14, 0.12), scale=(0.13, 0.11, 0.13), segments=14, ring_count=10, smooth=True)
    part(r, 'sphere', '#3fb24a', loc=(0, 0.2, 0.3), scale=(0.09, 0.1, 0.08), segments=14, ring_count=10, smooth=True)
    for s in (-1, 1):
        part(r, 'sphere', '#ffffff', loc=(0.045 * s, 0.27, 0.32), scale=(0.025, 0.02, 0.025), segments=8, ring_count=6)
        part(r, 'sphere', '#1d1d1d', loc=(0.045 * s, 0.285, 0.32), scale=(0.012, 0.01, 0.012), segments=8, ring_count=6)
    for i in range(4):
        part(r, 'cone', '#ffcf3f', loc=(0, 0.07 + i * 0.03, 0.38 - i * 0.09), rot=(-0.6, 0, 0), radius1=0.03, radius2=0, depth=0.07, vertices=4)
    tail = part(r, 'cone', '#3fb24a', loc=(0.12, 0.17, 0.0), rot=(0, 1.2, 0), radius1=0.04, radius2=0.01, depth=0.16, vertices=8)


def bling_picklejar():
    r = root('backbling_picklejar')
    glass = mat('#bfefff', metal=0.0, rough=0.15)
    part(r, 'cyl', glass, loc=(0, 0.13, 0.02), radius=0.12, depth=0.34, vertices=18)
    part(r, 'cyl', '#ff5c5c', loc=(0, 0.13, 0.215), radius=0.125, depth=0.05, vertices=18, bevel=0.01)
    for i, (x, y) in enumerate(((-0.05, 0.1), (0.05, 0.16), (0.0, 0.09), (0.04, 0.08))):
        part(r, 'sphere', '#5bbf3a', loc=(x, y, -0.02 + (i % 2) * 0.07), scale=(0.035, 0.035, 0.1), segments=10, ring_count=6, smooth=True)
    part(r, 'cube', '#ffffff', loc=(0, 0.25, 0.03), scale=(0.08, 0.005, 0.05))  # label
    part(r, 'cube', '#2f6fb0', loc=(0, 0.256, 0.03), scale=(0.05, 0.004, 0.012))


def bling_minibolt():
    r = root('backbling_minibolt')
    part(r, 'cube', '#ff8a3d', loc=(0, 0.12, 0), scale=(0.12, 0.09, 0.13), bevel=0.02)
    part(r, 'cube', '#4a5566', loc=(0, 0.12, 0.2), scale=(0.09, 0.08, 0.07), bevel=0.015)
    for s in (-1, 1):
        part(r, 'sphere', mat('#39f0ff', emit=1.2), loc=(0.04 * s, 0.205, 0.21), scale=(0.022, 0.012, 0.022), segments=10, ring_count=6)
        arm = part(r, 'cyl', '#9fb2c4', loc=(0.16 * s, 0.12, 0.02), radius=0.025, depth=0.16, vertices=8)
        arm.rotation_euler = (0, 0.5 * s, 0)
        part(r, 'sphere', '#c9d3dd', loc=(0.2 * s, 0.12, -0.05), scale=(0.035, 0.035, 0.035), segments=8, ring_count=6)
    part(r, 'cyl', '#c9d3dd', loc=(0, 0.12, 0.31), radius=0.008, depth=0.08, vertices=6)
    part(r, 'sphere', mat('#ff4b4b', emit=1.0), loc=(0, 0.12, 0.36), scale=(0.02, 0.02, 0.02), segments=8, ring_count=6)


def bling_chest():
    r = root('backbling_chest')
    part(r, 'cube', '#a0703f', loc=(0, 0.11, -0.02), scale=(0.17, 0.1, 0.11), bevel=0.01)
    lid = part(r, 'cyl', '#8a5a33', loc=(0, 0.11, 0.09), rot=(0, PI / 2, 0), radius=0.1, depth=0.34, vertices=12)
    lid.scale = (1, 1, 1)
    for x in (-0.12, 0.12):
        part(r, 'cube', '#ffcf3f', loc=(x, 0.11, 0.03), scale=(0.015, 0.105, 0.16))
    part(r, 'cube', '#ffcf3f', loc=(0, 0.215, 0.05), scale=(0.03, 0.01, 0.035))
    part(r, 'ico', mat('#ffe45c', emit=0.8), loc=(0, 0.05, 0.19), scale=(0.03, 0.03, 0.03), subdivisions=1)


def bling_rocket():
    r = root('backbling_rocket')
    part(r, 'cyl', '#f4f4f4', loc=(0, 0.13, 0.04), radius=0.08, depth=0.36, vertices=16)
    part(r, 'cone', '#e8453c', loc=(0, 0.13, 0.3), radius1=0.08, radius2=0, depth=0.16, vertices=16)
    part(r, 'cyl', '#3f9bff', loc=(0, 0.21, 0.1), rot=(PI / 2, 0, 0), radius=0.035, depth=0.01, vertices=14)
    for i in range(3):
        a = i * 2 * PI / 3
        fin = part(r, 'cube', '#e8453c', loc=(math.cos(a) * 0.09, 0.13 + math.sin(a) * 0.09, -0.11), scale=(0.01, 0.05, 0.06))
        fin.rotation_euler = (0, 0, a)
    part(r, 'cone', mat('#ffae1a', emit=1.5), loc=(0, 0.13, -0.19), rot=(PI, 0, 0), radius1=0.05, radius2=0, depth=0.1, vertices=10)


def bling_shield():
    r = root('backbling_shield')
    part(r, 'cyl', '#3f7bff', loc=(0, 0.06, 0.02), rot=(PI / 2, 0, 0), radius=0.22, depth=0.04, vertices=28, bevel=0.01)
    part(r, 'torus', '#ffcf3f', loc=(0, 0.085, 0.02), rot=(PI / 2, 0, 0), major_radius=0.21, minor_radius=0.018, major_segments=28, minor_segments=6)
    # a star in the middle
    part(r, 'cyl', '#ffcf3f', loc=(0, 0.09, 0.02), rot=(PI / 2, 0, 0), radius=0.06, depth=0.02, vertices=5)
    for i in range(5):
        a = i * 2 * PI / 5 + PI / 2
        sp = part(r, 'cone', '#ffcf3f', loc=(math.cos(a) * 0.09, 0.09, 0.02 + math.sin(a) * 0.09), radius1=0.035, radius2=0, depth=0.08, vertices=4)
        sp.rotation_euler = (0, -(a - PI / 2), 0)


# ------------------------------------------------------------------ wraps (baked textures)
def wrap_material(name, build):
    """A material whose Emission is a procedural pattern, with an image node to bake into."""
    m = bpy.data.materials.new(f'wrap_{name}')
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(em.outputs[0], out.inputs[0])
    coord = nt.nodes.new('ShaderNodeTexCoord')
    color = build(nt, coord.outputs['UV'])
    nt.links.new(color, em.inputs['Color'])
    img = bpy.data.images.new(name, 256, 256)
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nt.nodes.active = tex
    return m, img


def ramp(nt, fac, stops):
    r = nt.nodes.new('ShaderNodeValToRGB')
    el = r.color_ramp.elements
    while len(el) > len(stops):
        el.remove(el[-1])
    while len(el) < len(stops):
        el.new(0.5)
    for e, (pos, col) in zip(el, stops):
        e.position = pos
        rr, g, b = (int(col[i:i + 2], 16) / 255 for i in (1, 3, 5))
        e.color = (rr ** 2.2, g ** 2.2, b ** 2.2, 1)
    nt.links.new(fac, r.inputs['Fac'])
    return r.outputs['Color']


def noise(nt, vec, scale, detail=4):
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = detail
    nt.links.new(vec, n.inputs['Vector'])
    return n.outputs['Fac']


def voronoi(nt, vec, scale, feature='F1', out='Distance'):
    v = nt.nodes.new('ShaderNodeTexVoronoi')
    v.feature = feature
    v.inputs['Scale'].default_value = scale
    nt.links.new(vec, v.inputs['Vector'])
    return v.outputs[out]


def mix(nt, fac, a, b):
    m = nt.nodes.new('ShaderNodeMix')
    m.data_type = 'RGBA'
    nt.links.new(fac, m.inputs['Factor'])
    nt.links.new(a, m.inputs[6])
    nt.links.new(b, m.inputs[7])
    return m.outputs[2]


WRAPS = {
    # name: pattern builder (node tree, uv) -> color socket
    'camo': lambda nt, uv: ramp(nt, noise(nt, uv, 4.0, 3), [(0.0, '#2f4a2a'), (0.42, '#2f4a2a'), (0.43, '#5f7a3a'), (0.55, '#5f7a3a'), (0.56, '#8a7a4a'), (0.66, '#8a7a4a'), (0.67, '#3a2f22'), (1.0, '#3a2f22')]),
    'galaxy': lambda nt, uv: mix(nt, ramp(nt, voronoi(nt, uv, 18.0), [(0.0, '#ffffff'), (0.06, '#000000'), (1.0, '#000000')]),
                                  ramp(nt, noise(nt, uv, 3.0, 6), [(0.0, '#0b0b2a'), (0.5, '#3a1d6a'), (0.75, '#1d3a8a'), (1.0, '#ff5ca8')]),
                                  ramp(nt, noise(nt, uv, 40.0, 0), [(0.0, '#ffffff'), (1.0, '#ffffff')])),
    'candy': lambda nt, uv: ramp(nt, wave(nt, uv, 6.0), [(0.0, '#ff4f7a'), (0.48, '#ff4f7a'), (0.5, '#ffffff'), (0.98, '#ffffff'), (1.0, '#ff4f7a')]),
    'pickle': lambda nt, uv: mix(nt, ramp(nt, voronoi(nt, uv, 10.0), [(0.0, '#ffffff'), (0.18, '#ffffff'), (0.22, '#000000'), (1.0, '#000000')]),
                                  ramp(nt, noise(nt, uv, 5.0, 3), [(0.0, '#3f9a2a'), (1.0, '#6fd04a')]),
                                  ramp(nt, noise(nt, uv, 9.0, 1), [(0.0, '#2f7a20'), (1.0, '#2f7a20')])),
    'gold': lambda nt, uv: ramp(nt, noise(nt, uv, 6.0, 8), [(0.0, '#8a5a12'), (0.35, '#ffae1a'), (0.6, '#ffe45c'), (0.8, '#fff6c2'), (1.0, '#ffae1a')]),
    'lava': lambda nt, uv: ramp(nt, voronoi(nt, uv, 7.0, 'DISTANCE_TO_EDGE'), [(0.0, '#ffe45c'), (0.04, '#ff5a1a'), (0.09, '#5a1a0a'), (0.14, '#1d1414'), (1.0, '#2a1d1d')]),
}


def wave(nt, vec, scale):
    w = nt.nodes.new('ShaderNodeTexWave')
    w.wave_type = 'BANDS'
    w.bands_direction = 'DIAGONAL'
    w.inputs['Scale'].default_value = scale
    w.inputs['Distortion'].default_value = 0
    nt.links.new(vec, w.inputs['Vector'])
    m = nt.nodes.new('ShaderNodeMath')
    m.operation = 'FRACT'
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = 1.0
    nt.links.new(w.outputs['Fac'], mul.inputs[0])
    nt.links.new(mul.outputs[0], m.inputs[0])
    return m.outputs[0]


def bake_wraps():
    os.makedirs(OUT_WRAPS, exist_ok=True)
    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'
    scn.cycles.device = 'CPU'
    scn.cycles.samples = 1
    bpy.ops.mesh.primitive_plane_add(size=2)
    plane = bpy.context.active_object
    for name, build in WRAPS.items():
        m, img = wrap_material(name, build)
        plane.data.materials.clear()
        plane.data.materials.append(m)
        bpy.ops.object.select_all(action='DESELECT')
        plane.select_set(True)
        bpy.context.view_layer.objects.active = plane
        bpy.ops.object.bake(type='EMIT', width=256, height=256, margin=0)
        img.filepath_raw = os.path.join(OUT_WRAPS, f'{name}.png')
        img.file_format = 'PNG'
        img.save()
        print('baked wrap', name)
    bpy.data.objects.remove(plane)


# ------------------------------------------------------------------ main
def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for fn in (pickaxe_pickle, pickaxe_wrench, pickaxe_lollipop, pickaxe_dino, pickaxe_crankbolt, pickaxe_star,
               bling_dino, bling_picklejar, bling_minibolt, bling_chest, bling_rocket, bling_shield):
        fn()
    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format='GLB', export_apply=True, export_yup=True, export_texcoords=False, export_normals=True, export_materials='EXPORT', export_cameras=False, export_lights=False)
    print('exported', OUT_GLB, os.path.getsize(OUT_GLB), 'bytes')
    bake_wraps()


main()
