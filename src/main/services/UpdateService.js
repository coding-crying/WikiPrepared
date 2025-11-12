const semver = require('semver');

/**
 * UpdateService - Handles update detection and comparison
 */
class UpdateService {
  /**
   * Scan USB drive for installed ZIM files
   * @param {string} drivePath - Path to USB drive
   * @returns {Promise<Array>} Array of installed ZIM info
   */
  async scanInstalledZims(drivePath) {
    // This would typically delegate to DriveManager.scanZimFiles
    // Kept as separate service for potential future enhancements
    const DriveManager = require('../managers/DriveManager');
    const driveManager = new DriveManager();

    return await driveManager.scanZimFiles(drivePath);
  }

  /**
   * Check for updates by comparing installed ZIMs with online catalog
   * @param {Array} installedZims - Array of installed ZIM objects
   * @param {Array} catalog - Online catalog array
   * @returns {Promise<Array>} Array of update information
   */
  async checkForUpdates(installedZims, catalog) {
    try {
      const updates = [];

      for (const installed of installedZims) {
        const metadata = installed.metadata;

        if (!metadata || !metadata.valid) {
          // Can't determine update status for invalid ZIM
          updates.push({
            installed,
            status: 'unknown',
            updateAvailable: false,
            message: 'Unable to parse ZIM filename',
          });
          continue;
        }

        // Find matching ZIM in catalog
        const matches = catalog.filter(
          (zim) =>
            zim.language === metadata.language &&
            zim.topic === metadata.topic &&
            zim.scope === metadata.scope
        );

        if (matches.length === 0) {
          // No match found in catalog
          updates.push({
            installed,
            status: 'not_found',
            updateAvailable: false,
            message: 'ZIM not found in catalog',
          });
          continue;
        }

        // Get the latest version from matches
        const latest = this.getLatestVersion(matches);

        // Compare versions
        const comparison = this.compareVersions(metadata.date, latest.date);

        let status;
        let message;
        let updateAvailable = false;

        if (comparison < 0) {
          status = 'outdated';
          message = `Update available: ${latest.date}`;
          updateAvailable = true;
        } else if (comparison === 0) {
          status = 'up_to_date';
          message = 'Up to date';
        } else {
          status = 'newer';
          message = 'Installed version is newer than catalog';
        }

        updates.push({
          installed,
          latest,
          status,
          updateAvailable,
          message,
          installedDate: metadata.date,
          latestDate: latest.date,
        });
      }

      return updates;
    } catch (error) {
      console.error('Error checking for updates:', error);
      throw error;
    }
  }

  /**
   * Get the latest version from an array of ZIM files
   * @param {Array} zims - Array of ZIM objects with dates
   * @returns {Object} Latest ZIM object
   */
  getLatestVersion(zims) {
    if (zims.length === 0) {
      return null;
    }

    return zims.reduce((latest, current) => {
      if (!latest.date) return current;
      if (!current.date) return latest;

      return current.date > latest.date ? current : latest;
    });
  }

  /**
   * Compare two version dates
   * @param {string} installedDate - Installed version date (YYYY-MM)
   * @param {string} latestDate - Latest version date (YYYY-MM)
   * @returns {number} -1 if installed < latest, 0 if equal, 1 if installed > latest
   */
  compareVersions(installedDate, latestDate) {
    if (!installedDate || !latestDate) {
      return 0;
    }

    // Simple string comparison works for YYYY-MM format
    if (installedDate < latestDate) {
      return -1;
    } else if (installedDate > latestDate) {
      return 1;
    } else {
      return 0;
    }
  }

  /**
   * Generate update recommendations
   * @param {Array} updates - Update information array
   * @returns {Object} Recommendations summary
   */
  generateRecommendations(updates) {
    const summary = {
      total: updates.length,
      upToDate: 0,
      outdated: 0,
      unknown: 0,
      notFound: 0,
      totalUpdateSize: 0,
      recommendations: [],
    };

    for (const update of updates) {
      switch (update.status) {
        case 'up_to_date':
          summary.upToDate++;
          break;
        case 'outdated':
          summary.outdated++;
          if (update.latest && update.latest.size) {
            summary.totalUpdateSize += update.latest.size;
          }
          summary.recommendations.push({
            type: 'update',
            installed: update.installed,
            latest: update.latest,
            priority: 'normal',
          });
          break;
        case 'unknown':
          summary.unknown++;
          break;
        case 'not_found':
          summary.notFound++;
          break;
      }
    }

    return summary;
  }
}

module.exports = UpdateService;
