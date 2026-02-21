@echo off
echo Creating Windows startup shortcut for Grand Studio Relay...

set "SCRIPT_PATH=%~dp0"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT=%STARTUP_DIR%\GrandStudioRelay.bat"

echo @echo off > "%SHORTCUT%"
echo title Grand Studio Relay >> "%SHORTCUT%"
echo cd /d "%SCRIPT_PATH%" >> "%SHORTCUT%"
echo python relay.py >> "%SHORTCUT%"

echo.
echo Relay will now auto-start when Windows boots!
echo    Shortcut created at: %SHORTCUT%
echo    To remove: delete GrandStudioRelay.bat from your Startup folder
pause
