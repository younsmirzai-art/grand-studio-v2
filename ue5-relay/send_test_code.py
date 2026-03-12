"""
Send a test Python snippet to UE5 via the relay.
Run this while relay.py is running and UE5 Web Remote Control is active.
Usage: python send_test_code.py [project_id]
"""
import os
import sys
from dotenv import load_dotenv

root_env = os.path.join(os.path.dirname(__file__), "..", ".env")
env_path = os.path.join(os.path.dirname(__file__), ".env")
env_local_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
if os.path.exists(root_env):
    load_dotenv(root_env)
if os.path.exists(env_path):
    load_dotenv(env_path, override=True)
if os.path.exists(env_local_path):
    load_dotenv(env_local_path, override=True)

from supabase import create_client

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in project root .env)")
    sys.exit(1)

client = create_client(SUPABASE_URL, SUPABASE_KEY)
project_id = sys.argv[1] if len(sys.argv) > 1 else None

CODE = r'''import unreal
import random

def setup_rainy_cyber_city():
    """
    Advanced procedural city generator with atmospheric rain effects.
    Author: Gemini AI for Boss (NixFlex Project)
    """
    
    # 1. Atmospheric & Environment Settings
    editor_subsystem = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
    world = editor_subsystem.get_editor_world()
    
    # Setup Exponential Height Fog for rainy mood
    fog_actors = unreal.EditorLevelLibrary.get_all_level_actors_of_class(unreal.ExponentialHeightFog)
    if not fog_actors:
        fog_actor = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(0,0,0))
    else:
        fog_actor = fog_actors[0]
        
    fog_component = fog_actor.root_component
    fog_component.set_editor_property("fog_density", 0.05)
    # Dark blue-ish tint for rainy atmosphere
    fog_component.set_editor_property("fog_inscattering_color", unreal.LinearColor(0.02, 0.02, 0.05, 1.0)) 

    # 2. City Grid Generation Logic
    grid_size = 15  
    spacing = 1200  
    
    unreal.log("Initiating Urban Deployment: Generating NYC Grid...")

    for x in range(grid_size):
        for y in range(grid_size):
            # Randomize building height for realism
            building_height = random.uniform(1.5, 6.0)
            location = unreal.Vector(x * spacing, y * spacing, 0)
            rotation = unreal.Rotator(0, 0, random.choice([0, 90, 180, 270]))
            
            # Spawn building actors
            actor = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.StaticMeshActor, location, rotation)
            actor.set_actor_label(f"CyberBuilding_{x}_{y}")
            
            # Scale adjustment to create skyscrapers
            actor.set_actor_scale3d(unreal.Vector(2.5, 2.5, building_height * 5))

    # 3. Lighting and Post-Processing (Night Rain Setup)
    sun_actors = unreal.EditorLevelLibrary.get_all_level_actors_of_class(unreal.DirectionalLight)
    for sun in sun_actors:
        sun.set_actor_hidden_in_game(True) 
        sun.set_brightness(0.05)

    # Setup Post Process Volume for Bloom and Reflections
    pp_actors = unreal.EditorLevelLibrary.get_all_level_actors_of_class(unreal.PostProcessVolume)
    if not pp_actors:
        pp_actor = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0,0,0))
    else:
        pp_actor = pp_actors[0]
        
    pp_actor.set_editor_property("unbound", True)
    settings = pp_actor.get_editor_property("settings")
    
    # Enhance Bloom for neon/wet surface look
    settings.set_editor_property("bloom_intensity", 2.0)
    settings.set_editor_property("vignette_intensity", 0.9)
    settings.set_editor_property("temp_tint", 0.2) # Cold temperature

    unreal.log("Deployment Successful: Rainy City Environment Loaded.")

# Execute Generation
try:
    setup_rainy_cyber_city()
except Exception as e:
    unreal.log_error(f"Critical System Error: {str(e)}")
'''

payload = {"code": CODE, "status": "pending"}
if project_id:
    payload["project_id"] = project_id

try:
    r = client.table("ue5_commands").insert(payload).execute()
    if r.data and len(r.data) > 0:
        cmd_id = r.data[0].get("id", "?")
        print(f"Sent. Command id: {cmd_id}")
        print("If relay.py and UE5 (with Web Remote Control) are running, the code will execute in a few seconds.")
    else:
        print("Insert failed:", r)
except Exception as e:
    print("Error sending code:", e)
    sys.exit(1)
