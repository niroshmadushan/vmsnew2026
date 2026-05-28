@echo off
echo Starting SMART VISITOR Management System (Standard Build)...
setlocal
cd /d %~dp0

:: Check for node_modules
if not exist "node_modules" (
    echo [ERROR] node_modules folder not found. 
    echo Please run "npm install" first.
    pause
    exit /b 1
)

:: Check for .next folder
if not exist ".next" (
    echo [ERROR] .next folder not found.
    echo Please run "npm run build" first.
    pause
    exit /b 1
)

echo.
echo Application will be available at http://localhost:6001
echo Press Ctrl+C to stop the server.
echo.

set PORT=6001
npm start
endlocal
pause
