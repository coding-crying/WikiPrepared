# Architecture

WikiPrepared is an Electron application with a Node.js main process (system/USB work) and a React renderer process (UI).

## Processes

- **Main process** (`src/main/`): drive detection, formatting/eject, catalog fetch, downloads, transfers, Kiwix reader installation, IPC handlers.
- **Renderer process** (`src/renderer/`): step-by-step UI flow (React + MUI), state management (Zustand), calls into the main process via the preload bridge.
- **Preload** (`src/main/preload.js`): exposes a minimal `window.electronAPI` to the renderer (IPC boundary).

## Key modules (main)

- `src/main/managers/DriveManager.js`: enumerates drives (via `drivelist`), watches for changes, performs best-effort eject/unmount.
- `src/main/managers/DownloadManager.js`: queues downloads, writes to disk/USB, and verifies SHA-256 when possible.
- `src/main/managers/ZimManager.js`: fetches and caches the ZIM catalog, provides filtering and metadata.
- `src/main/managers/KiwixManager.js`: downloads Kiwix readers and installs portable launchers onto the USB.

## Packaging

- **Dev**: Electron Forge + `@electron-forge/plugin-webpack` (`npm run dev`)
- **Release builds**: `electron-builder` via `npm run dist` (Linux AppImage + `.deb`).

