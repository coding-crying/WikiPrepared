const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * PlatformLauncherService - Creates platform-specific launchers
 *
 * New clean structure:
 * - Readers hidden in .data/ folder
 * - Simple launchers: START - Windows.bat, START - Mac.command, START - Linux.sh
 * - Android APK visible in root as "Install on Android.apk"
 */
class PlatformLauncherService {

  /**
   * Create all platform launchers on USB
   * @param {string} usbPath - USB drive path
   * @param {Object} options - Optional settings
   */
  async createAllLaunchers(usbPath, options = {}) {
    console.log('Creating platform-specific launchers...');

    try {
      await this.createWindowsLauncher(usbPath);
      console.log('Created Windows launcher');
    } catch (error) {
      console.log('Windows launcher creation failed:', error.message);
    }

    try {
      await this.createMacLauncher(usbPath);
      console.log('Created Mac launcher');
    } catch (error) {
      console.log('Mac launcher creation failed:', error.message);
    }

    try {
      await this.createReadme(usbPath);
      console.log('Created README');
    } catch (error) {
      console.log('README creation failed:', error.message);
    }
  }

  /**
   * Create Windows batch launcher
   * Points to .data/kiwix-windows/ folder and passes ZIM files as arguments
   * @param {string} usbPath - USB drive path
   */
  async createWindowsLauncher(usbPath) {
    const batPath = path.join(usbPath, 'START - Windows.bat');

    // Find the kiwix-desktop.exe and pass all .zim files from Library folder
    const scriptContent = `@echo off
setlocal enabledelayedexpansion

:: Find kiwix-desktop.exe in .data\\kiwix-windows
set "KIWIX_DIR=%~dp0.data\\kiwix-windows"
set "LIBRARY_FOLDER=%~dp0Library"
set "KIWIX_EXE="

:: Look for kiwix-desktop.exe in subdirectories
for /d %%D in ("%KIWIX_DIR%\\*") do (
    if exist "%%D\\kiwix-desktop.exe" (
        set "KIWIX_EXE=%%D\\kiwix-desktop.exe"
        goto :found
    )
)

:: Check if it's directly in the folder
if exist "%KIWIX_DIR%\\kiwix-desktop.exe" (
    set "KIWIX_EXE=%KIWIX_DIR%\\kiwix-desktop.exe"
    goto :found
)

echo Kiwix reader not found. Please run the WikiPrepared setup first.
pause
exit /b 1

:found
:: Collect all .zim files from Library folder
set "ZIM_FILES="
for %%F in ("%LIBRARY_FOLDER%\\*.zim") do (
    set "ZIM_FILES=!ZIM_FILES! "%%F""
)

:: Launch Kiwix with all ZIM files
if defined ZIM_FILES (
    start "" "%KIWIX_EXE%" %ZIM_FILES%
) else (
    start "" "%KIWIX_EXE%"
)
exit /b 0
`;

    await fs.writeFile(batPath, scriptContent);
    console.log('✓ Created Windows launcher');
  }

  /**
   * Create macOS launcher (.command script)
   * Points to .data/kiwix-macos.dmg and opens ZIM files directly
   * @param {string} usbPath - USB drive path
   */
  async createMacLauncher(usbPath) {
    const commandPath = path.join(usbPath, 'START - Mac.command');

    const scriptContent = `#!/bin/bash
# WikiPrepared - macOS Kiwix Reader Launcher

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DMG_PATH="$SCRIPT_DIR/.data/kiwix-macos.dmg"
LIBRARY_FOLDER="$SCRIPT_DIR/Library"

# Check if Kiwix is already installed
if [ -d "/Applications/Kiwix.app" ]; then
    echo "Launching Kiwix with your Wikipedia files..."

    # Find all .zim files and open them with Kiwix
    ZIM_FILES=$(find "$LIBRARY_FOLDER" -name "*.zim" 2>/dev/null)

    if [ -n "$ZIM_FILES" ]; then
        # Open each ZIM file with Kiwix (this adds them to the library)
        echo "$ZIM_FILES" | while read zim; do
            open -a Kiwix "$zim"
        done
    else
        open -a Kiwix
    fi
    exit 0
fi

# Check if DMG exists
if [ ! -f "$DMG_PATH" ]; then
    echo "ERROR: Kiwix installer not found at $DMG_PATH"
    echo "Please run the WikiPrepared setup first."
    read -p "Press Enter to exit..."
    exit 1
fi

echo "Kiwix not installed yet. Opening the installer..."
open "$DMG_PATH"
echo ""
echo "To install:"
echo "1. Drag Kiwix to your Applications folder"
echo "2. Run this launcher again"
echo ""
read -p "Press Enter to exit..."
`;

    await fs.writeFile(commandPath, scriptContent, { mode: 0o755 });
    console.log('✓ Created macOS launcher');
  }

  /**
   * Create README with instructions for all platforms
   * @param {string} usbPath - USB drive path
   */
  async createReadme(usbPath) {
    const readmePath = path.join(usbPath, 'README.txt');

    const content = `WIKIPREPARED - Offline Wikipedia USB
=====================================

This USB contains Wikipedia content that works offline on any device.


WINDOWS
-------
Double-click "START - Windows.bat" to launch the reader.
Then drag files from the "Library" folder into Kiwix.


MAC
---
1. Double-click "START - Mac.command"
2. If Kiwix isn't installed, it will open the installer
3. Drag Kiwix to Applications, then run the launcher again
4. Drag files from the "Library" folder into Kiwix


LINUX
-----
1. Right-click "START - Linux.AppImage" > Properties > Permissions
2. Check "Allow executing file as program"
3. Double-click to run, or run from terminal:
   ./"START - Linux.AppImage" Library/*.zim
4. This will open Kiwix with your Wikipedia files loaded


ANDROID
-------
1. Copy "Install on Android.apk" to your phone
2. Open the APK to install Kiwix
3. Copy files from the "Library" folder to your phone
4. Open Kiwix and browse to the files


ADDING CONTENT TO KIWIX
-----------------------
After launching Kiwix, drag .zim files from the "Library"
folder into the Kiwix window, or use File > Open.


Created with WikiPrepared - wikiprepared.com
`;

    await fs.writeFile(readmePath, content);
    console.log('✓ Created README');
  }

  /**
   * Create a .desktop file for Linux desktop environments
   * This is optional - the shell script works everywhere
   * @param {string} usbPath - USB drive path
   */
  async createLinuxDesktopFile(usbPath) {
    const desktopPath = path.join(usbPath, 'Kiwix Reader.desktop');

    const desktopContent = `[Desktop Entry]
Version=1.0
Type=Application
Name=Kiwix Reader (WikiPrepared)
Comment=Launch Kiwix Offline Wikipedia Reader
Exec=bash -c 'cd "$(dirname "%k")" && ./.data/kiwix-linux.AppImage 2>/dev/null'
Icon=kiwix
Terminal=false
Categories=Education;
Keywords=wikipedia;offline;kiwix;
StartupNotify=true
`;

    await fs.writeFile(desktopPath, desktopContent, { mode: 0o755 });
    console.log('✓ Created Linux .desktop file');
  }

  /**
   * Create library.xml file that tells Kiwix where ZIM files are
   * @param {string} usbPath - USB drive path
   */
  async createLibraryXML(usbPath) {
    const libraryPath = path.join(usbPath, 'Library');
    const xmlPath = path.join(usbPath, '.data', 'library.xml');

    // Ensure .data directory exists
    await fs.ensureDir(path.join(usbPath, '.data'));

    try {
      // Find all .zim files in Library folder
      const files = await fs.readdir(libraryPath);
      const zimFiles = files.filter(f => f.endsWith('.zim'));

      if (zimFiles.length === 0) {
        console.log('No ZIM files found, skipping library.xml creation');
        return;
      }

      // Create library.xml
      let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<library version="20110515">\n';

      for (const zimFile of zimFiles) {
        const zimPath = path.join(libraryPath, zimFile);
        const stats = await fs.stat(zimPath);

        // Extract basic info from filename (e.g., wikipedia_en_all_maxi_2025-11.zim)
        const parts = zimFile.replace('.zim', '').split('_');
        const title = zimFile.replace('.zim', '').replace(/_/g, ' ');
        const id = zimFile.replace('.zim', '');

        xmlContent += `  <book id="${id}"\n`;
        xmlContent += `        path="${zimPath}"\n`;
        xmlContent += `        url="${zimFile}"\n`;
        xmlContent += `        title="${title}"\n`;
        xmlContent += `        size="${stats.size}"/>\n`;
      }

      xmlContent += '</library>\n';

      await fs.writeFile(xmlPath, xmlContent, 'utf-8');
      console.log(`✓ Created library.xml with ${zimFiles.length} ZIM file(s)`);
    } catch (error) {
      console.log('Warning: Could not create library.xml:', error.message);
    }
  }
}

module.exports = PlatformLauncherService;
