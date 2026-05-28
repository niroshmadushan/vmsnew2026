@echo off
echo Starting SMART VISITOR Management System (Standalone)...
cd %~dp0
if not exist ".next\standalone" (
    echo Error: Standalone build not found. Please run "npm run build" first.
    pause
    exit /b 1
)

:: Copy public and static files if missing (Next.js standalone requirement)
if not exist ".next\standalone\public" xcopy /s /e /i "public" ".next\standalone\public"
if not exist ".next\standalone\.next\static" xcopy /s /e /i ".next\static" ".next\standalone\.next\static"

echo.
echo Application will be available at http://localhost:6001
echo Press Ctrl+C to stop the server.
echo.

set PORT=6001
node .next\standalone\server.js
pause
