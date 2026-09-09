@echo off
REM ────────────────────────────────────────────────────────────────────
REM WikiPrepared Maps — Launcher (Windows)
REM Starts Martin tile server + miniserve SPA, opens browser.
REM ────────────────────────────────────────────────────────────────────
setlocal enabledelayedexpansion

cd /d "%~dp0"

set MARTIN_BIN=bin\martin-windows-x86_64.exe
set MINISERVE_BIN=bin\miniserve-windows-x86_64.exe

if not exist "%MARTIN_BIN%" (
    echo ⚠ Martin binary not found at %MARTIN_BIN%
)
if not exist "%MINISERVE_BIN%" (
    echo ⚠ miniserve binary not found at %MINISERVE_BIN%
)

REM ── Find free ports ─────────────────────────────────────────────────
set MARTIN_PORT=3000
set MINISERVE_PORT=3001

:check_martin_port
netstat -ano 2>nul | findstr ":%MARTIN_PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    set /a MARTIN_PORT+=1
    if !MARTIN_PORT! gtr 65535 (
        echo ❌ No free port found for Martin starting from 3000
        exit /b 1
    )
    goto check_martin_port
)

:check_miniserve_port
netstat -ano 2>nul | findstr ":%MINISERVE_PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    set /a MINISERVE_PORT+=1
    if !MINISERVE_PORT! gtr 65535 (
        echo ❌ No free port found for miniserve starting from 3001
        exit /b 1
    )
    goto check_miniserve_port
)

if !MINISERVE_PORT! equ !MARTIN_PORT! (
    set /a MINISERVE_PORT=MARTIN_PORT+1
)

echo ──────────────────────────────────────
echo  WikiPrepared Maps Launcher (Windows)
echo ──────────────────────────────────────
echo  Martin bin   : %MARTIN_BIN%
echo  Miniserve bin: %MINISERVE_BIN%
echo  Martin port  : %MARTIN_PORT%
echo  Miniserve    : %MINISERVE_PORT%
echo ──────────────────────────────────────

set MARTIN_CONFIG=config\martin-config.yaml
if not exist "%MARTIN_CONFIG%" (
    echo ⚠ Martin config not found at %MARTIN_CONFIG% — using defaults
) else (
    echo ✓ Martin config found: %MARTIN_CONFIG%
)

REM ── Start Martin ────────────────────────────────────────────────────
echo.
echo 🗺️  Starting Martin tile server on port %MARTIN_PORT%...
start "Martin Tile Server" "%MARTIN_BIN%" --config "%MARTIN_CONFIG%" --port %MARTIN_PORT%

REM Give Martin a moment to start
timeout /t 2 /nobreak >nul

REM ── Start miniserve ────────────────────────────────────────────────
echo 🌐 Starting miniserve SPA on port %MINISERVE_PORT%...
start "WikiPrepared SPA" "%MINISERVE_BIN%" --port %MINISERVE_PORT% --index index.html --spa web\

REM ── Patch style-dark.json if port differs from 3000 ─────────────────
if not %MARTIN_PORT%==3000 (
    echo 🔧 Patching style-dark.json to use port %MARTIN_PORT%...
    powershell -Command "(Get-Content web\style-dark.json) -replace 'localhost:3000', 'localhost:%MARTIN_PORT%' | Set-Content web\style-dark.json"
)

REM ── Open browser ────────────────────────────────────────────────────
set SPA_URL=http://localhost:%MINISERVE_PORT%
echo.
echo ✅ WikiPrepared Maps ready!
echo    Tile server : http://localhost:%MARTIN_PORT%
echo    SPA         : %SPA_URL%
echo.
timeout /t 1 /nobreak >nul
start "" "%SPA_URL%"

echo.
echo Press any key to stop servers and exit...
pause >nul

REM ── Cleanup ──────────────────────────────────────────────────────────
echo 🛑 Shutting down servers...
taskkill /fi "WINDOWTITLE eq Martin Tile Server*" /t /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq WikiPrepared SPA*" /t /f >nul 2>&1
echo ✓ Clean exit.

endlocal