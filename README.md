# WikiPrepared

WikiPrepared is a cross-platform desktop app for building and maintaining offline Wikipedia USB drives.

Its goal is to support long-term knowledge preservation and give people, schools, and communities more control over their own knowledge repositories instead of depending on always-online access.

## Download

Prebuilt releases (Linux):

- AppImage and `.deb` are published on GitHub Releases.
- See the latest release: https://github.com/coding-crying/WikiPrepared/releases

## What WikiPrepared does

- Detects removable USB drives and shows capacity, free space, and filesystem details.
- Warns about filesystem limits (for example FAT32 and 4GB file limits) before large transfers.
- Fetches and parses Wikipedia ZIM catalogs from Wikimedia/Kiwix dumps.
- Filters ZIM content by language, topic, and scope (`mini`, `nopic`, `maxi`).
- Downloads ZIM files with queueing, progress, pause/resume/cancel, and basic checksum support.
- Scans existing USB sticks for installed `.zim` files and checks for update candidates.
- Downloads and installs Kiwix readers for Windows, Linux, macOS, and Android.
- Creates portable USB launchers (`START - Windows.bat`, `START - Mac.command`, `START - Linux.sh`).
- Verifies downloads with SHA-256 when a server checksum is available. If a server checksum is not available, WikiPrepared computes and stores a local SHA-256 and marks the download as **unverified** in the UI.

## Platform notes (important)

- **Windows / macOS / Linux file compatibility:** For best cross-platform compatibility, use **exFAT**.
- **exFAT formatting differences:** Some drives formatted on Linux can behave oddly on Windows (and vice versa). If you intend to use the USB across Windows and macOS, formatting the drive as exFAT on **Windows** is usually the safest option.

## Why this project exists

Knowledge access is fragile when it depends on stable internet, centralized platforms, and changing policies.

WikiPrepared is designed to help users:

- Preserve critical knowledge offline.
- Share reproducible knowledge kits across devices and regions.
- Keep local ownership of educational content and update schedules.

## Current app flow

The current React/Electron flow is step-based:

1. Initial choice (`update existing` vs `create new`).
2. Drive selection.
3. Filesystem warning (if needed).
4. Content and reader configuration.
5. Download strategy selection (`direct to USB` or `local-first`).
6. Download progress.
7. USB transfer progress.
8. Completion + safe eject options.

Main routes are defined in `src/renderer/App.jsx` and `src/renderer/utils/constants.js`.

## Tech stack

- Electron (main process + packaging)
- React + MUI (renderer UI)
- Node.js services/managers for drives, files, downloads, and Kiwix integration
- `drivelist`, `axios`, `fs-extra`, `cheerio`, `zustand`

## Development setup

### Prerequisites

- Node.js 18+
- npm 9+
- Git
- Platform permissions for removable drive operations

### Install and run

```bash
git clone https://github.com/coding-crying/WikiPrepared.git
cd WikiPrepared
npm install
npm run dev
```

## Scripts

```bash
npm run dev         # Start Electron app in development
npm run build       # Build/package (Electron Forge) for current platform
npm run dist        # Build distributables (electron-builder): AppImage/.deb on Linux
npm run dist:win    # Distributables for Windows (run on Windows)
npm run dist:mac    # Distributables for macOS (run on macOS)
npm run lint        # Lint source
npm test            # Run tests
```

## USB output structure (portable mode)

WikiPrepared targets a simple USB layout:

- `Library/` for `.zim` content
- `.data/` for reader binaries/assets
- root launchers for each desktop platform

User-facing USB guidance is in `src/main/assets/README.txt`.

## Repository layout

- `src/main/` Electron main process, IPC handlers, managers, services
- `src/renderer/` React UI screens, components, stores, styles
- `src/shared/` cross-process constants and IPC channel definitions
- `docs/` implementation notes, redesign docs, troubleshooting
  - Start here: `docs/README.md`

## Documentation map

- `docs/DEVELOPMENT.md` - developer setup walkthrough
- `docs/ARCHITECTURE.md` - architecture details
- `docs/FEATURES.md` - feature inventory and roadmap notes
- `docs/UI_FLOW_REDESIGN.md` - detailed UX flow specification
- `docs/LOCAL_TESTING_REPORT.md` - test observations from prior runs

## Status

This project is actively evolving. The architecture and UI flow are in place, and the core USB + ZIM workflow is implemented, but polish/testing depth still varies by platform.

If you are contributing, prioritize:

- cross-platform USB reliability
- clearer failure recovery and retries
- end-to-end tests for download/transfer/update flows

## Data sources and dependencies

- Wikipedia/Kiwix ZIM dumps: `https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/`
- Kiwix downloads: `https://download.kiwix.org/release/`

## Contributing

Contributions are welcome.

1. Open an issue describing the problem or proposal.
2. Keep changes scoped and test the affected flow.
3. Update docs when behavior changes.

## License

GPL-3.0. See `LICENSE`.
