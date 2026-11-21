const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const util = require('util');
const { pathToFileURL } = require('url');
const execPromise = util.promisify(exec);
const USB_LIBRARY_DIRNAME = 'Library';

/**
 * PlatformLauncherService - Creates platform-specific launchers
 *
 * New clean structure:
 * - Readers hidden in .data/ folder
 * - Platform launchers stay visible in the USB root
 * - Android APK stays visible in the USB root
 */
class PlatformLauncherService {
  getAssetPath(filename) {
    if (process.env.NODE_ENV === 'development') {
      return path.join(__dirname, '../assets', filename);
    }

    return path.join(process.resourcesPath, 'assets', filename);
  }

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
      await this.copyLinuxLaunchers(usbPath);
    } catch (error) {
      console.warn('Linux launcher creation failed:', error.message);
    }

    for (const launcher of ['START - Mac.command']) {
      try {
        const launcherPath = path.join(usbPath, launcher);
        await fs.copy(this.getAssetPath(launcher), launcherPath);
        await fs.chmod(launcherPath, 0o755);
        console.log(`Created ${launcher}`);
      } catch (error) {
        console.log(`${launcher} creation failed:`, error.message);
      }
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
set "KIWIX_HOME="

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
for %%I in ("%KIWIX_EXE%") do set "KIWIX_HOME=%%~dpI"
start "" /D "%KIWIX_HOME%" "%KIWIX_EXE%"
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

    // Keep the generated guide identical to the bundled source guide.
    await fs.copy(this.getAssetPath('README.txt'), readmePath);
    console.log('✓ Created README');
  }

  // FAT/exFAT and cross-platform copies may not support persistent Unix modes.
  // Keep the copied files and document the fallback, never change mount policy.
  async makeExecutable(filePath) {
    try {
      await fs.chmod(filePath, 0o755);
    } catch (error) {
      if (!['EPERM', 'EACCES', 'ENOTSUP', 'EROFS'].includes(error.code)) throw error;
      console.warn(`Could not set executable permission on ${path.basename(filePath)}; use the Linux instructions in README.txt.`);
    }
  }

  async copyLinuxLaunchers(usbPath) {
    for (const name of ['START - Linux.sh', 'Open WikiPrepared.desktop']) {
      const target = path.join(usbPath, name);
      await fs.copy(this.getAssetPath(name), target);
      await this.makeExecutable(target);
    }
  }

  /**
   * Create a Kiwix portable library.xml in the reader's data folder.
   * This is only intended for the Windows portable Kiwix layout.
   * @param {string} portableDataDir - Kiwix portable data directory
   * @param {string} libraryPath - USB library folder path
   */
  async createLibraryXML(portableDataDir, libraryPath) {
    await fs.ensureDir(portableDataDir);

    try {
      // Find all .zim files in the visible USB library folder.
      const files = await fs.readdir(libraryPath);
      const zimFiles = files
        .filter(f => f.endsWith('.zim'))
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));

      if (zimFiles.length === 0) {
        console.log('No ZIM files found, skipping library.xml creation');
        return;
      }

      // Create library.xml
      let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<library version="20110515">\n';

      for (const zimFile of zimFiles) {
        const zimPath = path.join(libraryPath, zimFile);
        const stats = await fs.stat(zimPath);

        const title = zimFile.replace('.zim', '').replace(/_/g, ' ');
        const id = zimFile.replace('.zim', '');
        const normalizedZimPath = zimPath.split(path.sep).join('/');
        const fileUrl = pathToFileURL(zimPath).href;

        xmlContent += `  <book id="${this.escapeXml(id)}"\n`;
        xmlContent += `        path="${this.escapeXml(normalizedZimPath)}"\n`;
        xmlContent += `        url="${this.escapeXml(fileUrl)}"\n`;
        xmlContent += `        title="${this.escapeXml(title)}"\n`;
        xmlContent += `        size="${stats.size}"/>\n`;
      }

      xmlContent += '</library>\n';

      await fs.writeFile(path.join(portableDataDir, 'library.xml'), xmlContent, 'utf-8');

      console.log(`✓ Created library.xml with ${zimFiles.length} ZIM file(s)`);
    } catch (error) {
      console.log('Warning: Could not create library.xml:', error.message);
    }
  }
}

module.exports = PlatformLauncherService;
