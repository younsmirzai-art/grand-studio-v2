import { NextRequest, NextResponse } from "next/server";

function escapeForBatch(value: string): string {
  return value
    .replace(/%/g, "%%")
    .replace(/&/g, "^&")
    .replace(/</g, "^<")
    .replace(/>/g, "^>")
    .replace(/\|/g, "^|")
    .replace(/\r?\n/g, " ");
}

function escapeForPowerShell(value: string): string {
  return value.replace(/'/g, "''");
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Server missing Supabase credentials" },
      { status: 500 }
    );
  }

  const host = request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;
  const relayDownloadUrl = `${baseUrl}/api/relay/download`;

  const batUrl = escapeForBatch(relayDownloadUrl);
  const psUrl = escapeForPowerShell(relayDownloadUrl);
  const psSupabaseUrl = escapeForPowerShell(supabaseUrl);
  const psSupabaseKey = escapeForPowerShell(supabaseKey);

  const bat = `@echo off
setlocal enabledelayedexpansion
echo.
echo ============================================
echo   Grand Studio - UE5 Relay Setup
echo ============================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python is not installed or not in PATH.
  echo.
  echo Please install Python from https://www.python.org/downloads/
  echo Make sure to check "Add Python to PATH" during installation.
  echo.
  pause
  exit /b 1
)
echo [OK] Python found
python --version
echo.

:: Create folder
if not exist "C:\\GrandStudio" mkdir "C:\\GrandStudio"
echo [OK] Folder C:\\GrandStudio ready
echo.

:: Download relay.py
echo Downloading relay.py from Grand Studio...
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '${psUrl}' -OutFile 'C:\\GrandStudio\\relay.py' -UseBasicParsing } catch { exit 1 }"
if errorlevel 1 (
  echo [ERROR] Failed to download relay.py. Check your internet connection.
  pause
  exit /b 1
)
echo [OK] relay.py downloaded
echo.

:: Create .env with Supabase credentials
powershell -NoProfile -Command "Set-Content -Path 'C:\\GrandStudio\\.env' -Value 'NEXT_PUBLIC_SUPABASE_URL=${psSupabaseUrl}', 'SUPABASE_SERVICE_ROLE_KEY=${psSupabaseKey}'"
echo [OK] .env created
echo.

:: Install dependencies
echo Installing Python packages...
pip install supabase requests python-dotenv --quiet
if errorlevel 1 (
  echo [WARN] pip install had issues - trying anyway...
)
echo [OK] Dependencies installed
echo.

echo ============================================
echo   Starting relay...
echo   Keep this window open while using Grand Studio.
echo ============================================
echo.
cd /d C:\\GrandStudio
python relay.py
pause
`;

  return new NextResponse(bat, {
    status: 200,
    headers: {
      "Content-Type": "application/x-bat; charset=utf-8",
      "Content-Disposition": 'attachment; filename="GrandStudio-Relay-Setup.bat"',
    },
  });
}
