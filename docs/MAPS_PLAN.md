# WikiPrepared Maps — Product & Technical Plan

## Architecture Correction

**The Electron app is just the stick flasher.** It is NOT the on-device app. On the USB stick, each piece of software is its own thing:

| Component | Type | How it runs |
|-----------|------|-------------|
| Kiwix | Local HTTP server |Opens in user's browser |
| WikiPreparedAI | Python/PySide6 binary | Native desktop window |
| **Maps** | **???** | **This is what we're designing** |

Design principle: **one app per software, user already has a browser.**

---

## Two Viable Approaches

### Option A: Browser-based (like Kiwix)
Run a lightweight local HTTP server that serves MapLibre + PMTiles to the user's browser. Same pattern as Kiwix — double-click launcher, opens `http://localhost:PORT` in default browser.

**Pros:**
- Exactly the pattern users already know from Kiwix
- No binary compilation needed — just HTML/JS/CSS + a small server
- Cross-platform by default (any browser)
- PMTiles reads directly via HTTP range requests (natural fit)
- Easy to style, update, and extend
- User can bookmark maps independently

**Cons:**
- Needs a tiny HTTP server process (Node binary or Python script)
- Browser tab, not a native window (less "app-like")
- No direct access to filesystem from browser (server bridges this)

### Option B: Python/PySide6 app (like WikiPreparedAI)
Qt WebEngineView embedded in a PySide6 window, rendering MapLibre. Same pattern as WikiAI — desktop app with embedded web content.

**Pros:**
- Native window, feels like a real app
- Can share code/launcher with WikiPreparedAI
- PyInstaller packaging already proven (same build_usb.sh pattern)
- Can integrate with WikiAI (share context, coordinates, etc.)

**Cons:**
- Adds WebEngine dependency — PySide6 WebEngine is heavy (~200MB extra)
- Two PySide6 apps on the stick = duplicate Qt libraries unless we merge
- More complex build pipeline
- WebEngine can be finicky on older hardware

---

## Recommendation: Option A — Browser-based (like Kiwix)

**Why:** Follows the established pattern. Kiwix already taught users "click launcher → opens in browser." Maps works the same way. Keep each app simple and independent. No heavy PySide6 WebEngine dependency.

### USB Stick Layout

```
USB Stick/
├── WikiPrepared_AI/           # Python app (existing)
│   ├── WikiPrepared_AI        # PyInstaller binary
│   └── ...
├── Kiwix/                     # Kiwix server (existing)
│   ├── kiwix-serve
│   └── ...
├── WikiPrepared_Maps/         # NEW — offline maps
│   ├── start-maps.sh          # Linux launcher
│   ├── start-maps.bat         # Windows launcher
│   ├── server/                # Lightweight HTTP server
│   │   ├── server.js          # or server.py — serves tiles + SPA
│   │   └── package.json       # or requirements.txt
│   ├── app/                   # Frontend SPA
│   │   ├── index.html
│   │   ├── app.js             # MapLibre GL JS + PMTiles
│   │   ├── style-dark.json    # MapLibre dark style
│   │   └── assets/            # Fonts, sprites
│   └── maps/                  # PMTiles region files
│       ├── us-west.pmtiles
│       ├── us-east.pmtiles
│       └── north-america.pmtiles
├── Library/                   # ZIM files (existing)
│   ├── wikipedia_en.zim
│   └── ...
└── launcher.sh / launcher.bat # Master menu (existing pattern)
```

### How It Works (Same as Kiwix)

1. User double-clicks `start-maps.sh` (Linux) or `start-maps.bat` (Windows)
2. Launcher starts a local HTTP server on `localhost:8081`
3. Server serves the SPA frontend + PMTiles tile data via HTTP range requests
4. Default browser opens to `http://localhost:8081`
5. MapLibre GL JS renders vector tiles from the PMTiles files
6. User browses maps, searches POIs, bookmarks locations — all offline

### Server Options

| Server | Binary Size | Language | Pros | Cons |
|--------|------------|----------|------|------|
| **Python (`http.server` + custom)** | 0 (use system Python or bundle small) | Python | Same runtime WikiAI needs | Slower, more complex handler |
| **Node.js (Express/custom)** | ~30MB Node binary | JS | Fast, native range request support | Need Node binary on stick |
| **Static binary (Go/Rust)** | ~5-10MB compiled | Go/Rust | Tiny, fast, no deps | Need to compile per platform |
| **Deno single binary** | ~30MB | TS | Single binary, built-in HTTP | Newer, less proven |

**Best option: Go or Rust static binary.** ~5-10MB, zero dependencies, cross-compile for Linux/Windows/macOS, serves PMTiles with proper range request headers. This is the same pattern Kiwix uses (C++ binary, just serves content). We write a tiny HTTP server that:
- Serves static files (HTML/JS/CSS)
- Serves .pmtiles with proper `Accept-Ranges: bytes` + `Range` header handling
- Auto-discovers .pmtiles in the `maps/` directory
- Auto-opens browser on start
- Shuts down cleanly when browser tab closes (or on signal)

### MapLibre GL JS Frontend

The SPA is dead simple — one HTML file + one JS bundle + MapLibre CSS:

```
app/
├── index.html              # Shell with map container + search UI
├── app.js (or bundled)     # MapLibre + PMTiles + search logic
├── style-dark.json         # Custom "Dark Industrial Glass" map style
└── assets/
    ├── fonts/              # Inter, JetBrains Mono (same as site)
    └── sprites/            # Map icons (POIs, shelters, etc.)
```

**MapLibre GL JS v5** loads PMTiles directly via the `protomaps/thin-client` or `maplibre-offline-pmtiles` plugin. No build step required for a basic setup — just include the JS and go.

**Dark Industrial Glass style:** We create a custom MapLibre style JSON that matches the WikiPrepared brand:
- Black/charcoal basemap (`#0a0a0a`, `#1a1a1a`)
- White roads/labels
- Green-400 accents for POIs and highlights
- Monospace font for coordinates/distances (JetBrains Mono)
- Sharp corners, minimal ornamentation

### POI Search

Two options for offline search, both running client-side:

**Option A: Pre-indexed SQLite (recommended)**
- For each .pmtiles region, ship a companion `.db` SQLite file
- Contains POI name, category, lat/lng, plus FTS5 full-text search
- Generated from OSM data during the PMTiles build pipeline
- Server queries the SQLite and returns results as JSON
- Tiny overhead (~5-20MB per region)

**Option B: In-browser search (simpler)**
- Embed POI data as a compressed JSON blob in the app
- Client-side search with fuzzy matching
- Works for small regions, doesn't scale to North America

### Launcher Script (Linux)

```bash
#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Find an available port
PORT=8081
while lsof -i :$PORT >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

# Start the maps server
"$SCRIPT_DIR/server/maps-server" --port $PORT --maps-dir "$SCRIPT_DIR/maps" &
SERVER_PID=$!

# Wait for server to be ready
for i in $(seq 1 30); do
  if curl -s "http://localhost:$PORT" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

# Open in default browser
xdg-open "http://localhost:$PORT" 2>/dev/null || open "http://localhost:$PORT" 2>/dev/null

# Wait for server process
wait $SERVER_PID
```

Same pattern for Windows `.bat` file.

---

## PMTiles Data Pipeline

### Source: Protomaps Basemaps

Protomaps provides pre-built `.pmtiles` files for the entire planet, generated from OSM data. We can either:

1. **Download pre-built regions** from `maps.protomaps.com` (free, ODbL license)
2. **Self-generate regions** using `protomaps/basemaps` (Planetiler, needs Java 21+)

For launch, **download pre-built** is faster. Self-generation gives us more control for custom regions later.

### Regional File Sizes (Vector PMTiles)

| Region | Approximate Size |
|--------|-----------------|
| Monaco (demo) | ~5 MB |
| Single US state | 50-200 MB |
| US West (CA, OR, WA) | 300-800 MB |
| US East (NY, MA, etc.) | 300-800 MB |
| Contiguous US | 1.5-3 GB |
| North America | 3-6 GB |
| Europe (full) | 4-8 GB |
| Planet | 100+ GB |

### POI Database Generation Pipeline

```
OSM extract (.osm.pbf) → osmium tool → filter POIs → SQLite + FTS5
```

Or simpler: use the `imposm3` or `osm2pgsql` pipeline to extract POIs by category into SQLite.

For v1, we can pre-build and ship the POI databases with each region.

---

## What This Looks Like for the User

1. Plug in the USB stick
2. Open the stick, double-click `start-maps.sh` (Linux) or `start-maps.bat` (Windows)
3. Browser opens → dark-themed offline map with their region pre-loaded
4. Search for "hospital", "shelter", "water" → POI results on map
5. Click a POI → see details, coordinates, distance
6. Optional: right-click → "Open in Wikipedia" (links to Kiwix if running)
7. Bookmarks saved in localStorage (persist across sessions on same browser)

**No install. No internet. No account.** Same philosophy as the rest of WikiPrepared.

---

## Builder Integration (Existing Step 2: Maps)

Current builder options:
- None (free)
- US West (free)
- US East (free)
- North America (+$15)
- Custom region (+$15)

These map directly to `.pmtiles` files. The flasher Electron app simply copies the selected region's `.pmtiles` + `.db` files to the `maps/` directory on the USB stick.

For "Custom region," we'd need a region selector UI where users pick a bounding box or select from a list of available regions, then the builder downloads/generates that PMTiles file.

---

## Phase 2: AI Integration + Routing + Overlays (Post-Launch)

### WikiAI ↔ Maps Deep Linking
- Kiwix runs on `localhost:8080`, Maps on `localhost:8081`
- POIs link to `http://localhost:8080/wiki/Hospital` (opens in Kiwix)
- WikiAI can reference coordinates → Maps opens at that location
- Simple REST API on each server for cross-app communication

### Offline Routing (Valhalla)
- Bundle Valhalla binary per platform (~50-100MB)
- Run as local service on another port
- Simple routing API: `http://localhost:8082/route?from=lat,lng&to=lat,lng&mode=car`
- MapLibre displays the route as a line overlay
- Elevate this to Phase 1 if users demand routing

### Preparedness Overlays
- GeoJSON files per region: FEMA shelters, flood zones, wildfire risk, ham radio repeaters
- Toggle overlays in the map UI
- Sourced from public datasets (FEMA, USGS, FCC)
- Shipped as small `.geojson` files alongside each region's PMTiles

---

## Implementation Timeline

### Phase 1: Browse + Search (4-6 weeks)

| Week | Tasks |
|------|-------|
| 1 | Write Go/Rust maps-server binary. Serve static files + PMTiles with range requests. Auto-discover .pmtiles. Auto-open browser. Cross-compile for Linux/Windows. |
| 2 | Build MapLibre GL JS SPA. Dark Industrial Glass style. Region switching. Basic pan/zoom/locate. |
| 3 | POI search — SQLite database generation pipeline from OSM data. Search UI with category filters. |
| 4 | Launcher scripts (sh + bat). Master menu integration. Kiwix deep links. |
| 5 | PMTiles download/generation pipeline for builder regions. Test on USB sticks across platforms. |
| 6 | Polish, edge cases (no .pmtiles found, low-res screens, browser compat), documentation. |

### Phase 2: Enhanced Features (2-3 months after)

| Month | Milestone |
|-------|-----------|
| 1 | WikiAI cross-linking (coordinates → map, POIs → Wikipedia). Bookmark sync. |
| 2 | Valhalla routing bundle. Turn-by-turn UI. Route display on map. |
| 3 | Preparedness overlay pipeline. Custom overlay packs in builder. |

---

## Open Questions

1. **Server language** — Go binary (tiny, fast) or Rust (same) or Python (reuse WikiAI runtime)?
2. **Scope for v1** — Browse + POI search only, or routing too?
3. **Region pricing** — Keep US regions free in builder, +$15 for NA/other?
4. **POI depth** — Just critical preparedness POIs (hospitals, shelters, water, fuel) or full OSM POI set?
5. **Self-generation pipeline** — Build PMTiles ourselves for custom regions, or start with Protomaps pre-built only?
6. **Cross-linking priority** — How important is Maps ↔ Kiwix linking for v1?

---

## Technical Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Browser PMTiles performance on large regions | Low | Range requests help; USB 3.0 recommended |
| Go/Rust binary compilation per platform | Medium | GitHub Actions CI for cross-compilation |
| POI database size for NA (~100M+ POIs) | Medium | Filter to preparedness-relevant categories only (~1-5M POIs) |
| Dark style doesn't match site design | Low | Custom Protomaps style, full CSS control |
| Browser closes → server keeps running | Medium | Heartbeat endpoint, auto-shutdown after timeout |