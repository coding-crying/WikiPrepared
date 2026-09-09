const path = require('path');
const fs = require('fs-extra');

/**
 * ShortcutService - Creates Windows shortcuts with custom icons
 *
 * NOTE: This requires a Windows-specific library or PowerShell
 * For cross-platform development, shortcuts are only created on Windows
 */
class ShortcutService {
  /**
   * Create a Windows shortcut (.lnk) with custom icon
   * @param {Object} options - Shortcut options
   * @param {string} options.shortcutPath - Where to create the .lnk file
   * @param {string} options.targetPath - What the shortcut points to
   * @param {string} options.iconPath - Path to .ico file
   * @param {string} options.description - Tooltip description
   * @returns {Promise<void>}
   */
  async createWindowsShortcut(options) {
    const { shortcutPath, targetPath, iconPath, description = '' } = options;

    // Only works on Windows
    if (process.platform !== 'win32') {
      console.log('Skipping shortcut creation (not on Windows)');
      return;
    }

    // Pass the script via stdin using -Command - (no shell string context, so
    // quotes/backticks/$() in paths or descriptions cannot break out and
    // execute arbitrary PowerShell).
    const { spawn } = require('child_process');

    const psScript = `
$WScriptShell = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptShell.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
$Shortcut.TargetPath = '${targetPath.replace(/'/g, "''")}'
$Shortcut.IconLocation = '${(iconPath || '').replace(/'/g, "''")}'
$Shortcut.Description = '${String(description).replace(/'/g, "''")}'
$Shortcut.Save()
    `.trim();

    try {
      await new Promise((resolve, reject) => {
        const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '-'], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stderr = '';
        child.stderr.on('data', (d) => { stderr += d.toString(); });
        child.on('error', reject);
        child.on('close', (code) => {
          if (code === 0) return resolve();
          reject(new Error(`PowerShell exited with code ${code}: ${stderr.trim()}`));
        });
        child.stdin.end(psScript);
      });
      console.log(`Created Windows shortcut: ${shortcutPath}`);
    } catch (error) {
      console.error('Failed to create Windows shortcut:', error);
      throw error;
    }
  }

  /**
   * Create launcher shortcut on USB with icon
   * @param {string} usbPath - USB drive path
   * @param {string} iconPath - Path to icon file
   * @returns {Promise<void>}
   */
  async createUSBLauncher(usbPath, iconPath) {
    if (process.platform !== 'win32') {
      console.log('Shortcut creation only available on Windows');
      return;
    }

    const shortcutPath = path.join(usbPath, 'LAUNCH KIWIX READER (Windows).lnk');
    const targetPath = path.join(usbPath, 'START - Windows.bat');

    await this.createWindowsShortcut({
      shortcutPath,
      targetPath,
      iconPath,
      description: 'Launch Kiwix Reader - Offline Knowledge Library'
    });
  }
}

module.exports = ShortcutService;
