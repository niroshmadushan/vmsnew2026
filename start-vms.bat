@echo off
echo Starting SMART VISITOR Management System (Standalone)...
setlocal
cd /d %~dp0

:: 1. Check if we are running INSIDE the deployment folder (server.js is at root)
if exist "server.js" (
    echo [INFO] Running in deployment folder.
    goto RUN_NODE
)

:: 2. Check if we are in the project source folder (.next\standalone exists)
if exist ".next\standalone\server.js" (
    echo [INFO] Running in source folder.
    
    :: Copy public and static files if missing (Next.js standalone requirement)
    if not exist ".next\standalone\public" (
        echo [INFO] Preparing static assets...
        xcopy /s /e /i /y "public" ".next\standalone\public" > nul
    )
    if not exist ".next\standalone\.next\static" (
        if not exist ".next\standalone\.next" mkdir ".next\standalone\.next"
        xcopy /s /e /i /y ".next\static" ".next\standalone\.next\static" > nul
    )
    
    :: Change to the standalone directory
    cd .next\standalone
    goto RUN_NODE
)

:: 3. Error Case
echo.
echo [ERROR] Standalone build not found.
echo Please run "npm run build" first to generate the production files.
echo.
pause
exit /b 1

:RUN_NODE
echo.
echo Application will be available at http://localhost:6001
echo Press Ctrl+C to stop the server.
echo.

set PORT=6001
node server.js
endlocal
pause
