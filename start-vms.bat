@echo off
echo Starting SMART VISITOR Management System...
setlocal
cd /d %~dp0

:: Check if .next build folder exists
if not exist ".next" (
    echo [INFO] No build found. Running npm run build first...
    npm run build
    if errorlevel 1 (
        echo [ERROR] Build failed. Please check the errors above.
        pause
        exit /b 1
    )
)

echo.
echo Application will be available at http://localhost:6001
echo Press Ctrl+C to stop the server.
echo.

set PORT=6001
npm run start
endlocal
pause
