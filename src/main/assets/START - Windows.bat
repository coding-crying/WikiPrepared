@echo off
setlocal enabledelayedexpansion

REM WikiPrepared - Windows Kiwix Reader Launcher
REM Launches Kiwix from the hidden .data folder

set "SCRIPT_DIR=%~dp0"
set "KIWIX_DIR=%SCRIPT_DIR%.data\kiwix-windows"

if not exist "%KIWIX_DIR%" (
    echo Kiwix reader not found.
    echo Please run the WikiPrepared setup to install readers.
    pause
    exit /b 1
)

REM Look for kiwix-desktop.exe in subdirectories
for /d %%D in ("%KIWIX_DIR%\*") do (
    if exist "%%D\kiwix-desktop.exe" (
        start "" "%%D\kiwix-desktop.exe"
        exit /b 0
    )
)

REM Check if it's directly in the folder
if exist "%KIWIX_DIR%\kiwix-desktop.exe" (
    start "" "%KIWIX_DIR%\kiwix-desktop.exe"
    exit /b 0
)

echo Could not find kiwix-desktop.exe
pause
