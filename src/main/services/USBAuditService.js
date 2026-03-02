const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class USBAuditService {
  constructor() {}

  extractSha256FromText(text) {
    if (!text) return null;
    const match = text.toString().match(/[a-fA-F0-9]{64}/);
    return match ? match[0].toLowerCase() : null;
  }

  shouldSkipDir(name) {
    if (!name) return false;
    const n = name.toString();
    // Common system/trash directories found on removable drives.
    return (
      n === 'System Volume Information' ||
      n === '$RECYCLE.BIN' ||
      n === '.Trash-1000' ||
      n === '.Trashes' ||
      n === 'lost+found' ||
      n === '.Spotlight-V100' ||
      n === '.fseventsd'
    );
  }

  async walkFiles(rootDir, opts) {
    const options = {
      maxDepth: Number.isFinite(opts?.maxDepth) ? opts.maxDepth : 8,
      followSymlinks: false,
    };

    const out = [];

    const walk = async (dir, depth) => {
      if (depth > options.maxDepth) return;
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch (_e) {
        return;
      }

      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          if (this.shouldSkipDir(ent.name)) continue;
          // Skip some dot folders by default, but keep .data since we may install readers there.
          if (ent.name.startsWith('.') && ent.name !== '.data') continue;
          await walk(full, depth + 1);
        } else if (ent.isFile()) {
          out.push(full);
        } else if (ent.isSymbolicLink() && options.followSymlinks) {
          try {
            const st = await fs.stat(full);
            if (st.isFile()) out.push(full);
          } catch (_e) {
            // ignore
          }
        }
      }
    };

    await walk(rootDir, 0);
    return out;
  }

  async calculateSha256WithProgress(filePath, onProgress) {
    const st = await fs.stat(filePath);
    const totalBytes = st.size || 0;

    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      let processed = 0;
      let lastEmit = Date.now();

      stream.on('data', (chunk) => {
        hash.update(chunk);
        processed += chunk.length;
        if (typeof onProgress === 'function' && Date.now() - lastEmit > 750) {
          lastEmit = Date.now();
          onProgress({ processedBytes: processed, totalBytes });
        }
      });

      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Scan a USB mount for files and verify SHA-256 where possible.
   *
   * Strategy:
   * - Always include files that have a sidecar "<file>.sha256".
   * - Always include .zim files (even if they don't have a checksum yet).
   * - Optionally include "large files" (>= minLargeFileBytes) so the UI can warn when checksums are missing.
   */
  async scan(usbPath, options = {}, onProgress) {
    const opts = {
      maxDepth: Number.isFinite(options.maxDepth) ? options.maxDepth : 8,
      includeLargeFiles: options.includeLargeFiles !== false,
      minLargeFileBytes: Number.isFinite(options.minLargeFileBytes)
        ? options.minLargeFileBytes
        : 100 * 1024 * 1024, // 100MB
      writeMissingSidecars: options.writeMissingSidecars === true,
    };

    const exists = await fs.pathExists(usbPath);
    if (!exists) throw new Error('USB path not found');

    const stat = await fs.stat(usbPath);
    if (!stat.isDirectory()) throw new Error('USB path is not a directory');

    if (typeof onProgress === 'function') {
      onProgress({ phase: 'discovering', message: 'Scanning files...' });
    }

    const allFiles = await this.walkFiles(usbPath, { maxDepth: opts.maxDepth });

    const sidecarMap = new Map(); // targetPath -> { shaPath, expected }
    const zimFiles = new Set();
    const largeFiles = new Set();

    for (const p of allFiles) {
      const lower = p.toLowerCase();
      if (lower.endsWith('.sha256')) {
        const target = p.slice(0, -'.sha256'.length);
        let expected = null;
        try {
          const txt = await fs.readFile(p, 'utf8');
          expected = this.extractSha256FromText(txt);
        } catch (_e) {
          expected = null;
        }
        sidecarMap.set(target, { shaPath: p, expected });
        continue;
      }

      if (lower.endsWith('.zim')) {
        zimFiles.add(p);
      }

      if (opts.includeLargeFiles) {
        try {
          const st = await fs.stat(p);
          if (st.isFile() && st.size >= opts.minLargeFileBytes) {
            largeFiles.add(p);
          }
        } catch (_e) {
          // ignore
        }
      }
    }

    const candidates = new Set();
    for (const t of sidecarMap.keys()) candidates.add(t);
    for (const z of zimFiles) candidates.add(z);
    for (const lf of largeFiles) candidates.add(lf);

    const filesToAudit = Array.from(candidates).sort((a, b) => a.localeCompare(b));

    const results = [];
    const summary = {
      total: filesToAudit.length,
      ok: 0,
      mismatch: 0,
      missingChecksum: 0,
      invalidChecksumFile: 0,
      missingFile: 0,
      errors: 0,
      baselineCreated: 0,
    };

    for (let i = 0; i < filesToAudit.length; i++) {
      const filePath = filesToAudit[i];
      const name = path.basename(filePath);
      const sidecar = sidecarMap.get(filePath) || null;

      let size = 0;
      try {
        const st = await fs.stat(filePath);
        if (!st.isFile()) {
          summary.missingFile += 1;
          results.push({
            filePath,
            name,
            size: 0,
            status: 'missing-file',
            expectedSha256: sidecar?.expected || null,
            actualSha256: null,
            sha256Path: sidecar?.shaPath || null,
            error: 'Target is not a file',
          });
          continue;
        }
        size = st.size;
      } catch (e) {
        summary.missingFile += 1;
        results.push({
          filePath,
          name,
          size: 0,
          status: 'missing-file',
          expectedSha256: sidecar?.expected || null,
          actualSha256: null,
          sha256Path: sidecar?.shaPath || null,
          error: e.message,
        });
        continue;
      }

      if (typeof onProgress === 'function') {
        onProgress({
          phase: 'verifying',
          currentIndex: i + 1,
          totalFiles: filesToAudit.length,
          filePath,
          name,
          size,
        });
      }

      if (!sidecar) {
        if (opts.writeMissingSidecars) {
          try {
            const actual = await this.calculateSha256WithProgress(filePath, (p) => {
              if (typeof onProgress === 'function') {
                onProgress({
                  phase: 'hashing',
                  currentIndex: i + 1,
                  totalFiles: filesToAudit.length,
                  filePath,
                  name,
                  size,
                  processedBytes: p.processedBytes,
                  totalBytes: p.totalBytes,
                });
              }
            });

            const shaPath = `${filePath}.sha256`;
            try {
              await fs.writeFile(shaPath, `${actual}  ${name}\n`, 'utf8');
              summary.baselineCreated += 1;
            } catch (_e) {
              // non-fatal
            }

            results.push({
              filePath,
              name,
              size,
              status: 'baseline-created',
              expectedSha256: null,
              actualSha256: actual,
              sha256Path: shaPath,
              error: null,
            });
          } catch (e) {
            summary.errors += 1;
            results.push({
              filePath,
              name,
              size,
              status: 'error',
              expectedSha256: null,
              actualSha256: null,
              sha256Path: null,
              error: e.message,
            });
          }
        } else {
          summary.missingChecksum += 1;
          results.push({
            filePath,
            name,
            size,
            status: 'no-checksum',
            expectedSha256: null,
            actualSha256: null,
            sha256Path: null,
            error: null,
          });
        }
        continue;
      }

      if (!sidecar.expected) {
        summary.invalidChecksumFile += 1;
        results.push({
          filePath,
          name,
          size,
          status: 'invalid-checksum-file',
          expectedSha256: null,
          actualSha256: null,
          sha256Path: sidecar.shaPath,
          error: 'Could not parse SHA-256 from sidecar file',
        });
        continue;
      }

      try {
        const actual = await this.calculateSha256WithProgress(filePath, (p) => {
          if (typeof onProgress === 'function') {
            onProgress({
              phase: 'hashing',
              currentIndex: i + 1,
              totalFiles: filesToAudit.length,
              filePath,
              name,
              size,
              processedBytes: p.processedBytes,
              totalBytes: p.totalBytes,
            });
          }
        });

        const ok = actual.toLowerCase() === sidecar.expected.toLowerCase();
        if (ok) summary.ok += 1;
        else summary.mismatch += 1;

        results.push({
          filePath,
          name,
          size,
          status: ok ? 'ok' : 'mismatch',
          expectedSha256: sidecar.expected,
          actualSha256: actual,
          sha256Path: sidecar.shaPath,
          error: null,
        });
      } catch (e) {
        summary.errors += 1;
        results.push({
          filePath,
          name,
          size,
          status: 'error',
          expectedSha256: sidecar.expected,
          actualSha256: null,
          sha256Path: sidecar.shaPath,
          error: e.message,
        });
      }
    }

    // Sort with problems first for the UI.
    const severity = (status) => {
      switch (status) {
        case 'mismatch':
          return 0;
        case 'invalid-checksum-file':
          return 1;
        case 'missing-file':
          return 2;
        case 'error':
          return 3;
        case 'no-checksum':
          return 4;
        case 'baseline-created':
          return 5;
        case 'ok':
          return 6;
        default:
          return 7;
      }
    };

    results.sort((a, b) => {
      const sa = severity(a.status);
      const sb = severity(b.status);
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name);
    });

    if (typeof onProgress === 'function') {
      onProgress({ phase: 'completed', message: 'Audit complete' });
    }

    return { results, summary, options: opts };
  }
}

module.exports = USBAuditService;

