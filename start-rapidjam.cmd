@echo off
setlocal

cd /d "%~dp0"

if not exist "%ProgramFiles%\nodejs\node.exe" if not exist "%LocalAppData%\Programs\nodejs\node.exe" (
  echo Node.js was not found.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

if exist "%ProgramFiles%\nodejs" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%LocalAppData%\Programs\nodejs" set "PATH=%LocalAppData%\Programs\nodejs;%PATH%"

if not exist "node_modules" (
  echo Dependencies are not installed.
  echo Running npm install...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed. Check that Node.js is installed and available.
    pause
    exit /b 1
  )
)

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

echo.
echo RapidJAM Configurator
 echo [1] Start with Mock device
 echo [2] Start with RapidJAM WebConfig HTTP
 echo.
choice /c 12 /n /m "Select mode: "

if errorlevel 2 goto http
if errorlevel 1 goto mock

:mock
start "RapidJAM Vite Server" /D "%~dp0" cmd /k npm run dev -- --host 127.0.0.1
timeout /t 2 /nobreak >nul
start "RapidJAM Configurator" "http://127.0.0.1:5173/"
exit /b %errorlevel%

:http
start "RapidJAM Vite Server" /D "%~dp0" cmd /k npm run dev -- --host 127.0.0.1
timeout /t 2 /nobreak >nul
start "RapidJAM Configurator" "http://127.0.0.1:5173/?transport=http"
exit /b %errorlevel%
