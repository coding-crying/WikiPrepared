const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');
const { URLS, CACHE_SETTINGS, LANGUAGE_CODES } = require('../../shared/constants');

/**
 * ZimManager - Handles ZIM catalog fetching and management
 */
class ZimManager {
  constructor() {
    this.catalog = [];
    this.catalogTimestamp = null;
    this.cacheDir = path.join(app.getPath('userData'), 'cache');
    this.cacheFile = path.join(this.cacheDir, 'zim-catalog.json');

    // Ensure cache directory exists
    fs.ensureDirSync(this.cacheDir);
  }

  /**
   * Fetch the ZIM catalog from Wikimedia dumps
   * @param {boolean} forceRefresh - Force refresh even if cache is valid
   * @returns {Promise<Array>} Array of ZIM file objects
   */
  async fetchCatalog(forceRefresh = false) {
    try {
      // Check if we have a valid cached catalog
      if (!forceRefresh && this.isCacheValid()) {
        console.log('Using cached ZIM catalog');
        return this.catalog;
      }

      console.log('Fetching ZIM catalog from Wikimedia...');

      // Fetch the directory listing
      const response = await axios.get(URLS.WIKIMEDIA_DUMPS, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Kiwix-USB-Updater/0.1.0',
        },
      });

      // Parse the HTML directory listing
      const zims = this.parseDirectoryListing(response.data);

      // Update cache
      this.catalog = zims;
      this.catalogTimestamp = Date.now();
      await this.saveCache();

      console.log(`Fetched ${zims.length} ZIM files from catalog`);

      return zims;
    } catch (error) {
      console.error('Error fetching ZIM catalog:', error);

      // Try to return cached data even if expired
      if (this.catalog.length > 0) {
        console.warn('Using expired cache due to fetch error');
        return this.catalog;
      }

      throw new Error('Failed to fetch ZIM catalog');
    }
  }

  /**
   * Parse HTML directory listing from Wikimedia dumps
   * @param {string} html - HTML content
   * @returns {Array} Array of ZIM file objects
   */
  parseDirectoryListing(html) {
    const $ = cheerio.load(html);
    const zims = [];

    // Find all links to .zim files
    $('a[href$=".zim"]').each((i, element) => {
      const href = $(element).attr('href');
      const filename = href;

      // Skip if it's a torrent or metadata file
      if (filename.includes('.torrent') || filename.includes('.meta4')) {
        return;
      }

      // Parse filename for metadata
      const metadata = this.parseZimFilename(filename);

      if (metadata.valid) {
        let size = 0;
        let sizeText = '';
        let dateText = '';

        // Try different methods to extract size from Apache directory listing
        const parent = $(element).parent();

        // Method 1: Check if parent is a table cell with siblings
        if (parent.is('td')) {
          const sizeTd = parent.next();
          const dateTd = sizeTd.next();
          sizeText = sizeTd.text().trim();
          dateText = dateTd.text().trim();
        } else {
          // Method 2: Parse from text content after the link
          // Apache listings typically format as: <a>filename</a>  date  size
          const parentText = parent.text();
          const linkText = $(element).text();
          const afterLink = parentText.substring(parentText.indexOf(linkText) + linkText.length).trim();

          // Split by whitespace and look for size pattern (ends with G, M, K, or just numbers)
          const parts = afterLink.split(/\s+/).filter(p => p.length > 0);

          // Look for size in parts (typically matches pattern like "1.5G" or "500M")
          for (const part of parts) {
            if (/^[\d.]+[KMGT]?$/i.test(part)) {
              sizeText = part;
              break;
            }
          }

          // Date is usually first in format like "2024-01-15"
          if (parts.length > 0 && /^\d{4}-\d{2}-\d{2}/.test(parts[0])) {
            dateText = parts[0];
          }
        }

        size = this.parseSize(sizeText);

        // Debug log first few entries to help troubleshoot
        if (i < 3) {
          console.log(`[ZimManager] Parsed ZIM: ${filename}, sizeText: "${sizeText}", size: ${size} bytes`);
        }

        zims.push({
          filename,
          url: URLS.WIKIMEDIA_DUMPS + filename,
          ...metadata,
          size,
          sizeText,
          dateModified: dateText,
          description: this.generateDescription(metadata),
        });
      }
    });

    console.log(`[ZimManager] Total ZIMs parsed: ${zims.length}`);
    return zims;
  }

  /**
   * Parse ZIM filename to extract metadata
   * Format: wikipedia_<lang>_<topic>_<scope>_<YYYY-MM>.zim
   * @param {string} filename - ZIM filename
   * @returns {Object} Parsed metadata
   */
  parseZimFilename(filename) {
    const metadata = {
      source: null,
      language: null,
      languageName: null,
      topic: null,
      scope: null,
      date: null,
      valid: false,
    };

    try {
      // Remove .zim extension
      const nameWithoutExt = filename.replace(/\.zim$/i, '');

      // Split by underscore
      const parts = nameWithoutExt.split('_');

      if (parts.length >= 4) {
        metadata.source = parts[0]; // e.g., "wikipedia"
        metadata.language = parts[1]; // e.g., "en"
        metadata.languageName = LANGUAGE_CODES[parts[1]] || parts[1];
        metadata.topic = parts[2]; // e.g., "all"
        metadata.scope = parts[3]; // e.g., "maxi", "nopic", "mini"

        // Date might be in format YYYY-MM
        if (parts.length >= 5) {
          const datePart = parts[4];
          // Validate date format (YYYY-MM)
          if (/^\d{4}-\d{2}$/.test(datePart)) {
            metadata.date = datePart;
          }
        }

        metadata.valid = true;
      }
    } catch (error) {
      console.warn('Error parsing ZIM filename:', filename, error);
    }

    return metadata;
  }

  /**
   * Generate a human-readable description for a ZIM file
   * @param {Object} metadata - Parsed metadata
   * @returns {string} Description
   */
  generateDescription(metadata) {
    const parts = [];

    if (metadata.languageName) {
      parts.push(metadata.languageName);
    }

    if (metadata.source) {
      parts.push(metadata.source.charAt(0).toUpperCase() + metadata.source.slice(1));
    }

    if (metadata.topic && metadata.topic !== 'all') {
      parts.push(`(${metadata.topic})`);
    }

    if (metadata.scope) {
      const scopeDesc = {
        mini: 'Mini - Lead sections only',
        nopic: 'No Pictures - Full text',
        maxi: 'Complete with images',
      };
      parts.push(`- ${scopeDesc[metadata.scope] || metadata.scope}`);
    }

    if (metadata.date) {
      parts.push(`[${metadata.date}]`);
    }

    return parts.join(' ');
  }

  /**
   * Parse file size string to bytes
   * @param {string} sizeText - Size text (e.g., "1.5G", "500M")
   * @returns {number} Size in bytes
   */
  parseSize(sizeText) {
    if (!sizeText) return 0;

    const match = sizeText.match(/^([\d.]+)([KMGT]?)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers = {
      '': 1,
      K: 1024,
      M: 1024 ** 2,
      G: 1024 ** 3,
      T: 1024 ** 4,
    };

    return Math.floor(value * (multipliers[unit] || 1));
  }

  /**
   * Filter ZIMs by various criteria
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} Filtered ZIM list
   */
  async filterZims(filters = {}) {
    try {
      // Ensure we have a catalog
      if (this.catalog.length === 0) {
        await this.fetchCatalog();
      }

      let filtered = [...this.catalog];

      // Filter by language
      if (filters.language && filters.language.length > 0) {
        const languages = Array.isArray(filters.language) ? filters.language : [filters.language];
        filtered = filtered.filter((zim) => languages.includes(zim.language));
      }

      // Filter by scope
      if (filters.scope && filters.scope.length > 0) {
        const scopes = Array.isArray(filters.scope) ? filters.scope : [filters.scope];
        filtered = filtered.filter((zim) => scopes.includes(zim.scope));
      }

      // Filter by topic
      if (filters.topic && filters.topic.length > 0) {
        const topics = Array.isArray(filters.topic) ? filters.topic : [filters.topic];
        filtered = filtered.filter((zim) => topics.includes(zim.topic));
      }

      // Filter by size range
      if (filters.minSize) {
        filtered = filtered.filter((zim) => zim.size >= filters.minSize);
      }
      if (filters.maxSize) {
        filtered = filtered.filter((zim) => zim.size <= filters.maxSize);
      }

      // Filter by date
      if (filters.minDate) {
        filtered = filtered.filter((zim) => zim.date >= filters.minDate);
      }

      // Sort
      if (filters.sortBy) {
        filtered.sort((a, b) => {
          switch (filters.sortBy) {
            case 'name':
              return a.filename.localeCompare(b.filename);
            case 'size':
              return filters.sortOrder === 'desc' ? b.size - a.size : a.size - b.size;
            case 'date':
              return filters.sortOrder === 'desc'
                ? (b.date || '').localeCompare(a.date || '')
                : (a.date || '').localeCompare(b.date || '');
            case 'language':
              return a.language.localeCompare(b.language);
            default:
              return 0;
          }
        });
      }

      return filtered;
    } catch (error) {
      console.error('Error filtering ZIMs:', error);
      throw error;
    }
  }

  /**
   * Search ZIMs by text query
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Matching ZIMs
   */
  async searchZims(searchTerm) {
    try {
      if (!searchTerm || searchTerm.trim() === '') {
        return this.catalog;
      }

      // Ensure we have a catalog
      if (this.catalog.length === 0) {
        await this.fetchCatalog();
      }

      const term = searchTerm.toLowerCase();

      return this.catalog.filter((zim) => {
        return (
          zim.filename.toLowerCase().includes(term) ||
          zim.description.toLowerCase().includes(term) ||
          zim.language.toLowerCase().includes(term) ||
          (zim.languageName && zim.languageName.toLowerCase().includes(term))
        );
      });
    } catch (error) {
      console.error('Error searching ZIMs:', error);
      throw error;
    }
  }

  /**
   * Check if cache is valid
   * @returns {boolean} True if cache is valid
   */
  isCacheValid() {
    if (!this.catalogTimestamp || this.catalog.length === 0) {
      // Try to load from disk
      try {
        const cacheData = fs.readJsonSync(this.cacheFile);
        this.catalog = cacheData.catalog || [];
        this.catalogTimestamp = cacheData.timestamp;
      } catch (error) {
        return false;
      }
    }

    // Check if cache has expired
    const age = Date.now() - this.catalogTimestamp;
    return age < CACHE_SETTINGS.CATALOG_TTL;
  }

  /**
   * Save catalog to disk cache
   */
  async saveCache() {
    try {
      await fs.writeJson(this.cacheFile, {
        catalog: this.catalog,
        timestamp: this.catalogTimestamp,
      });
      console.log('Catalog cache saved');
    } catch (error) {
      console.error('Error saving catalog cache:', error);
    }
  }

  /**
   * Clear the catalog cache
   */
  async clearCache() {
    try {
      this.catalog = [];
      this.catalogTimestamp = null;
      await fs.remove(this.cacheFile);
      console.log('Catalog cache cleared');
    } catch (error) {
      console.error('Error clearing catalog cache:', error);
    }
  }
}

module.exports = ZimManager;
