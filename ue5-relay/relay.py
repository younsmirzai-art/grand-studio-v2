import os
import sys
import json
import time
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load env from multiple possible locations (first wins unless override=True)
# 1) Project root .env (where you usually put Supabase keys)
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
UE5_URL = os.getenv("UE5_REMOTE_CONTROL_URL", "http://localhost:30010")
POLL_INTERVAL = int(os.getenv("RELAY_POLL_INTERVAL", "2"))

supabase = None


def init_supabase():
    global supabase
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Missing Supabase credentials!")
        print("   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        print(f"   Checked: {root_env}")
        print(f"   Checked: {env_path}")
        print(f"   Checked: {env_local_path}")
        sys.exit(1)
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("Supabase connected")


def check_ue5_connection():
    """Check if UE5 Web Remote Control is reachable"""
    try:
        r = requests.get(f"{UE5_URL}/remote/info", timeout=5)
        if r.status_code == 200:
            print("UE5 Web Remote Control connected")
            return True
    except Exception:
        pass
    print("UE5 not connected yet (will keep trying...)")
    return False


def check_ue5_connection_silent():
    """Check UE5 connection without printing (for heartbeat)"""
    try:
        r = requests.get(f"{UE5_URL}/remote/info", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


def send_heartbeat():
    """Send heartbeat to Supabase so website knows relay is alive"""
    try:
        supabase.table("relay_heartbeat").upsert(
            {
                "id": "local-relay",
                "last_ping": datetime.now(timezone.utc).isoformat(),
                "ue5_connected": check_ue5_connection_silent(),
                "relay_version": "1.0.0",
            },
            on_conflict="id",
        ).execute()
    except Exception:
        pass


def execute_in_ue5(python_code):
    """Send Python code to UE5 via Web Remote Control"""
    try:
        payload = {
            "objectPath": "/Script/PythonScriptPlugin.Default__PythonScriptLibrary",
            "functionName": "ExecutePythonCommand",
            "parameters": {"PythonCommand": python_code},
        }
        response = requests.put(
            f"{UE5_URL}/remote/object/call",
            json=payload,
            timeout=30,
        )
        if response.status_code == 200:
            return {"success": True, "result": response.json()}
        else:
            return {
                "success": False,
                "error": f"UE5 returned {response.status_code}: {response.text}",
            }
    except requests.exceptions.ConnectionError:
        return {
            "success": False,
            "error": "Cannot connect to UE5. Is Unreal Engine running?",
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def capture_screenshot():
    """Capture a screenshot from UE5 viewport"""
    code = """
import unreal
import datetime
timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
filename = f'C:/GrandStudio/Screenshots/capture_{timestamp}.png'
unreal.AutomationLibrary.take_high_res_screenshot(1920, 1080, filename)
unreal.log(f'Screenshot saved: {filename}')
"""
    return execute_in_ue5(code)


def extract_import_result_from_ue5_response(ue5_result):
    """Parse UE5 ExecutePythonCommand response for IMPORT_RESULT: {...} line."""
    if not ue5_result:
        return None
    text = None
    if isinstance(ue5_result, str):
        text = ue5_result
    elif isinstance(ue5_result, dict):
        for v in ue5_result.values():
            found = extract_import_result_from_ue5_response(v)
            if found:
                return found
        if "Output" in ue5_result:
            text = ue5_result.get("Output") or ue5_result.get("OutputLog")
        if not text and "ReturnValue" in ue5_result:
            text = str(ue5_result.get("ReturnValue"))
    if not text or "IMPORT_RESULT:" not in text:
        return None
    try:
        prefix = "IMPORT_RESULT:"
        idx = text.rfind(prefix)
        if idx == -1:
            return None
        json_str = text[idx + len(prefix) :].strip()
        return json.loads(json_str)
    except (ValueError, TypeError):
        return None


def save_import_result_to_db(cmd_id, project_id, import_context, import_result):
    """Upsert one row into ue5_import_assets; sync import_status to generated_3d_assets if applicable."""
    if not import_context or not import_result:
        return
    try:
        preview_url = import_context.get("preview_image_url") or import_result.get("preview_image_url")
        row = {
            "project_id": project_id,
            "ue5_command_id": cmd_id,
            "source_provider": import_context.get("source_provider") or "unknown",
            "source_url": import_context.get("source_url"),
            "file_type": import_context.get("file_type"),
            "ue_asset_path": import_result.get("ue_asset_path"),
            "material_count": import_result.get("material_count", 0),
            "texture_count": import_result.get("texture_count", 0),
            "import_status": import_result.get("import_status") or "failed",
            "import_error": import_result.get("import_error"),
            "preview_image_url": preview_url,
        }
        supabase.table("ue5_import_assets").insert(row).execute()
        print(f"         Import result saved: {row['import_status']} (materials={row['material_count']}, textures={row['texture_count']})")
        # Sync back to generated_3d_assets so UI can show import status/badges
        try:
            supabase.table("generated_3d_assets").update({
                "ue_asset_path": row["ue_asset_path"],
                "import_status": row["import_status"],
                "material_count": row["material_count"],
                "texture_count": row["texture_count"],
                "import_error": row["import_error"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("ue5_command_id", cmd_id).execute()
        except Exception:
            pass
    except Exception as e:
        print(f"         Failed to save import result: {e}")


def poll_commands():
    """Main polling loop - checks Supabase for pending UE5 commands"""
    print("")
    print("=" * 55)
    print("  Grand Studio — UE5 Relay Bridge")
    print("=" * 55)
    print(f"  Supabase : {SUPABASE_URL[:50]}...")
    print(f"  UE5      : {UE5_URL}")
    print(f"  Poll     : every {POLL_INTERVAL}s")
    print("=" * 55)
    print("  Waiting for commands from Grand Studio...")
    print("  (Keep this running while using Grand Studio)")
    print("=" * 55)
    print("")

    ue5_connected = check_ue5_connection()
    ue5_check_counter = 0
    heartbeat_counter = 0

    while True:
        try:
            # Heartbeat every ~10 seconds (e.g. 5 * 2s)
            heartbeat_counter += 1
            if heartbeat_counter >= 5:
                heartbeat_counter = 0
                send_heartbeat()

            # Periodically re-check UE5 connection
            ue5_check_counter += 1
            if not ue5_connected and ue5_check_counter % 15 == 0:
                ue5_connected = check_ue5_connection()

            # Poll for pending commands
            result = (
                supabase.table("ue5_commands")
                .select("*")
                .eq("status", "pending")
                .order("created_at", desc=False)
                .limit(10)
                .execute()
            )

            for cmd in result.data:
                cmd_id = cmd["id"]
                code = cmd.get("python_code") or cmd.get("code", "")
                project_id = cmd.get("project_id", "unknown")
                cmd_type = cmd.get("command_type", "execute")
                now = datetime.now().strftime("%H:%M:%S")

                print(f"[{now}] Command {cmd_id[:8]}... | type: {cmd_type}")
                print(f"         Code: {code[:80]}...")

                # Mark as running
                supabase.table("ue5_commands").update(
                    {"status": "executing"}
                ).eq("id", cmd_id).execute()

                # Handle different command types
                if cmd_type == "screenshot" or cmd_type == "capture":
                    ue5_result = capture_screenshot()
                else:
                    ue5_result = execute_in_ue5(code)

                completed_at = datetime.now(timezone.utc).isoformat()
                if ue5_result["success"]:
                    ue5_connected = True
                    print("         Success!")
                    update_data = {
                        "status": "success",
                        "result": json.dumps(ue5_result.get("result", {})),
                        "executed_at": completed_at,
                    }
                    if cmd_type in ["screenshot", "capture"]:
                        update_data["screenshot_url"] = ue5_result.get(
                            "screenshot_url", ""
                        )
                    supabase.table("ue5_commands").update(update_data).eq(
                        "id", cmd_id
                    ).execute()
                    # Post-import: parse IMPORT_RESULT and save to ue5_import_assets
                    import_ctx = cmd.get("import_context")
                    if import_ctx or cmd_type == "import":
                        parsed = extract_import_result_from_ue5_response(
                            ue5_result.get("result")
                        )
                        if parsed:
                            save_import_result_to_db(
                                cmd_id,
                                project_id,
                                import_ctx or {},
                                parsed,
                            )
                else:
                    print(f"         Error: {ue5_result['error']}")
                    supabase.table("ue5_commands").update(
                        {
                            "status": "error",
                            "error_log": ue5_result["error"],
                            "executed_at": completed_at,
                        }
                    ).eq("id", cmd_id).execute()

        except KeyboardInterrupt:
            print("\n\nRelay stopped by user. Goodbye!")
            sys.exit(0)
        except Exception as e:
            print(f"Polling error: {e}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    init_supabase()
    poll_commands()
