"""
Grand Studio v2 — UE5 Local Relay
Run this on your PC alongside Unreal Engine.
Watches Supabase for pending commands and executes them in UE5.

UE5 Server Configuration:
  - HTTP Server: http://localhost:30010
  - WebSocket Server: ws://localhost:30020
  - Web Interface: http://localhost:30000

Usage:
  pip install -r requirements.txt
  python relay.py
"""
import os
import time
import glob
import httpx
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", os.getenv("NEXT_PUBLIC_SUPABASE_URL", ""))
SUPABASE_KEY = os.getenv("SUPABASE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""))
UE5_HTTP_URL = os.getenv("UE5_HTTP_URL", "http://localhost:30010")
UE5_WEBSOCKET_URL = os.getenv("UE5_WEBSOCKET_URL", "ws://localhost:30020")
POLL_INTERVAL = 1
SCREENSHOT_DIR = os.getenv("GRAND_STUDIO_SCREENSHOTS", "C:/GrandStudio/Screenshots")

UE5_EXECUTE_ENDPOINT = f"{UE5_HTTP_URL}/remote/object/call"
UE5_OBJECT_PATH = "/Script/PythonScriptPlugin.Default__PythonScriptLibrary"
UE5_FUNCTION_NAME = "ExecutePythonCommand"

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_KEY in .env or environment variables")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def check_ue5_connection() -> bool:
    """Test if UE5 is running and Web Remote Control is active on port 30010."""
    try:
        r = httpx.get(f"{UE5_HTTP_URL}/remote/info", timeout=5.0)
        return r.status_code == 200
    except Exception:
        return False


def execute_in_ue5(code: str) -> tuple[bool, str]:
    """Send Python code to UE5 via Web Remote Control API.

    PUT http://localhost:30010/remote/object/call
    with PythonScriptLibrary.ExecutePythonCommand
    """
    try:
        r = httpx.put(
            UE5_EXECUTE_ENDPOINT,
            json={
                "objectPath": UE5_OBJECT_PATH,
                "functionName": UE5_FUNCTION_NAME,
                "parameters": {"PythonCommand": code},
            },
            timeout=30.0,
        )
        if r.status_code == 200:
            return True, r.text
        else:
            return False, f"HTTP {r.status_code}: {r.text}"
    except Exception as e:
        return False, f"Connection error: {str(e)}"


def update_command(cmd_id: str, status: str, result: str = "", error_log: str = "", screenshot_url: str = ""):
    update_data = {"status": status, "result": result, "error_log": error_log}
    if status in ("success", "error"):
        update_data["executed_at"] = "now()"
    if screenshot_url:
        update_data["screenshot_url"] = screenshot_url
    supabase.table("ue5_commands").update(update_data).eq("id", cmd_id).execute()


def capture_ue5_screenshot() -> tuple[bool, str]:
    """Tell UE5 to take a viewport screenshot. Returns (success, filepath or error)."""
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.join(SCREENSHOT_DIR, f"capture_{timestamp}.png").replace("\\", "/")

    screenshot_code = f'''
import unreal
import os

# Ensure directory exists
os.makedirs(r"{SCREENSHOT_DIR.replace(chr(92), "/")}", exist_ok=True)
filename = r"{filename}"

try:
    unreal.AutomationLibrary.take_high_res_screenshot(1920, 1080, filename)
    unreal.log(f"Screenshot saved: {{filename}}")
    print(f"SCREENSHOT_PATH:{{filename}}")
except Exception as e:
    unreal.log(f"Screenshot error: {{e}}")
    print(f"SCREENSHOT_ERROR:{{e}}")
'''

    try:
        r = httpx.put(
            UE5_EXECUTE_ENDPOINT,
            json={
                "objectPath": UE5_OBJECT_PATH,
                "functionName": UE5_FUNCTION_NAME,
                "parameters": {"PythonCommand": screenshot_code},
            },
            timeout=30.0,
        )
        if r.status_code != 200:
            return False, f"HTTP {r.status_code}"
        # Parse output for path (UE5 may save to different location)
        return True, filename
    except Exception as e:
        return False, str(e)


def upload_screenshot_to_supabase(filepath: str, project_id: str) -> str | None:
    """Upload screenshot to Supabase Storage and return public URL."""
    if not os.path.isfile(filepath):
        # Try to find latest screenshot in directory
        os.makedirs(SCREENSHOT_DIR, exist_ok=True)
        pattern = os.path.join(SCREENSHOT_DIR, "*.png")
        files = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)
        if not files:
            return None
        filepath = files[0]

    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        storage_path = f"screenshots/{project_id}/{timestamp}.png"

        with open(filepath, "rb") as f:
            supabase.storage.from_("ue5-captures").upload(
                storage_path,
                f.read(),
                {"content-type": "image/png"},
            )

        url = supabase.storage.from_("ue5-captures").get_public_url(storage_path)
        return url
    except Exception as e:
        print(f"     ⚠️ Screenshot upload failed: {e}")
        return None


def log_event(project_id, event_type: str, agent: str, detail: str):
    if not project_id:
        return
    try:
        supabase.table("god_eye_log").insert(
            {
                "project_id": project_id,
                "event_type": event_type,
                "agent_name": agent,
                "detail": detail,
            }
        ).execute()
    except Exception:
        pass


def poll_and_execute():
    print("=" * 60)
    print("  Grand Studio v2 — UE5 Local Relay")
    print("=" * 60)
    print(f"  UE5 HTTP Server:     {UE5_HTTP_URL}")
    print(f"  UE5 WebSocket:       {UE5_WEBSOCKET_URL}")
    print(f"  Execute Endpoint:    {UE5_EXECUTE_ENDPOINT}")
    print(f"  Supabase:            {SUPABASE_URL}")
    print("=" * 60)

    if check_ue5_connection():
        print(f"  ✅ UE5 connected at {UE5_HTTP_URL}")
    else:
        print(f"  ❌ Cannot reach UE5 at {UE5_HTTP_URL}")
        print("     Make sure Unreal Engine is open with Web Remote Control enabled")
        print("     Expected: HTTP on port 30010, WebSocket on port 30020")
        print("     Waiting for connection...")

    try:
        supabase.table("ue5_commands").select("id").limit(1).execute()
        print("  ✅ Supabase connected")
    except Exception as e:
        print(f"  ❌ Supabase error: {e}")
        return

    print(f"\n  🎮 Listening for commands (polling every {POLL_INTERVAL}s)...")
    print("-" * 60)

    while True:
        try:
            result = (
                supabase.table("ue5_commands")
                .select("*")
                .eq("status", "pending")
                .order("created_at")
                .limit(1)
                .execute()
            )

            if result.data:
                cmd = result.data[0]
                cmd_id = cmd["id"]
                code = cmd["code"]
                project_id = cmd.get("project_id")

                print(f"\n  📥 Command {cmd_id[:8]}... ({len(code)} chars)")

                update_command(cmd_id, "executing")
                log_event(project_id, "execution", "UE5 Relay", f"Executing command {cmd_id[:8]}...")

                if not check_ue5_connection():
                    err = f"UE5 not connected at {UE5_HTTP_URL}. Open UE5 with Web Remote Control enabled."
                    print(f"     ❌ {err}")
                    update_command(cmd_id, "error", error_log=err)
                    log_event(project_id, "error", "UE5 Relay", err)
                    continue

                success, output = execute_in_ue5(code)

                if success:
                    print("     ✅ Success")
                    screenshot_url = None

                    # Live Vision: capture viewport screenshot after execution
                    time.sleep(2)  # Wait for UE5 to render
                    cap_ok, cap_result = capture_ue5_screenshot()
                    if cap_ok:
                        time.sleep(3)  # Wait for async screenshot to save
                        if project_id:
                            screenshot_url = upload_screenshot_to_supabase(cap_result, project_id)
                            if screenshot_url:
                                print("     📸 Screenshot captured and uploaded")
                                log_event(project_id, "screenshot", "UE5 Relay", "📸 Live Vision: Screenshot captured")
                                # Insert chat turn so agents can see the result
                                try:
                                    supabase.table("chat_turns").insert({
                                        "project_id": project_id,
                                        "agent_name": "UE5",
                                        "agent_title": "Live Vision",
                                        "content": f"Code executed successfully.\n\n```\n{output[:500]}\n```",
                                        "turn_type": "execution",
                                        "screenshot_url": screenshot_url,
                                    }).execute()
                                except Exception:
                                    pass
                        else:
                            print("     📸 Screenshot captured (no project_id, not uploaded)")

                    update_command(cmd_id, "success", result=output, screenshot_url=screenshot_url or "")
                    log_event(project_id, "api_ok", "UE5 Relay", "Code executed successfully in UE5")
                else:
                    print(f"     ❌ {output[:100]}")
                    update_command(cmd_id, "error", error_log=output)
                    log_event(project_id, "error", "UE5 Relay", f"Execution failed: {output[:200]}")

            time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            print("\n\n  🛑 Relay stopped by user")
            break
        except Exception as e:
            print(f"     ⚠️ Error: {e}")
            time.sleep(POLL_INTERVAL * 3)


if __name__ == "__main__":
    poll_and_execute()
