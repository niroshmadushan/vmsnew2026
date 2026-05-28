@echo off
echo Starting SMART VISITOR Management System...
setlocal
cd /d %~dp0

:: Check if node_modules exists
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

:: Build the project
echo [INFO] Building the project...
npm run build
if errorlevel 1 (
    echo [ERROR] Build failed. Please check the errors above.
    pause
    exit /b 1
)

echo.
echo Application will be available at http://localhost:6001
echo Press Ctrl+C to stop the server.
echo.

set PORT=6001
npm run start
endlocal
pause
