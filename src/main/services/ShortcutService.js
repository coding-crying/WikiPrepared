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

    // Use PowerShell to create shortcut
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    const iconPathEscaped = iconPath.replace(/\\/g, '\\\\');
    const targetPathEscaped = targetPath.replace(/\\/g, '\\\\');
    const shortcutPathEscaped = shortcutPath.replace(/\\/g, '\\\\');

    const psScript = `
$WScriptShell = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptShell.CreateShortcut("${shortcutPathEscaped}")
$Shortcut.TargetPath = "${targetPathEscaped}"
$Shortcut.IconLocation = "${iconPathEscaped}"
$Shortcut.Description = "${description}"
$Shortcut.Save()
    `.trim();

    try {
      await execPromise(`powershell -Command "${psScript}"`);
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
