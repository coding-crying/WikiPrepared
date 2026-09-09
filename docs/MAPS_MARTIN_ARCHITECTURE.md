# WikiPrepared Maps — Martin + PMTiles + MapLibre Architecture

**Version:** 1.0 (Revised from MAPS_PLAN.md — Path B decision)  
**Date:** 2026-05-11  
**Status:** Draft

---

## Summary of Existing Plan (MAPS_PLAN.md)

The original `MAPS_PLAN.md` outlined two approaches for offline maps:

- **Option A (Browser-based, like Kiwix)**: Lightweight HTTP server serving MapLibre + PMTiles to the user's browser. Recommended approach.
- **Option B (Python/PySide6 app, like WikiPreparedAI)**: Qt WebEngineView embedded in a PySide6 window rendering MapLibre.

The original plan recommended **Option A** — a Go/Rust static binary HTTP server that:
1. Serves static HTML/JS/CSS (the MapLibre SPA)
2. Serves `.pmtiles` files with proper HTTP range request headers
3. Auto-discovers `.pmtiles` in a `maps/` directory
4. Auto-opens the browser on start

The USB stick would have a `WikiPrepared_Maps/` directory with launcher scripts, the server binary, the SPA, and PMTiles region files. POI search would use companion SQLite databases with FTS5.

**Key insight from the original plan:** *"The Electron app is just the stick flasher."* The maps component is a separate, standalone app on the USB stick — not inside the Electron app itself.

---

## Architecture Overview (Current Electron App)

The WikiPrepared Electron app is a **USB stick flasher**, not the on-device experience. Key architectural elements:

### Processes
| Process | Path | Role |
|---------|------|------|
| **Main** | `src/main/` | Drive detection, formatting, ZIM catalog, downloads, transfers, Kiwix installation, IPC handlers |
| **Renderer** | `src/renderer/` | Step-by-step React + MUI UI (drive selection → ZIM selection → download → transfer → completion) |
| **Preload** | `src/main/preload.js` | `contextIsolation: true`, exposes `window.electronAPI` IPC bridge |

### Key Main-Process Modules
- **DriveManager**: Enumerates USB drives via `drivelist`, watches for changes, format/eject
- **ZimManager**: Fetches/ caches ZIM catalog, filtering, metadata
- **DownloadManager**: Queues downloads with SHA-256 verification
- **KiwixManager**: Downloads Kiwix readers, installs portable launchers onto USB
- **FileService**: File copy/verify/delete operations on USB
- **PlatformLauncherService**: Creates platform-specific launchers on USB (Windows `.bat`, Linux `.sh`, macOS)
- **UpdateService / USBAuditService**: Update detection and integrity verification

### IPC Channels
32+ IPC channels covering drives, ZIMs, downloads, transfers, Kiwix, files, USB audit, and settings. All renderer→main communication goes through the preload bridge.

### Rendering / UI Flow
`InitialChoiceScreen → DriveSelectionScreen → FilesystemWarningScreen → MainConfigScreen → DownloadStrategyScreen → DownloadProgressScreen → TransferProgressScreen → CompletionScreen`

### Build System
- **Dev**: Electron Forge + webpack plugin
- **Production**: `webpack:prod` → `electron-builder` (Linux AppImage + .deb, Windows, macOS)
- No map-related code or assets exist in the current Electron app

---

## Revised Architecture: Martin + PMTiles + MapLibre

### Why Martin (Instead of a Custom Go/Rust Server)

The original plan proposed a custom Go/Rust HTTP server binary. **Martin** (https://github.com/maplibre/martin) is a better choice because:

1. **Battle-tested tile server**: Martin is a production-grade Rust tile server that natively serves PMTiles via HTTP — no custom code needed
2. **PMTiles support built-in**: Martin reads `.pmtiles` files directly from disk with proper range request handling, source discovery from directory, automatic CORS headers
3. **Tiny binary**: Martin compiles to a single ~8-15MB static binary per platform, comparable to the custom Go/Rust server the original plan proposed
4. **MBTiles too**: Martin also serves `.mbtiles` (raster tiles) — future-proofing for satellite imagery layers
4. **Source auto-discovery**: Martin auto-discovers `.pmtiles` and `.mbtiles` from a configured directory — exactly what the original plan wanted
5. **MapLibre-native**: Martin's tile JSON output is directly compatible with MapLibre GL JS source definitions
6. **Active project**: Maintained by the MapLibre organization, same ecosystem as the frontend
7. **Zero configuration**: Can run with just `martin --config config.yaml` or even auto-configure from a directory

### Architecture: Standalone on USB (Same Pattern as Kiwix)

Maps remains a **separate standalone component on the USB stick** — consistent with the existing design philosophy. The Electron flasher app doesn't run maps; it just **copies the Martin binary + PMTiles files** to the USB during the transfer step.

```
USB Stick/
├── WikiPrepared_AI/           # Python app (existing)
├── Kiwix/                     # Kiwix server (existing)
├── WikiPrepared_Maps/         # NEW — offline maps
│   ├── bin/
│   │   ├── martin-linux-x86_64      # Martin binary (Linux)
│   │   ├── martin-windows-x86_64.exe # Martin binary (Windows)
│   │   └── martin-aarch64-apple-darwin # Martin binary (macOS)
│   ├── config/
│   │   └── martin-config.yaml       # Martin configuration
│   ├── start-maps.sh                 # Linux/macOS launcher
│   ├── start-maps.bat                # Windows launcher
│   ├── web/                           # Frontend SPA
│   │   ├── index.html
│   │   ├── app.js                     # MapLibre GL JS + POI UI
│   │   ├── app.css
│   │   ├── style-dark.json           # Dark Industrial Glass map style
│   │   └── assets/
│   │       ├── fonts/                 # Inter, JetBrains Mono (PBF)
│   │       └── sprites/               # POI icon spritesheet
│   ├── maps/                          # PMTiles region files
│   │   ├── us-west.pmtiles
│   │   ├── us-east.pmtiles
│   │   └── north-america.pmtiles
│   └── poi/                           # POI search databases
│       ├── us-west.db                 # SQLite + FTS5
│       ├── us-east.db
│       └── north-america.db
├── Library/                   # ZIM files (existing)
└── launcher.sh / launcher.bat # Master menu (existing)
```

### How It Works at Runtime

```
┌─────────────────────────────────────────────┐
│              USB Stick (Offline)             │
│                                              │
│  start-maps.sh                               │
│       │                                      │
│       ▼                                      │
│  ┌──────────┐    serves     ┌──────────────┐ │
│  │  Martin  │◄──────────────┤  PMTiles     │ │
│  │  (Rust)  │   tile data   │  .pmtiles    │ │
│  │  :3000   │               │  files       │ │
│  └────┬─────┘               └──────────────┘ │
│       │                                      │
│       │ also serves                          │
│       ▼                                      │
│  ┌──────────────┐   queries  ┌────────────┐ │
│  │  MapLibre    │            │  POI SQLite │ │
│  │  GL JS SPA   │◄─────────►│  .db files  │ │
│  │  (browser)   │  search    │  (FTS5)     │ │
│  └──────────────┘            └────────────┘ │
│       │                                      │
│       ▼                                      │
│  User's default browser opens                │
│  http://localhost:3000                       │
└─────────────────────────────────────────────┘
```

### Step-by-Step Runtime Flow

1. **User double-clicks** `start-maps.sh` (Linux/macOS) or `start-maps.bat` (Windows)
2. **Launcher script** detects platform → selects correct Martin binary
3. **Launcher starts Martin**: `./bin/martin-linux-x86_64 --config config/martin-config.yaml`
4. **Martin auto-discovers** all `.pmtiles` files in `maps/` and registers them as tile sources
5. **Martin serves** the SPA frontend as static files from `web/` on the root path (`/`)
6. **Martin serves** vector tiles at `/tiles/{source}/{z}/{x}/{y}.pbf` with proper CORS and range request headers
7. **Launcher opens** the user's default browser to `http://localhost:3000`
8. **MapLibre GL JS** loads `style-dark.json`, which references the Martin tile source
9. **POI search** queries Martin's built-in SQL endpoint (if we use Martin's PG/SQLite features) or a separate lightweight handler

### Martin Configuration (`martin-config.yaml`)

```yaml
# martin-config.yaml — deployed to USB stick
listen_address: "0.0.0.0:3000"

# Serve the frontend SPA
web_server:
  - path: "web"

# Auto-discover PMTiles sources from directory
sources:
  pmtiles_dir:
    type: "pmtiles"
    path: "maps"
```

**Confirmed: Martin does NOT serve arbitrary static files.** Martin v1.9.x has a compiled-in WebUI for catalog browsing (behind `--webui enable-for-all`), but no config option for hosting custom HTML/JS/CSS directories. It serves tiles, fonts, sprites, and MapLibre style JSON — not arbitrary static content.

**Solution: Two-process architecture — Martin for tiles + `miniserve` for the SPA.**

The cleanest approach is a **single-launcher two-process** setup using `miniserve` (a tiny Rust static file server, ~1MB binary) alongside Martin:

```bash
# start-maps.sh (simplified)
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Start Martin for tile/font/sprite/style serving (port 3000)
./bin/martin-linux-x86_64 --config config/martin-config.yaml --listen-address "0.0.0.0:3000" &
MARTIN_PID=$!

# Start miniserve for SPA static files (port 3001)
# miniserve: https://github.com/svenstaro/miniserve — single Rust binary, ~1MB
./bin/miniserve-linux-x86_64 --port 3001 --index index.html --spa web/ &
MINISERVE_PID=$!

# Open browser to the SPA (which talks to Martin on port 3000 for tiles)
xdg-open "http://localhost:3001" 2>/dev/null || open "http://localhost:3001" 2>/dev/null

wait
```

**Why `miniserve` over alternatives:**

| Option | Pros | Cons |
|--------|------|------|
| **miniserve** (Rust, ~1MB) | Tiny, SPA `--index` support, single binary per platform, CORS-friendly | Extra binary to ship (~4MB total for 4 platforms) |
| Python `http.server` | No extra binary needed | No SPA routing, slow, Python may not be on target machine, no CORS headers |
| Go proxy wrapper | Single entry point | More code to maintain, wraps Martin |
| Caddy | Production-ready, reverse proxy | ~30MB binary, overkill for USB stick |

The SPA's `app.js` references Martin at `http://localhost:3000` for tiles, fonts, sprites, and styles. POI search uses `sql.js` (WASM SQLite) querying companion `.db` files loaded via XHR from `miniserve`'s port.

---

## MapLibre GL JS Frontend (SPA)

The frontend is a **single HTML + JS + CSS bundle** loaded in the browser:

```
web/
├── index.html              # Shell with map container + POI search UI
├── app.js                  # MapLibre GL JS + PMTiles protocol + POI logic
├── app.css                 # Dark Industrial Glass theme styles
├── style-dark.json         # MapLibre style definition
└── assets/
    ├── fonts/               # MapLibre font stacks (PBF format)
    │   ├── Inter-Regular/
    │   └── JetBrainsMono-Regular/
    └── sprites/             # POI icon spritesheet
        ├── sprite.json
        └── sprite.png
```

### `app.js` — Key Design

```javascript
// 1. Initialize MapLibre GL JS
const map = new maplibregl.Map({
  container: 'map',
  style: 'style-dark.json',  // or inline style object
  center: [-122.4, 37.8],
  zoom: 10
});

// 2. Add PMTiles source via Martin tile endpoint
// Martin serves tiles at /tiles/{source}/{z}/{x}/{y}.pbf
// The style-dark.json references:
//   "sources": {
//     "us-west": {
//       "type": "vector",
//       "tiles": ["http://localhost:3000/tiles/us-west/{z}/{x}/{y}.pbf"],
//       "maxzoom": 14
//     }
//   }

// 3. POI Search - query a dedicated endpoint or load from companion SQLite
// Option A: Martin serves an API endpoint for POI search
// Option B: Use sql.js (SQLite compiled to WASM) to query .db files in browser
// Option C: Pre-built geobuf/GeoJSON index loaded via fetch

// 4. Preparedness POI Layers
const PREPAREDNESS_CATEGORIES = [
  { id: 'hospital',   label: 'Hospitals',     icon: 'hospital',     color: '#ef4444' },
  { id: 'shelter',    label: 'Shelters',       icon: 'shelter',      color: '#f59e0b' },
  { id: 'water',      label: 'Water Sources',  icon: 'water',        color: '#3b82f6' },
  { id: 'fuel',       label: 'Fuel Stations',  icon: 'gas-station',  color: '#8b5cf6' },
  { id: 'police',     label: 'Police Stations', icon: 'police',       color: '#10b981' },
  { id: 'pharmacy',   label: 'Pharmacies',     icon: 'pharmacy',     color: '#06b6d4' },
];

// 5. Click POI → show popup → optional link to Kiwix
```

### `style-dark.json` — Dark Industrial Glass

```json
{
  "version": 8,
  "name": "WikiPrepared Dark",
  "sources": {
    "us-west": {
      "type": "vector",
      "tiles": ["http://localhost:3000/tiles/us-west/{z}/{x}/{y}.pbf"],
      "maxzoom": 14
    }
  },
  "sprite": "http://localhost:3000/sprites/sprite",
  "glyphs": "http://localhost:3000/fonts/{fontstack}/{range}.pbf",
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": { "background-color": "#0a0a0a" }
    },
    {
      "id": "roads",
      "type": "line",
      "source": "us-west",
      "source-layer": "transportation",
      "paint": {
        "line-color": "#333333",
        "line-width": { "base": 1, "stops": [[5, 0.5], [14, 8]] }
      }
    },
    {
      "id": "road-labels",
      "type": "symbol",
      "source": "us-west",
      "source-layer": "transportation_name",
      "layout": {
        "text-field": "{name}",
        "text-font": ["Inter Regular"],
        "text-size": 12
      },
      "paint": { "text-color": "#e0e0e0" }
    }
  ]
}
```

---

## Electron Flasher Integration

The WikiPrepared Electron app's role in maps is **purely as a flasher** — it copies the Martin binary + PMTiles + POI DB files from a catalog/cache to the USB stick. Here's how:

### New IPC Channels (to add)

```javascript
// In src/shared/ipc-channels.js — add:
MAPS_GET_REGIONS: 'maps:get-regions',        // List available map regions + sizes
MAPS_DOWNLOAD: 'maps:download',              // Download a PMTiles + DB pair to cache
MAPS_INSTALL: 'maps:install',                // Copy from cache to USB
MAPS_GET_CACHE_INFO: 'maps:get-cache-info',  // Size of cached map files
```

### New Manager: `src/main/managers/MapsManager.js`

```javascript
class MapsManager {
  constructor() {
    this.mapsCatalog = null;       // Available regions from CDN
    this.cacheDir = null;          // Local cache for downloaded PMTiles
  }

  // Fetch catalog of available map regions
  async fetchCatalog() { ... }

  // Download a PMTiles + POI DB to local cache
  async downloadRegion(regionId, onProgress) { ... }

  // Install Martin binary + config + selected regions to USB
  async installToUsb(usbPath, regionIds) { ... }

  // Detect which Martin binaries are needed (platform detection)
  async getRequiredBinaries() { ... }

  // Calculate space needed on USB for selected regions
  async calculateSpaceNeeded(regionIds) { ... }
}
```

### UI Changes (Renderer)

The existing `MainConfigScreen.jsx` needs a new "Maps" step. The app flow becomes:

```
InitialChoice → DriveSelection → FilesystemWarning → MainConfig 
  → Select ZIMs (existing) 
  → Select Map Region (NEW)
  → DownloadStrategy 
  → DownloadProgress (ZIMs + PMTiles + Martin) 
  → TransferProgress 
  → Completion
```

Or more simply, the maps region selection is added as a section within `MainConfigScreen`, alongside ZIM selection, using the same download queue.

### Transfer Logic (`FileService` / `KiwixManager` pattern)

When copying to USB, the flasher:
1. Creates `WikiPrepared_Maps/` directory on the USB
2. Copies the correct Martin binary for the USB's target platform (or all platforms if size permits)
3. Copies `martin-config.yaml`
4. Copies `web/` directory (SPA frontend)
5. Copies selected `.pmtiles` region files to `maps/`
6. Copies companion `.db` POI files to `poi/`
7. Creates `start-maps.sh` and `start-maps.bat` launcher scripts (using `PlatformLauncherService` pattern)

---

## PMTiles Data Pipeline

### Source: Protomaps Basemaps

Same as original plan:
- **Option 1**: Download pre-built regions from `maps.protomaps.com` (free, ODbL license)
- **Option 2**: Self-generate using `protomaps/basemaps` (Planetiler, needs Java 21+)

### POI Extraction Pipeline (Adapted from `nomad-map-search`)

The [nomad-map-search](https://github.com/acrossi/nomad-map-search) project by the Project N.O.M.A.D. team provides a ready-made pipeline for extracting POIs from PMTiles into SQLite FTS5 databases. Its architecture is directly adaptable:

```
PMTiles file
    ↓ (pmtiles Python lib + vtzero protobuf decoder)
pmtiles_extractor → raw features (GeoJSON)
    ↓ (text_normalizer: Unicode NFKC → lowercase → ASCII-fold)
indexer → SQLite FTS5 search database (.db)
    ↓
Browser-side: sql.js (WASM SQLite) queries .db for POI search
Martin: serves PMTiles tiles for map rendering
```

**Key adaptations from nomad-map-search:**

| nomad-map-search feature | WikiPrepared adaptation |
|---|---|
| FastAPI server `/search?q=&lat=&lon=&type=` | **Replaced by sql.js in-browser** — no server process needed, query .db directly via WASM |
| `pmtiles_extractor.py` PMTiles → GeoJSON | **Same pipeline** — extract from PMTiles at build time, not runtime |
| SQLite FTS5 with `unicode61` tokenizer | **Same** — FTS5 + haversine proximity ranking built into SQLite |
| `LAYER_TYPE_MAP` (poi/place/street/waterway) | **Same** + expand `POI_SUBTYPES` with preparedness categories |
| `text_normalizer.py` (NFKC + ASCII-fold) | **Reuse directly** — handles diacritics, Unicode, CJK text |
| Haversine distance ranking (0.6 proximity / 0.4 text) | **Increase proximity weight** to 0.7-0.8 — preparedness search is location-critical |
| FastAPI dependency | **Remove** — sql.js replaces the entire server |

**Preparedness-specific POI subtypes** (expanded from nomad-map-search's `POI_SUBTYPES`):

```python
PREPAREDNESS_SUBTYPES = {
    # Medical
    "hospital", "clinic", "doctor", "dentist", "pharmacy",
    # Emergency services
    "police", "fire_station", "rescue_station",
    # Shelter / infrastructure
    "shelter", "camp_site", "caravan_site",
    # Fuel & transport
    "fuel", "charging_station", "bus_station", "ferry_terminal",
    # Food & water
    "supermarket", "convenience", "bakery", "water_point", "drinking_water",
    # Communication
    "post_office", "telephone",
}
```

Most of these are **already in nomad-map-search's `POI_SUBTYPES`** set, making adaptation minimal.

### Preparedness POI Categories (OSM Tags)

| Category | OSM Tags | Icon |
|----------|---------|------|
| Hospitals | `amenity=hospital` | 🏥 |
| Shelters | `amenity=shelter`, `building=shelter` | 🏕️ |
| Water | `amenity=drinking_water`, `natural=spring`, `waterway=water_point` | 💧 |
| Fuel | `amenity=fuel` | ⛽ |
| Police | `amenity=police` | 🚔 |
| Pharmacies | `amenity=pharmacy` | 💊 |
| Fire Stations | `amenity=fire_station` | 🚒 |
| Emergency Phones | `emergency=phone` | 📞 |

---

## Launcher Scripts

### Linux/macOS: `start-maps.sh`

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Detect platform
OS="$(uname -s)"
ARCH="$(uname -m)"

if [ "$OS" = "Linux" ]; then
    MARTIN_BIN="$SCRIPT_DIR/bin/martin-linux-x86_64"
elif [ "$OS" = "Darwin" ]; then
    if [ "$ARCH" = "arm64" ]; then
        MARTIN_BIN="$SCRIPT_DIR/bin/martin-aarch64-apple-darwin"
    else
        MARTIN_BIN="$SCRIPT_DIR/bin/martin-x86_64-apple-darwin"
    fi
else
    echo "Unsupported OS: $OS"
    exit 1
fi

chmod +x "$MARTIN_BIN" 2>/dev/null || true

# Find available port
PORT=3000
while lsof -i :$PORT >/dev/null 2>&1; do
    PORT=$((PORT + 1))
done

# Start Martin
"$MARTIN_BIN" --config "$SCRIPT_DIR/config/martin-config.yaml" --listen-address "0.0.0.0:$PORT" &
MARTIN_PID=$!

# Wait for Martin to be ready
for i in $(seq 1 30); do
    if curl -s "http://localhost:$PORT/" >/dev/null 2>&1; then
        break
    fi
    sleep 0.5
done

# Open in default browser
xdg-open "http://localhost:$PORT" 2>/dev/null || open "http://localhost:$PORT" 2>/dev/null

echo "WikiPrepared Maps running on http://localhost:$PORT"
echo "Press Ctrl+C to stop"
wait $MARTIN_PID
```

### Windows: `start-maps.bat`

```bat
@echo off
cd /d "%~dp0"

set PORT=3000
:checkport
netstat -an | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    set /a PORT+=1
    goto checkport
)

start "" "bin\martin-windows-x86_64.exe" --config "config\martin-config.yaml" --listen-address "0.0.0.0:%PORT%"

:waitloop
timeout /t 1 /nobreak >nul
curl -s http://localhost:%PORT%/ >nul 2>&1
if %errorlevel% neq 0 goto waitloop

start http://localhost:%PORT%

echo WikiPrepared Maps running on http://localhost:%PORT%
echo Press Ctrl+C to stop
```

---

## Martin Binary Sizing

| Platform | Binary Size (approx) |
|----------|---------------------|
| Linux x86_64 | ~8-12 MB |
| Windows x86_64 | ~8-12 MB |
| macOS (Apple Silicon) | ~8-12 MB |
| macOS (Intel) | ~8-12 MB |

Total if shipping all 4: ~32-48 MB for binaries.  
**Recommendation**: Only ship the binary matching the USB stick's target platform during flashing. The Electron flasher knows the platform and copies only the needed binary.

---

## Cross-App Integration (Phase 2)

Same as original plan, but with Martin's native API:

| Service | Port | Purpose |
|---------|------|---------|
| Kiwix | 8080 | Wikipedia/ZIM content |
| WikiPreparedAI | 8079 | AI chat |
| Martin/Maps | 3000 | Maps + tiles + POI search |
| Valhalla (future) | 8082 | Offline routing |

### Deep Linking

- POI click → `http://localhost:8080/wiki/Hospital_name` (open in Kiwix)
- WikiAI mentions a location → `http://localhost:3000/#map=12/47.6/-122.3` (open in Maps)
- Maps "Learn more" link → `http://localhost:8079/chat?context=hospital_prep` (open in WikiAI)

---

## Key Differences from Original MAPS_PLAN.md

| Aspect | Original Plan | Revised (This Document) |
|--------|--------------|------------------------|
| **Tile Server** | Custom Go/Rust HTTP server | **Martin** (production-grade, MapLibre-native) |
| **Server Role** | Custom server serves tiles + static files | Martin serves tiles; static SPA served by Martin (if `--static-dir` supported) or proxy |
| **PMTiles Access** | Custom range request handler | Martin's built-in PMTiles source support |
| **Source Discovery** | Custom auto-discovery script | Martin's built-in directory scanning |
| **POI Search** | SQLite via custom API or in-browser | SQLite via Martin's built-in functions (or sql.js in-browser WASM — TBD) |
| **Binary Count** | 1 custom binary | 1 Martin binary (per platform) |
| **Maintenance** | We maintain custom server | Community-maintained Martin |
| **CORS** | Must implement manually | Martin handles CORS automatically |
| **TileJSON** | Must generate manually | Martin auto-generates TileJSON |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Martin doesn't support static file serving | Ship a tiny static file server (~50 LOC Go binary, ~3MB) or use Python's `http.server` |
| Martin binary too large for USB budget | ~10MB per platform is acceptable; ship only the target platform's binary |
| PMTiles files are huge (3-6GB for North America) | Offer regional selections; use Protomaps' pre-built extracts |
| SQLite POI search needs server-side process | Use `sql.js` (SQLite compiled to WASM) to query `.db` files directly in the browser |
| USB stick filesystem doesn't support large files (>4GB FAT32) | Recommend exFAT formatting; document this in the flasher UI |
| Port conflicts with Kiwix (8080) | Default Martin to port 3000; launcher detects and increments |
| Martin binary availability for all platforms | Pre-download and cache all platform binaries in the Electron flasher |

---

## Implementation Roadmap

### Phase 1: MVP (Offline Maps on USB)
- [ ] Download Martin binaries for Linux/Windows/macOS
- [ ] Create `martin-config.yaml` template
- [ ] Build MapLibre SPA (`web/` directory) with dark style
- [ ] Create launcher scripts (`start-maps.sh`, `start-maps.bat`)
- [ ] Download Protomaps PMTiles for US West
- [ ] Create POI extraction pipeline (OSM → SQLite)
- [ ] Test end-to-end on USB stick

### Phase 2: Electron Flasher Integration
- [ ] Add `MapsManager.js` to main process
- [ ] Add `maps:*` IPC channels
- [ ] Add map region selection UI to `MainConfigScreen`
- [ ] Integrate map downloads into `DownloadManager`
- [ ] Integrate map file copies into `TransferProgressScreen`
- [ ] Create USB directory structure via `FileService`

### Phase 3: POI Search & Preparedness Features
- [ ] Implement POI search UI in MapLibre SPA
- [ ] Add preparedness category filters (hospitals, shelters, water, etc.)
- [ ] Add POI detail popups
- [ ] Implement bookmarks (localStorage)

### Phase 4: Cross-App Integration
- [ ] Deep linking between Maps ↔ Kiwix
- [ ] Deep linking between Maps ↔ WikiAI
- [ ] Common launcher menu

### Phase 5: Routing (Post-Launch)
- [ ] Bundle Valhalla binary
- [ ] Routing UI in MapLibre SPA
- [ ] Turn-by-turn directions