"""
Grand Studio v2 — UE5 Local Relay
Run this on your PC alongside Unreal Engine.
It watches Supabase for pending commands and executes them in UE5.

Setup:
  pip install supabase httpx python-dotenv

Usage:
  export SUPABASE_URL="https://xxxxx.supabase.co"
  export SUPABASE_KEY="your-anon-key"
  export UE5_REMOTE_CONTROL_URL="http://localhost:30010"  # optional
  python relay.py
"""

import os
import json
import time
import httpx
from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
UE5_URL = os.getenv("UE5_REMOTE_CONTROL_URL", "http://localhost:30010")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_KEY environment variables")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def execute_in_ue5(code: str) -> tuple[bool, str]:
    try:
        r = httpx.put(
            f"{UE5_URL}/remote/object/call",
            json={
                "objectPath": "/Script/PythonScriptPlugin.Default__PythonScriptLibrary",
                "functionName": "ExecutePythonCommand",
                "parameters": {"PythonCommand": code},
            },
            timeout=30.0,
        )
        return r.status_code == 200, r.text
    except Exception as e:
        return False, str(e)


def poll_and_execute():
    print(f"Connecting to Supabase: {SUPABASE_URL}")
    print(f"UE5 Remote Control: {UE5_URL}")
    print("Listening for commands...\n")

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

                print(f"[EXEC] Command {cmd_id[:8]}...")
                print(f"  Code: {code[:80]}{'...' if len(code) > 80 else ''}")

                supabase.table("ue5_commands").update(
                    {"status": "executing"}
                ).eq("id", cmd_id).execute()

                success, output = execute_in_ue5(code)

                if success:
                    print(f"  [OK] Success")
                    supabase.table("ue5_commands").update(
                        {
                            "status": "success",
                            "result": output,
                            "executed_at": "now()",
                        }
                    ).eq("id", cmd_id).execute()
                else:
                    print(f"  [ERR] {output[:100]}")
                    supabase.table("ue5_commands").update(
                        {
                            "status": "error",
                            "error_log": output,
                            "executed_at": "now()",
                        }
                    ).eq("id", cmd_id).execute()

        except KeyboardInterrupt:
            print("\nShutting down relay...")
            break
        except Exception as e:
            print(f"[WARN] Poll error: {e}")

        time.sleep(1)


if __name__ == "__main__":
    print("=" * 50)
    print(" Grand Studio v2 — UE5 Local Relay")
    print("=" * 50)
    poll_and_execute()
