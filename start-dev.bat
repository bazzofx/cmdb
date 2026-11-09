@echo off
setlocal EnableExtensions
title CSM CMDB - Development Server
cd /d "%~dp0"

rem Optional first argument: port number (defaults to 3001).
set "PORT=%~1"
if "%PORT%"=="" set "PORT=3001"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found on PATH.
  echo Install Node.js 22 or newer from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

if not exist "node_modules\tsx" (
  echo [1/2] Installing dependencies ^(first run only^)...
  call npm install --legacy-peer-deps --no-audit --no-fund
  if errorlevel 1 (
    echo [ERROR] npm install failed. See the output above.
    pause
    exit /b 1
  )
)

echo [2/2] Starting the development server on http://localhost:%PORT%
echo       Press Ctrl+C to stop.
echo.

rem Open the browser a few seconds after Vite has had time to boot.
rem Set NO_BROWSER=1 before running to skip this (useful for scripts/CI).
if not "%NO_BROWSER%"=="1" start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:%PORT%'"

call npm run dev
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo [ERROR] The development server exited with code %EXIT_CODE%.
) else (
  echo Development server stopped.
)
pause
exit /b %EXIT_CODE%
