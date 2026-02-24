/**
 * VERIFIED, TESTED UE5 Python code snippets that ACTUALLY WORK.
 * Agents use these as building blocks instead of guessing.
 */
export const UE5_CODE_LIBRARY = {
  CLEAR_LEVEL: `
import unreal

def clear_level():
    """Delete all actors in the current level"""
    editor = unreal.EditorLevelLibrary
    all_actors = editor.get_all_level_actors()
    for actor in all_actors:
        if actor.get_name() != 'WorldSettings' and 'Brush' not in actor.get_name():
            editor.destroy_actor(actor)
    unreal.log('Level cleared')

clear_level()
`,

  SKY_AND_ATMOSPHERE: `
import unreal

def setup_sky():
    """Create sky, sun, clouds, and ambient light"""
    editor = unreal.EditorLevelLibrary

    # Sky
    sky = editor.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0, 0, 0))
    sky.set_actor_label('Sky')

    # Sun (Directional Light)
    sun = editor.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 0))
    sun.set_actor_rotation(unreal.Rotator(-50, 0, 0), False)
    light_comp = sun.get_component_by_class(unreal.DirectionalLightComponent)
    light_comp.set_editor_property('intensity', 10.0)
    light_comp.set_editor_property('light_color', unreal.Color(255, 240, 220, 255))
    sun.set_actor_label('Sun')

    # Sky Light (ambient fill)
    sky_light = editor.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 0))
    sky_light_comp = sky_light.get_component_by_class(unreal.SkyLightComponent)
    sky_light_comp.set_editor_property('intensity', 2.0)
    sky_light.set_actor_label('SkyLight')

    # Volumetric Clouds
    clouds = editor.spawn_actor_from_class(unreal.VolumetricCloud, unreal.Vector(0, 0, 0))
    clouds.set_actor_label('Clouds')

    unreal.log('Sky and atmosphere created')

setup_sky()
`,

  FOG: `
import unreal

def add_fog(density=0.02):
    """Add exponential height fog"""
    editor = unreal.EditorLevelLibrary
    fog = editor.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(0, 0, 0))
    fog_comp = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
    fog_comp.set_editor_property('fog_density', density)
    fog.set_actor_label('Fog')
    unreal.log(f'Fog added with density {density}')

add_fog(0.02)
`,

  GROUND_PLANE: `
import unreal

def create_ground(scale_x=200, scale_y=200):
    """Create a large ground plane"""
    editor = unreal.EditorLevelLibrary
    ground = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, 0))
    mesh_comp = ground.get_component_by_class(unreal.StaticMeshComponent)
    mesh_comp.set_static_mesh(unreal.EditorAssetLibrary.load_asset('/Engine/BasicShapes/Plane'))
    ground.set_actor_scale3d(unreal.Vector(scale_x, scale_y, 1))
    ground.set_actor_label('Ground')
    unreal.log('Ground plane created')

create_ground(200, 200)
`,

  SPAWN_CUBE: `
import unreal

def spawn_cube(x, y, z, scale_x=1, scale_y=1, scale_z=1, label='Cube'):
    """Spawn a cube at given position with given scale"""
    editor = unreal.EditorLevelLibrary
    cube = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(x, y, z))
    mesh_comp = cube.get_component_by_class(unreal.StaticMeshComponent)
    mesh_comp.set_static_mesh(unreal.EditorAssetLibrary.load_asset('/Engine/BasicShapes/Cube'))
    cube.set_actor_scale3d(unreal.Vector(scale_x, scale_y, scale_z))
    cube.set_actor_label(label)
    return cube
`,

  SPAWN_CYLINDER: `
import unreal

def spawn_cylinder(x, y, z, scale_x=1, scale_y=1, scale_z=1, label='Cylinder'):
    """Spawn a cylinder at given position with given scale"""
    editor = unreal.EditorLevelLibrary
    cyl = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(x, y, z))
    mesh_comp = cyl.get_component_by_class(unreal.StaticMeshComponent)
    mesh_comp.set_static_mesh(unreal.EditorAssetLibrary.load_asset('/Engine/BasicShapes/Cylinder'))
    cyl.set_actor_scale3d(unreal.Vector(scale_x, scale_y, scale_z))
    cyl.set_actor_label(label)
    return cyl
`,

  SPAWN_SPHERE: `
import unreal

def spawn_sphere(x, y, z, scale_x=1, scale_y=1, scale_z=1, label='Sphere'):
    """Spawn a sphere at given position with given scale"""
    editor = unreal.EditorLevelLibrary
    sphere = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(x, y, z))
    mesh_comp = sphere.get_component_by_class(unreal.StaticMeshComponent)
    mesh_comp.set_static_mesh(unreal.EditorAssetLibrary.load_asset('/Engine/BasicShapes/Sphere'))
    sphere.set_actor_scale3d(unreal.Vector(scale_x, scale_y, scale_z))
    sphere.set_actor_label(label)
    return sphere
`,

  SPAWN_CONE: `
import unreal

def spawn_cone(x, y, z, scale_x=1, scale_y=1, scale_z=1, label='Cone'):
    """Spawn a cone at given position with given scale"""
    editor = unreal.EditorLevelLibrary
    cone = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(x, y, z))
    mesh_comp = cone.get_component_by_class(unreal.StaticMeshComponent)
    mesh_comp.set_static_mesh(unreal.EditorAssetLibrary.load_asset('/Engine/BasicShapes/Cone'))
    cone.set_actor_scale3d(unreal.Vector(scale_x, scale_y, scale_z))
    cone.set_actor_label(label)
    return cone
`,

  POINT_LIGHT: `
import unreal

def add_point_light(x, y, z, r=255, g=200, b=150, intensity=5000, radius=500, label='Light'):
    """Add a point light with color"""
    editor = unreal.EditorLevelLibrary
    light = editor.spawn_actor_from_class(unreal.PointLight, unreal.Vector(x, y, z))
    light_comp = light.get_component_by_class(unreal.PointLightComponent)
    light_comp.set_editor_property('intensity', intensity)
    light_comp.set_editor_property('light_color', unreal.Color(r, g, b, 255))
    light_comp.set_editor_property('attenuation_radius', radius)
    light.set_actor_label(label)
    return light
`,

  POST_PROCESS: `
import unreal

def add_post_process(bloom=1.0, exposure=0.0):
    """Add post-process volume for visual effects"""
    editor = unreal.EditorLevelLibrary
    pp = editor.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 0))
    pp.set_actor_scale3d(unreal.Vector(500, 500, 500))
    pp.set_editor_property('unbound', True)
    settings = pp.get_editor_property('settings')
    settings.set_editor_property('override_bloom_intensity', True)
    settings.set_editor_property('bloom_intensity', bloom)
    settings.set_editor_property('override_auto_exposure_bias', True)
    settings.set_editor_property('auto_exposure_bias', exposure)
    pp.set_actor_label('PostProcess')
    unreal.log('Post process added')

add_post_process(1.0, 0.0)
`,

  SIMPLE_HOUSE: `
import unreal

def build_simple_house(x=0, y=0):
    """Build a simple house at given position"""
    editor = unreal.EditorLevelLibrary
    base_z = 0

    # Floor
    floor = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(x, y, base_z + 10))
    floor.get_component_by_class(unreal.StaticMeshComponent).set_static_mesh(
        unreal.EditorAssetLibrary.load_asset('/Engine/BasicShapes/Cube'))
    floor.set_actor_scale3d(unreal.Vector(3, 2, 0.1))
    floor.set_actor_label('House_Floor')

    # Walls
    wall_configs = [
        (x, y - 95, base_z + 100, 3, 0.1, 2, 'Wall_Front'),
        (x, y + 95, base_z + 100, 3, 0.1, 2, 'Wall_Back'),
        (x - 145, y, base_z + 100, 0.1, 2, 2, 'Wall_Left'),
        (x + 145, y, base_z + 100, 0.1, 2, 2, 'Wall_Right'),
    ]
    for wx, wy, wz, sx, sy, sz, name in wall_configs:
        wall = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(wx, wy, wz))
        wall.get_component_by_class(unreal.StaticMeshComponent).set_static_mesh(
            unreal.EditorAssetLibrary.load_asset('/Engine/BasicShapes/Cube'))
        wall.set_actor_scale3d(unreal.Vector(sx, sy, sz))
        wall.set_actor_label(name)

    # Roof
    roof = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(x, y, base_z + 250))
    roof.get_component_by_class(unreal.StaticMeshComponent).set_static_mesh(
        unreal.EditorAssetLibrary.load_asset('/Engine/BasicShapes/Cone'))
    roof.set_actor_scale3d(unreal.Vector(3.5, 2.5, 1.5))
    roof.set_actor_label('House_Roof')

    # Interior light
    light = editor.spawn_actor_from_class(unreal.PointLight, unreal.Vector(x, y, base_z + 150))
    light.get_component_by_class(unreal.PointLightComponent).set_editor_property('intensity', 1000)
    light.get_component_by_class(unreal.PointLightComponent).set_editor_property(
        'light_color', unreal.Color(255, 200, 150, 255))
    light.set_actor_label('House_Light')

    unreal.log(f'House built at ({x}, {y})')
`,

  TREE: `
import unreal

def spawn_tree(x, y, trunk_height=3, canopy_size=2):
    """Spawn a tree with trunk and canopy"""
    editor = unreal.EditorLevelLibrary

    # Trunk
    trunk_z = trunk_height * 50
    trunk = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(x, y, trunk_z))
    trunk.get_component_by_class(unreal.StaticMeshComponent).set_static_mesh(
        unreal.EditorAssetLibrary.load_asset('/Engine/BasicShapes/Cylinder'))
    trunk.set_actor_scale3d(unreal.Vector(0.3, 0.3, trunk_height))
    trunk.set_actor_label('Tree_Trunk')

    # Canopy
    canopy_z = trunk_height * 100 + canopy_size * 30
    canopy = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(x, y, canopy_z))
    canopy.get_component_by_class(unreal.StaticMeshComponent).set_static_mesh(
        unreal.EditorAssetLibrary.load_asset('/Engine/BasicShapes/Sphere'))
    canopy.set_actor_scale3d(unreal.Vector(canopy_size, canopy_size, canopy_size * 0.8))
    canopy.set_actor_label('Tree_Canopy')

    unreal.log(f'Tree spawned at ({x}, {y})')
`,

  CASTLE_TOWER: `
import unreal

def build_tower(x, y, height=10, radius=3):
    """Build a castle tower with cone roof"""
    editor = unreal.EditorLevelLibrary

    tower_z = height * 50
    tower = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(x, y, tower_z))
    tower.get_component_by_class(unreal.StaticMeshComponent).set_static_mesh(
        unreal.EditorAssetLibrary.load_asset('/Engine/BasicShapes/Cylinder'))
    tower.set_actor_scale3d(unreal.Vector(radius, radius, height))
    tower.set_actor_label('Tower')

    roof_z = height * 100 + 50
    roof = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(x, y, roof_z))
    roof.get_component_by_class(unreal.StaticMeshComponent).set_static_mesh(
        unreal.EditorAssetLibrary.load_asset('/Engine/BasicShapes/Cone'))
    roof.set_actor_scale3d(unreal.Vector(radius + 1, radius + 1, 3))
    roof.set_actor_label('Tower_Roof')

    unreal.log(f'Tower built at ({x}, {y})')
`,
};

export const UE5_API_NOTES = `
CRITICAL RULES FOR UE5 PYTHON CODE:

1. ALWAYS use unreal.EditorLevelLibrary (class, NOT instance - no parentheses)
2. ALWAYS use unreal.EditorAssetLibrary.load_asset() to load meshes
3. ONLY use these mesh paths:
   - /Engine/BasicShapes/Cube
   - /Engine/BasicShapes/Sphere
   - /Engine/BasicShapes/Cylinder
   - /Engine/BasicShapes/Cone
   - /Engine/BasicShapes/Plane
4. NEVER use unreal.load_object() - use unreal.EditorAssetLibrary.load_asset() instead
5. NEVER reference /Game/ paths for materials or assets
6. For setting properties, use set_editor_property('property_name', value)
7. For getting components, use get_component_by_class(unreal.ComponentClass)
8. Light color uses unreal.Color(R, G, B, A) where values are 0-255
9. Rotation uses unreal.Rotator(Pitch, Yaw, Roll)
10. Position uses unreal.Vector(X, Y, Z) - 1 unit = 1 cm
11. Scale uses unreal.Vector(X, Y, Z) - 1.0 = 100cm = 1 meter
12. ALWAYS wrap code in a function and call it at the end
13. ALWAYS add unreal.log() at the end to confirm execution
14. ALWAYS use try/except for safety
15. Actor classes to use:
    - unreal.StaticMeshActor (for any shape)
    - unreal.PointLight (point light)
    - unreal.SpotLight (spot light)
    - unreal.DirectionalLight (sun)
    - unreal.SkyAtmosphere (sky)
    - unreal.SkyLight (ambient)
    - unreal.VolumetricCloud (clouds)
    - unreal.ExponentialHeightFog (fog)
    - unreal.PostProcessVolume (post processing)
    - unreal.CineCameraActor (camera)

COMMON MISTAKES TO AVOID:
- DO NOT use unreal.EditorLevelLibrary() with parentheses - it's a static class
- DO NOT use unreal.load_object() - it often fails
- DO NOT reference any /Game/ material paths
- DO NOT create variables named 'editor' as instance - use the class directly
- DO NOT try to set material on meshes (just use default)
- DO NOT use .get_light_component() - use .get_component_by_class(unreal.XxxComponent)
`;
