@echo off
setlocal

cd /d "%~dp0"

if not exist "dist\index.html" (
  echo Production build not found. This distribution is incomplete.
  pause
  exit /b 1
)

set "NODE_EXE="
for /f "usebackq delims=" %%N in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" -ResolvePath`) do set "NODE_EXE=%%N"
if not defined NODE_EXE (
  echo.
  echo Node.js setup failed or was cancelled.
  pause
  exit /b 1
)

start "RapidJAM Configurator Server" /D "%~dp0" cmd /k ""%NODE_EXE%" server.mjs"
timeout /t 2 /nobreak >nul
start "RapidJAM Configurator" "http://127.0.0.1:5173/?transport=http"
exit /b %errorlevel%
