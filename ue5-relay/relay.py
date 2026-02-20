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
import httpx
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", os.getenv("NEXT_PUBLIC_SUPABASE_URL", ""))
SUPABASE_KEY = os.getenv("SUPABASE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""))
UE5_HTTP_URL = os.getenv("UE5_HTTP_URL", "http://localhost:30010")
UE5_WEBSOCKET_URL = os.getenv("UE5_WEBSOCKET_URL", "ws://localhost:30020")
POLL_INTERVAL = 1

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


def update_command(cmd_id: str, status: str, result: str = "", error_log: str = ""):
    update_data = {"status": status, "result": result, "error_log": error_log}
    if status in ("success", "error"):
        update_data["executed_at"] = "now()"
    supabase.table("ue5_commands").update(update_data).eq("id", cmd_id).execute()


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
                    update_command(cmd_id, "success", result=output)
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
