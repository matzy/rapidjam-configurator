@echo off
setlocal

cd /d "%~dp0"

set "NODE_EXE="
if exist "%~dp0runtime\node.exe" set "NODE_EXE=%~dp0runtime\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE_EXE=%LocalAppData%\Programs\nodejs\node.exe"
if defined NODE_EXE for %%N in ("%NODE_EXE%") do set "PATH=%%~dpN;%PATH%"

echo.
echo RapidJAM Configurator
 echo [1] Start with Mock device
 echo [2] Start with RapidJAM WebConfig HTTP
 echo [3] Start built distribution with RapidJAM WebConfig HTTP
 echo.
choice /c 123 /n /m "Select mode: "

if errorlevel 3 goto distribution
if errorlevel 2 goto http
if errorlevel 1 goto mock

:mock
call :ensure_node
if errorlevel 1 exit /b 1
call :ensure_dependencies
if errorlevel 1 exit /b 1
start "RapidJAM Vite Server" /D "%~dp0" cmd /k npm run dev -- --host 127.0.0.1
timeout /t 2 /nobreak >nul
start "RapidJAM Configurator" "http://127.0.0.1:5173/"
exit /b %errorlevel%

:http
call :ensure_node
if errorlevel 1 exit /b 1
call :ensure_dependencies
if errorlevel 1 exit /b 1
start "RapidJAM Vite Server" /D "%~dp0" cmd /k npm run dev -- --host 127.0.0.1
timeout /t 2 /nobreak >nul
start "RapidJAM Configurator" "http://127.0.0.1:5173/?transport=http"
exit /b %errorlevel%

:ensure_dependencies
if exist "node_modules" exit /b 0
echo Dependencies are not installed.
echo Running npm install...
call npm install
if errorlevel 1 (
  echo.
  echo npm install failed. Check that Node.js is installed and available.
  pause
  exit /b 1
)
exit /b 0

:ensure_node
if defined NODE_EXE exit /b 0
echo Node.js was not found.
echo Add portable Node.js under runtime\node.exe or install Node.js.
pause
exit /b 1

:distribution
if not exist "dist\index.html" (
  echo Production build not found. Building now...
  call npm run build
  if errorlevel 1 (
    echo.
    echo Production build failed.
    pause
    exit /b 1
  )
)
if exist "%~dp0runtime\node.exe" (
  start "RapidJAM Configurator Server" /D "%~dp0" cmd /k ""%~dp0runtime\node.exe" server.mjs"
) else (
  call :ensure_node
  if errorlevel 1 exit /b 1
  start "RapidJAM Configurator Server" /D "%~dp0" cmd /k npm run serve
)
timeout /t 2 /nobreak >nul
start "RapidJAM Configurator" "http://127.0.0.1:5173/?transport=http"
exit /b %errorlevel%
