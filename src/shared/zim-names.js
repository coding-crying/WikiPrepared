/**
 * ZIM filename + Kiwix URL helpers shared by the main-process managers.
 *
 * Kiwix filenames look like  <project>_<lang>_<topic...>_<scope>_<YYYY-MM>.zim
 * but the scope is optional (`wikipedia_en_100_2026-08.zim` has none and is the
 * full "maxi" flavour) and topics may contain underscores
 * (`wikipedia_ar_for_schools_maxi_2024-05.zim`).
 */

const KNOWN_SCOPES = new Set(['mini', 'nopic', 'maxi']);
const DATE_RE = /^\d{4}-\d{2}[a-z]?$/; // Kiwix re-releases get a letter suffix (2026-07a)

const KIWIX_DOWNLOAD_BASE = 'https://download.kiwix.org/zim/';
const WIKIMEDIA_MIRROR_BASE = 'https://dumps.wikimedia.org/other/kiwix/zim/';

function parseZimFilename(filename) {
  const metadata = {
    source: null,
    language: null,
    topic: null,
    scope: null,
    date: null,
    valid: false,
  };
  if (typeof filename !== 'string') return metadata;

  const parts = filename.replace(/\.zim$/i, '').split('_');
  if (parts.length < 3) return metadata;

  let end = parts.length;
  if (DATE_RE.test(parts[end - 1])) {
    metadata.date = parts[end - 1];
    end -= 1;
  }

  metadata.source = parts[0];
  metadata.language = parts[1];

  let rest = parts.slice(2, end);
  if (rest.length && KNOWN_SCOPES.has(rest[rest.length - 1])) {
    metadata.scope = rest[rest.length - 1];
    rest = rest.slice(0, -1);
  } else if (rest.length) {
    // No explicit flavour in the name: Kiwix publishes these as the full edition.
    metadata.scope = 'maxi';
  }

  if (!rest.length) return metadata;
  metadata.topic = rest.join('_');
  metadata.valid = Boolean(metadata.source && metadata.language && metadata.topic);
  return metadata;
}

/** Identity of a ZIM "edition" ignoring its date, used to keep only the latest. */
function zimSeriesKey(filename) {
  const m = parseZimFilename(filename);
  return `${m.source}|${m.language}|${m.topic}|${m.scope}`;
}

/** Keep only the newest dated file of each series (input order otherwise kept). */
function latestPerSeries(entries, getFilename = (e) => e.filename) {
  const best = new Map();
  for (const entry of entries) {
    const name = getFilename(entry);
    const key = zimSeriesKey(name);
    const date = parseZimFilename(name).date || '';
    const current = best.get(key);
    if (!current || date > current.date) best.set(key, { entry, date });
  }
  const keep = new Set([...best.values()].map((v) => v.entry));
  return entries.filter((e) => keep.has(e));
}

/**
 * Map any known Kiwix mirror URL (dumps.wikimedia.org, download.kiwix.org, ...)
 * to the path relative to the Kiwix `zim/` tree, e.g. `wikipedia/foo.zim`.
 */
function kiwixRelativePath(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(/\/zim\/([^?#]+\.zim)(?:[?#].*)?$/i);
  return m ? m[1] : null;
}

/** download.kiwix.org redirects to the nearest fast mirror and hosts .sha256/.meta4. */
function kiwixDownloadUrl(url) {
  const rel = kiwixRelativePath(url);
  return rel ? KIWIX_DOWNLOAD_BASE + rel : null;
}

function wikimediaMirrorUrl(url) {
  const rel = kiwixRelativePath(url);
  return rel ? WIKIMEDIA_MIRROR_BASE + rel : null;
}

/** URLs that may publish a SHA-256 for this ZIM, most authoritative first. */
function sha256CandidateUrls(url) {
  const out = [];
  const kiwix = kiwixDownloadUrl(url);
  if (kiwix) out.push(`${kiwix}.sha256`);
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    out.push(`${url}.sha256`, `${url}.sha256sum`);
  }
  return [...new Set(out)];
}

module.exports = {
  KNOWN_SCOPES,
  parseZimFilename,
  zimSeriesKey,
  latestPerSeries,
  kiwixRelativePath,
  kiwixDownloadUrl,
  wikimediaMirrorUrl,
  sha256CandidateUrls,
};
