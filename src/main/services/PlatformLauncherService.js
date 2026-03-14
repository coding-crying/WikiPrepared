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
 * - Windows keeps a small launcher to find the portable EXE
 * - Linux AppImage and macOS DMG stay visible in the USB root
 * - Android APK stays visible in the USB root
 */
class PlatformLauncherService {
  escapeXml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&apos;');
  }

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
      await this.createReadme(usbPath);
      console.log('Created README');
    } catch (error) {
      console.log('README creation failed:', error.message);
    }
  }

  /**
   * Create Windows batch launcher
   * Points to the portable Kiwix Desktop installation.
   * @param {string} usbPath - USB drive path
   */
  async createWindowsLauncher(usbPath) {
    const batPath = path.join(usbPath, 'START - Windows.bat');

    // Find the Kiwix executable inside the extracted portable reader folder.
    const scriptContent = `@echo off
setlocal enabledelayedexpansion

:: Find kiwix-desktop.exe in .data\\kiwix-windows
set "KIWIX_DIR=%~dp0.data\\kiwix-windows"
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
:: Launch portable Kiwix. The prebuilt library.xml handles the ZIM catalog.
start "" "%KIWIX_EXE%"
exit /b 0
`;

    await fs.writeFile(batPath, scriptContent);
    console.log('✓ Created Windows launcher');
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
Your offline library should appear automatically.


MAC
---
1. Double-click "Install Kiwix for Mac.dmg"
2. Drag Kiwix to Applications
3. Open Kiwix and drag files from the "Library" folder into it


LINUX
-----
1. Right-click "START - Linux.AppImage" > Properties > Permissions
2. Check "Allow executing file as program"
3. Double-click to run, or run from terminal:
   ./"START - Linux.AppImage"
4. Your offline library should appear automatically


ANDROID
-------
1. Copy "Install on Android.apk" to your phone
2. Open the APK to install Kiwix
3. Copy files from the "Library" folder to your phone
4. Open Kiwix and browse to the files


ADDING CONTENT TO KIWIX
-----------------------
On Windows and Linux, WikiPrepared prebuilds the Kiwix library
so your content should appear automatically on first launch.
If you add or remove .zim files manually later, run WikiPrepared
again to refresh the portable library.


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
Exec=bash -c 'cd "$(dirname "%k")" && ./"START - Linux.AppImage" 2>/dev/null'
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
   * Create a Kiwix portable library.xml in the reader's data folder.
   * @param {string} portableDataDir - Kiwix portable data directory
   * @param {string} libraryPath - USB Library folder path
   */
  async createLibraryXML(portableDataDir, libraryPath) {
    const xmlPath = path.join(portableDataDir, 'library.xml');

    await fs.ensureDir(portableDataDir);

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
        const title = zimFile.replace('.zim', '').replace(/_/g, ' ');
        const id = zimFile.replace('.zim', '');
        const normalizedZimPath = zimPath.split(path.sep).join('/');

        xmlContent += `  <book id="${this.escapeXml(id)}"\n`;
        xmlContent += `        path="${this.escapeXml(normalizedZimPath)}"\n`;
        xmlContent += `        url="${this.escapeXml(zimFile)}"\n`;
        xmlContent += `        title="${this.escapeXml(title)}"\n`;
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
