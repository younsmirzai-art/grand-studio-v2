@echo off
echo ========================================
echo  Grand Studio - UE5 Relay Setup
echo ========================================
echo.

cd /d "%~dp0"

echo Installing Python dependencies...
pip install -r requirements.txt

echo.
echo Copying credentials from .env.local...
if not exist ".env" (
    if exist "..\.env.local" (
        echo NEXT_PUBLIC_SUPABASE_URL= > .env
        echo SUPABASE_SERVICE_ROLE_KEY= >> .env
        echo UE5_REMOTE_CONTROL_URL=http://localhost:30010 >> .env
        echo RELAY_POLL_INTERVAL=2 >> .env
        echo Created .env — please fill in your Supabase credentials!
    )
)

echo.
echo Setup complete! Run 'start-relay.bat' to start the relay.
pause
