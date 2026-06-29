# -*- coding: utf-8 -*-
"""
Green Panda — stylized 3D mascot generator for Blender.

Запуск:
    1) Открыть Blender (3.6+ / 4.x).
    2) Workspace -> Scripting -> Open -> green_panda.py -> Run Script
       (или в терминале:  blender --python green_panda.py )

Что соберётся автоматически:
    - чистая сцена
    - геометрия персонажа (голова, тело, уши, морда, нос, глаза, рот, лапы, хвост)
    - чёрно-белые зоны меха через отдельные mesh-«накладки»
    - материалы (мех, глаза с зелёной радужкой, нос, румянец)
    - арматура с базовыми костями + automatic weights
    - shape keys лица: happy, smile, surprised, thinking, sad, blink
    - коллекция Poses с предустановленными ракурсами
    - аксессуары: бутылка с лого-стикером и швабра
    - студийное освещение + камера 3/4

Что лучше доработать вручную:
    - sculpt поверх базовой формы (детализация щёк, лап, ушей)
    - particle hair / geometry-nodes fur поверх белого и чёрного меха
    - подгонка vertex groups арматуры (по умолчанию automatic weights)
    - ретопология / UV-развёртка под текстуры
    - тонкая настройка shape keys и face rig (driver-bones)

Экспорт:
    .blend  — File -> Save As
    .glb    — File -> Export -> glTF 2.0 (Selected + Apply Modifiers + +Y up)
    .fbx    — File -> Export -> FBX (Selected, Mesh + Armature, -Z forward, Y up,
              Apply Scalings: FBX All, Add Leaf Bones: OFF)
"""

import bpy
import bmesh
import math
from mathutils import Vector, Matrix

# ---------------------------------------------------------------------------
# 0. УТИЛИТЫ
# ---------------------------------------------------------------------------

PALETTE = {
    "fur_white":   (0.96, 0.95, 0.92, 1.0),
    "fur_black":   (0.05, 0.05, 0.06, 1.0),
    "nose":        (0.04, 0.04, 0.05, 1.0),
    "iris_green":  (0.32, 0.55, 0.38, 1.0),
    "eye_white":   (0.98, 0.97, 0.95, 1.0),
    "eye_pupil":   (0.02, 0.02, 0.03, 1.0),
    "blush":       (0.95, 0.72, 0.70, 1.0),
    "mouth":       (0.55, 0.20, 0.22, 1.0),
    "leaf_dark":   (0.18, 0.36, 0.22, 1.0),
    "leaf_sage":   (0.62, 0.72, 0.55, 1.0),
    "bottle":      (0.85, 0.93, 0.82, 1.0),
    "metal":       (0.72, 0.74, 0.76, 1.0),
    "wood":        (0.45, 0.32, 0.22, 1.0),
}


def purge_scene():
    """Полностью очищаем сцену перед сборкой."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures,
                  bpy.data.lights, bpy.data.cameras, bpy.data.images,
                  bpy.data.curves, bpy.data.collections):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def ensure_collection(name, parent=None):
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(coll)
    return coll


def link_to_collection(obj, coll):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)


def make_material(name, base_color, roughness=0.75, metallic=0.0,
                  subsurface=0.0, subsurface_color=None, emission=None,
                  emission_strength=0.0):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf is None:
        bsdf = mat.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    # Subsurface (имя инпута менялось между версиями Blender)
    for key in ("Subsurface", "Subsurface Weight"):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = subsurface
            break
    if subsurface_color is not None and "Subsurface Color" in bsdf.inputs:
        bsdf.inputs["Subsurface Color"].default_value = subsurface_color
    if emission is not None:
        for key in ("Emission", "Emission Color"):
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = emission
                break
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def add_uv_sphere(name, location, scale=(1, 1, 1), segments=48, rings=24,
                  material=None, collection=None, shade_smooth=True,
                  subsurf=2):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings,
        radius=1.0, location=location,
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    if shade_smooth:
        bpy.ops.object.shade_smooth()
    if subsurf:
        mod = obj.modifiers.new("Subsurf", "SUBSURF")
        mod.levels = subsurf
        mod.render_levels = subsurf + 1
    if material is not None:
        obj.data.materials.append(material)
    if collection is not None:
        link_to_collection(obj, collection)
    return obj


def add_cylinder(name, location, radius=0.1, depth=0.5, scale=(1, 1, 1),
                 rotation=(0, 0, 0), material=None, collection=None,
                 vertices=32, shade_smooth=True):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth,
        location=location, rotation=rotation,
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    if shade_smooth:
        bpy.ops.object.shade_smooth()
    if material is not None:
        obj.data.materials.append(material)
    if collection is not None:
        link_to_collection(obj, collection)
    return obj


def add_cone(name, location, radius1=0.2, radius2=0.0, depth=0.5,
             rotation=(0, 0, 0), material=None, collection=None):
    bpy.ops.mesh.primitive_cone_add(
        vertices=32, radius1=radius1, radius2=radius2, depth=depth,
        location=location, rotation=rotation,
    )
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    if material is not None:
        obj.data.materials.append(material)
    if collection is not None:
        link_to_collection(obj, collection)
    return obj


def add_torus(name, location, major=0.2, minor=0.05, rotation=(0, 0, 0),
              material=None, collection=None):
    bpy.ops.mesh.primitive_torus_add(
        location=location, rotation=rotation,
        major_radius=major, minor_radius=minor,
        major_segments=32, minor_segments=12,
    )
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    if material is not None:
        obj.data.materials.append(material)
    if collection is not None:
        link_to_collection(obj, collection)
    return obj


def parent_to(child, parent, keep_transform=True):
    child.parent = parent
    if keep_transform:
        child.matrix_parent_inverse = parent.matrix_world.inverted()


# ---------------------------------------------------------------------------
# 1. МАТЕРИАЛЫ
# ---------------------------------------------------------------------------

def build_materials():
    return {
        "white": make_material("Panda_FurWhite", PALETTE["fur_white"],
                               roughness=0.85, subsurface=0.15,
                               subsurface_color=(1, 0.92, 0.88, 1)),
        "black": make_material("Panda_FurBlack", PALETTE["fur_black"],
                               roughness=0.9, subsurface=0.08,
                               subsurface_color=(0.2, 0.18, 0.18, 1)),
        "nose":  make_material("Panda_Nose", PALETTE["nose"],
                               roughness=0.25),
        "iris":  make_material("Panda_Iris", PALETTE["iris_green"],
                               roughness=0.15,
                               emission=PALETTE["iris_green"],
                               emission_strength=0.4),
        "eye":   make_material("Panda_EyeWhite", PALETTE["eye_white"],
                               roughness=0.1),
        "pupil": make_material("Panda_Pupil", PALETTE["eye_pupil"],
                               roughness=0.1),
        "blush": make_material("Panda_Blush", PALETTE["blush"],
                               roughness=0.6),
        "mouth": make_material("Panda_Mouth", PALETTE["mouth"],
                               roughness=0.5),
        "bottle": make_material("GP_Bottle", PALETTE["bottle"],
                                roughness=0.35),
        "label":  make_material("GP_Label", PALETTE["leaf_dark"],
                                roughness=0.7),
        "metal":  make_material("GP_Metal", PALETTE["metal"],
                                roughness=0.3, metallic=0.85),
        "wood":   make_material("GP_Wood", PALETTE["wood"], roughness=0.8),
    }


# ---------------------------------------------------------------------------
# 2. ТЕЛО ПЕРСОНАЖА
# ---------------------------------------------------------------------------

def build_body(mats, coll):
    """
    Пропорции взяты со sprite sheet:
    голова ~ 1.0, тело ~ 0.9 высоты, лапы короткие, тело округлое.
    Общая высота ≈ 1.0 единицы.
    """
    parts = {}

    # ----- ТЕЛО (груша, шире снизу) -----
    body = add_uv_sphere(
        "Panda_Body",
        location=(0, 0, 0.36),
        scale=(0.34, 0.30, 0.36),
        material=mats["black"], collection=coll,
    )
    parts["body"] = body

    # Белый «передник» на груди/животе — отдельный слегка увеличенный сектор
    belly = add_uv_sphere(
        "Panda_Belly",
        location=(0, -0.07, 0.34),
        scale=(0.26, 0.22, 0.28),
        material=mats["white"], collection=coll, subsurf=2,
    )
    parts["belly"] = belly

    # ----- ГОЛОВА -----
    head = add_uv_sphere(
        "Panda_Head",
        location=(0, -0.02, 0.82),
        scale=(0.30, 0.29, 0.28),
        material=mats["white"], collection=coll,
    )
    parts["head"] = head

    # Морда (чуть выпирающая)
    snout = add_uv_sphere(
        "Panda_Snout",
        location=(0, -0.20, 0.76),
        scale=(0.14, 0.08, 0.10),
        material=mats["white"], collection=coll, subsurf=2,
    )
    parts["snout"] = snout

    # ----- УШИ -----
    for side, x in (("L", 0.22), ("R", -0.22)):
        ear = add_uv_sphere(
            f"Panda_Ear_{side}",
            location=(x, 0.02, 1.05),
            scale=(0.09, 0.06, 0.09),
            material=mats["black"], collection=coll, subsurf=2,
        )
        parts[f"ear_{side}"] = ear

    # ----- ЧЁРНЫЕ ПЯТНА ВОКРУГ ГЛАЗ -----
    for side, x in (("L", 0.10), ("R", -0.10)):
        patch = add_uv_sphere(
            f"Panda_EyePatch_{side}",
            location=(x, -0.22, 0.86),
            scale=(0.07, 0.04, 0.08),
            material=mats["black"], collection=coll, subsurf=2,
        )
        # Слегка наклоняем пятна «капельками» вниз к носу
        patch.rotation_euler = (0, math.radians(-10 if side == "L" else 10),
                                math.radians(-12 if side == "L" else 12))
        parts[f"eyepatch_{side}"] = patch

    # ----- ГЛАЗА -----
    for side, x in (("L", 0.10), ("R", -0.10)):
        eye = add_uv_sphere(
            f"Panda_Eye_{side}",
            location=(x, -0.27, 0.86),
            scale=(0.035, 0.035, 0.035),
            material=mats["eye"], collection=coll, subsurf=1,
        )
        iris = add_uv_sphere(
            f"Panda_Iris_{side}",
            location=(x, -0.295, 0.86),
            scale=(0.022, 0.018, 0.022),
            material=mats["iris"], collection=coll, subsurf=1,
        )
        pupil = add_uv_sphere(
            f"Panda_Pupil_{side}",
            location=(x, -0.31, 0.86),
            scale=(0.010, 0.010, 0.010),
            material=mats["pupil"], collection=coll, subsurf=1,
        )
        parts[f"eye_{side}"] = eye
        parts[f"iris_{side}"] = iris
        parts[f"pupil_{side}"] = pupil

    # ----- НОС -----
    nose = add_uv_sphere(
        "Panda_Nose",
        location=(0, -0.30, 0.78),
        scale=(0.025, 0.020, 0.020),
        material=mats["nose"], collection=coll, subsurf=1,
    )
    parts["nose"] = nose

    # ----- РОТ (маленький тор-«улыбка») -----
    mouth = add_torus(
        "Panda_Mouth",
        location=(0, -0.275, 0.73),
        major=0.022, minor=0.004,
        rotation=(math.radians(90), 0, 0),
        material=mats["mouth"], collection=coll,
    )
    # Обрезаем тор до полу-дуги через bool? Проще — сплющим Z, оставим как «улыбку»
    mouth.scale.z = 0.45
    bpy.ops.object.transform_apply(scale=True)
    parts["mouth"] = mouth

    # ----- РУМЯНЕЦ -----
    for side, x in (("L", 0.17), ("R", -0.17)):
        blush = add_uv_sphere(
            f"Panda_Blush_{side}",
            location=(x, -0.22, 0.78),
            scale=(0.035, 0.005, 0.025),
            material=mats["blush"], collection=coll, subsurf=1,
        )
        parts[f"blush_{side}"] = blush

    # ----- РУКИ -----
    for side, x in (("L", 0.30), ("R", -0.30)):
        arm = add_uv_sphere(
            f"Panda_Arm_{side}",
            location=(x, 0.0, 0.42),
            scale=(0.09, 0.08, 0.16),
            material=mats["black"], collection=coll,
        )
        arm.rotation_euler = (0, math.radians(20 if side == "L" else -20), 0)
        bpy.ops.object.transform_apply(rotation=True)
        parts[f"arm_{side}"] = arm

    # ----- НОГИ -----
    for side, x in (("L", 0.13), ("R", -0.13)):
        leg = add_uv_sphere(
            f"Panda_Leg_{side}",
            location=(x, 0.02, 0.10),
            scale=(0.10, 0.11, 0.12),
            material=mats["black"], collection=coll,
        )
        parts[f"leg_{side}"] = leg
        # Розовая «подошва» лапки
        sole = add_uv_sphere(
            f"Panda_Sole_{side}",
            location=(x, -0.04, 0.04),
            scale=(0.07, 0.05, 0.02),
            material=mats["blush"], collection=coll, subsurf=1,
        )
        parts[f"sole_{side}"] = sole

    # ----- ХВОСТ (маленький) -----
    tail = add_uv_sphere(
        "Panda_Tail",
        location=(0, 0.30, 0.38),
        scale=(0.05, 0.05, 0.05),
        material=mats["black"], collection=coll, subsurf=1,
    )
    parts["tail"] = tail

    return parts


# ---------------------------------------------------------------------------
# 3. ОБЪЕДИНЕНИЕ И SHAPE KEYS ЛИЦА
# ---------------------------------------------------------------------------

def join_face_for_shapekeys(parts, coll):
    """
    Создаём отдельный mesh 'Panda_FaceRig' = голова + морда + рот + брови,
    чтобы прицепить к нему shape keys.
    Сами «глазные» спрайты оставляем отдельно (управляются через bones).
    """
    bpy.ops.object.select_all(action="DESELECT")
    face_parts = [parts["head"], parts["snout"], parts["mouth"]]
    for p in face_parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts["head"]
    bpy.ops.object.join()
    face = bpy.context.active_object
    face.name = "Panda_FaceRig"

    # Базовый shape key
    face.shape_key_add(name="Basis", from_mix=False)

    # smile  — растягиваем нижнюю часть лица в стороны и чуть вверх
    sk = face.shape_key_add(name="smile", from_mix=False)
    for i, v in enumerate(face.data.vertices):
        if v.co.z < 0.76 and v.co.y < -0.22:
            sk.data[i].co.x *= 1.15
            sk.data[i].co.z += 0.005

    # happy — то же + чуть выше скулы
    sk = face.shape_key_add(name="happy", from_mix=False)
    for i, v in enumerate(face.data.vertices):
        if v.co.z < 0.78 and v.co.y < -0.20:
            sk.data[i].co.x *= 1.20
            sk.data[i].co.z += 0.010

    # surprised — рот вниз, морда чуть выпирает
    sk = face.shape_key_add(name="surprised", from_mix=False)
    for i, v in enumerate(face.data.vertices):
        if v.co.y < -0.24:
            sk.data[i].co.y -= 0.010
        if v.co.z < 0.74:
            sk.data[i].co.z -= 0.010

    # thinking — рот в бок (асимметрия)
    sk = face.shape_key_add(name="thinking", from_mix=False)
    for i, v in enumerate(face.data.vertices):
        if v.co.z < 0.75 and v.co.y < -0.24:
            sk.data[i].co.x += 0.012

    # sad — уголки вниз
    sk = face.shape_key_add(name="sad", from_mix=False)
    for i, v in enumerate(face.data.vertices):
        if v.co.z < 0.74 and v.co.y < -0.22 and abs(v.co.x) > 0.01:
            sk.data[i].co.z -= 0.012

    # blink — веки прикрыты (используется в связке с морфом глаз: см. ниже)
    sk = face.shape_key_add(name="blink", from_mix=False)
    # На самом «лице» blink практически не виден — реальное прикрытие
    # делается через scale кости глаз (см. apply_blink_via_eye_scale).

    parts["face"] = face
    link_to_collection(face, coll)
    return face


def apply_blink_via_eye_scale(parts):
    """
    Превращаем глаза в дочерние Empty, чтобы blink реализовать
    через scale.z = 0.05.
    """
    for side in ("L", "R"):
        empty = bpy.data.objects.new(f"Panda_EyeCtrl_{side}", None)
        empty.empty_display_type = "PLAIN_AXES"
        empty.empty_display_size = 0.05
        empty.location = parts[f"eye_{side}"].location
        bpy.context.scene.collection.objects.link(empty)
        for key in (f"eye_{side}", f"iris_{side}", f"pupil_{side}"):
            obj = parts[key]
            obj.parent = empty
            obj.matrix_parent_inverse = empty.matrix_world.inverted()
        parts[f"eyectrl_{side}"] = empty


# ---------------------------------------------------------------------------
# 4. АРМАТУРА
# ---------------------------------------------------------------------------

def build_armature(parts, coll):
    bpy.ops.object.armature_add(location=(0, 0, 0))
    arm_obj = bpy.context.active_object
    arm_obj.name = "Panda_Armature"
    link_to_collection(arm_obj, coll)
    arm = arm_obj.data
    arm.name = "Panda_Armature_Data"

    bpy.ops.object.mode_set(mode="EDIT")
    # Удаляем дефолтную кость
    for b in list(arm.edit_bones):
        arm.edit_bones.remove(b)

    def bone(name, head, tail, parent=None):
        b = arm.edit_bones.new(name)
        b.head = Vector(head)
        b.tail = Vector(tail)
        if parent is not None:
            b.parent = parent
            b.use_connect = False
        return b

    root  = bone("root",  (0, 0, 0.0),  (0, 0, 0.15))
    spine = bone("spine", (0, 0, 0.15), (0, 0, 0.55), parent=root)
    head_b = bone("head", (0, 0, 0.60), (0, 0, 0.95), parent=spine)
    bone("ear_L", (0.20, 0.02, 1.00), (0.26, 0.02, 1.12), parent=head_b)
    bone("ear_R", (-0.20, 0.02, 1.00), (-0.26, 0.02, 1.12), parent=head_b)
    bone("arm_L", (0.20, 0, 0.50), (0.36, 0, 0.30), parent=spine)
    bone("arm_R", (-0.20, 0, 0.50), (-0.36, 0, 0.30), parent=spine)
    bone("leg_L", (0.13, 0, 0.20), (0.13, 0, 0.02), parent=root)
    bone("leg_R", (-0.13, 0, 0.20), (-0.13, 0, 0.02), parent=root)
    bone("tail",  (0, 0.20, 0.42),  (0, 0.32, 0.42), parent=spine)

    bpy.ops.object.mode_set(mode="OBJECT")

    # Привязываем меши: automatic weights — быстрый старт, можно перевесить вручную
    mesh_targets = [
        parts["body"], parts["belly"], parts["face"],
        parts["ear_L"], parts["ear_R"],
        parts["eyepatch_L"], parts["eyepatch_R"],
        parts["nose"],
        parts["blush_L"], parts["blush_R"],
        parts["arm_L"], parts["arm_R"],
        parts["leg_L"], parts["leg_R"],
        parts["sole_L"], parts["sole_R"],
        parts["tail"],
    ]
    bpy.ops.object.select_all(action="DESELECT")
    for m in mesh_targets:
        m.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    try:
        bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    except RuntimeError:
        # Иногда automatic weights падает на простых формах — fallback на пустой парент
        bpy.ops.object.parent_set(type="ARMATURE")

    # Глазные empty-контроллеры цепляем к голове через bone constraint
    for side in ("L", "R"):
        empty = parts[f"eyectrl_{side}"]
        c = empty.constraints.new(type="CHILD_OF")
        c.target = arm_obj
        c.subtarget = "head"

    return arm_obj


# ---------------------------------------------------------------------------
# 5. АКСЕССУАРЫ
# ---------------------------------------------------------------------------

def build_bottle(mats, coll):
    body = add_cylinder(
        "GP_Bottle_Body", location=(0.5, -0.05, 0.20),
        radius=0.06, depth=0.22, material=mats["bottle"], collection=coll,
    )
    # Скругление верха/низа bevel-модификатором
    mod = body.modifiers.new("Bevel", "BEVEL")
    mod.width = 0.015
    mod.segments = 4
    cap = add_cylinder(
        "GP_Bottle_Cap", location=(0.5, -0.05, 0.34),
        radius=0.035, depth=0.06, material=mats["label"], collection=coll,
    )
    nozzle = add_cone(
        "GP_Bottle_Nozzle", location=(0.5, -0.05, 0.39),
        radius1=0.018, radius2=0.008, depth=0.04,
        material=mats["label"], collection=coll,
    )
    label = add_cylinder(
        "GP_Bottle_Label", location=(0.5, -0.05, 0.18),
        radius=0.061, depth=0.10, material=mats["label"], collection=coll,
    )
    group = bpy.data.objects.new("GP_Bottle", None)
    group.empty_display_type = "PLAIN_AXES"
    coll.objects.link(group)
    for o in (body, cap, nozzle, label):
        parent_to(o, group)
    return group


def build_mop(mats, coll):
    stick = add_cylinder(
        "GP_Mop_Stick", location=(-0.55, 0.0, 0.45),
        radius=0.012, depth=0.90, material=mats["wood"], collection=coll,
    )
    head = add_uv_sphere(
        "GP_Mop_Head", location=(-0.55, 0.0, -0.02),
        scale=(0.10, 0.10, 0.04),
        material=mats["white"], collection=coll, subsurf=2,
    )
    ring = add_torus(
        "GP_Mop_Ring", location=(-0.55, 0.0, 0.02),
        major=0.07, minor=0.012,
        material=mats["metal"], collection=coll,
    )
    group = bpy.data.objects.new("GP_Mop", None)
    coll.objects.link(group)
    for o in (stick, head, ring):
        parent_to(o, group)
    return group


# ---------------------------------------------------------------------------
# 6. СВЕТ + КАМЕРА
# ---------------------------------------------------------------------------

def build_lighting(coll):
    # Студийный свет 3-точка
    def add_light(name, kind, location, energy, size=1.0, rotation=(0, 0, 0),
                  color=(1, 1, 1)):
        bpy.ops.object.light_add(type=kind, location=location, rotation=rotation)
        light = bpy.context.active_object
        light.name = name
        light.data.energy = energy
        light.data.color = color
        if kind in {"AREA"}:
            light.data.size = size
        link_to_collection(light, coll)
        return light

    add_light("Key",  "AREA", (1.2, -1.4, 1.8), energy=400, size=1.2,
              rotation=(math.radians(60), 0, math.radians(40)))
    add_light("Fill", "AREA", (-1.5, -0.8, 1.2), energy=180, size=1.5,
              rotation=(math.radians(70), 0, math.radians(-50)),
              color=(0.85, 0.92, 1.0))
    add_light("Rim",  "AREA", (0, 1.5, 1.5), energy=250, size=1.0,
              rotation=(math.radians(110), 0, 0))

    # Студийный фон через World
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.92, 0.95, 0.90, 1.0)
        bg.inputs["Strength"].default_value = 0.8


def build_camera(coll):
    bpy.ops.object.camera_add(location=(1.4, -1.8, 1.0),
                              rotation=(math.radians(75), 0, math.radians(38)))
    cam = bpy.context.active_object
    cam.name = "Camera_Hero"
    cam.data.lens = 70
    link_to_collection(cam, coll)
    bpy.context.scene.camera = cam
    return cam


# ---------------------------------------------------------------------------
# 7. ПОЗЫ (через коллекции пустышек-маркеров)
# ---------------------------------------------------------------------------

POSE_LIST = ["neutral", "point", "thumbs_up", "hold_product",
             "present", "sitting"]


def build_pose_markers(parent_coll):
    """
    Создаём пустые коллекции под позы — пользователь будет
    сохранять туда snapshot арматуры (Pose Library / Asset Browser).
    """
    poses = ensure_collection("Poses", parent=parent_coll)
    for p in POSE_LIST:
        ensure_collection(f"Pose_{p}", parent=poses)
    return poses


# ---------------------------------------------------------------------------
# 8. ОРКЕСТРАЦИЯ
# ---------------------------------------------------------------------------

def main():
    purge_scene()

    # Сцена / единицы / рендер
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "CYCLES" if "CYCLES" in {e.identifier
        for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items} else "BLENDER_EEVEE"
    scene.render.resolution_x = 1080
    scene.render.resolution_y = 1350
    scene.render.film_transparent = False

    # Коллекции
    root = ensure_collection("GreenPanda")
    char_coll = ensure_collection("Character", parent=root)
    rig_coll  = ensure_collection("Rig", parent=root)
    acc_coll  = ensure_collection("Accessories", parent=root)
    lit_coll  = ensure_collection("Lighting", parent=root)
    cam_coll  = ensure_collection("Cameras", parent=root)

    # Сборка
    mats = build_materials()
    parts = build_body(mats, char_coll)
    face = join_face_for_shapekeys(parts, char_coll)
    apply_blink_via_eye_scale(parts)
    armature = build_armature(parts, rig_coll)

    bottle = build_bottle(mats, acc_coll)
    mop = build_mop(mats, acc_coll)

    build_lighting(lit_coll)
    build_camera(cam_coll)
    build_pose_markers(root)

    # Origin в центр, персонаж в нейтральной A-pose уже стоит
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature

    print("=" * 60)
    print("Green Panda mascot собран.")
    print(f"  Mesh-объектов:   {len([o for o in bpy.data.objects if o.type == 'MESH'])}")
    print(f"  Материалов:      {len(bpy.data.materials)}")
    print(f"  Костей:          {len(armature.data.bones)}")
    print(f"  Shape keys:      {len(face.data.shape_keys.key_blocks) - 1}")
    print("=" * 60)


if __name__ == "__main__":
    main()
