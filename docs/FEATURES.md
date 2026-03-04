# Features

WikiPrepared helps users create and maintain offline Wikipedia USB drives.

## Core workflow

- Detect removable drives and show capacity/free space/filesystem.
- Fetch and cache the Wikimedia/Kiwix ZIM catalog.
- Select Wikipedia ZIM(s) and target platforms for Kiwix readers (Windows/Linux/macOS/Android).
- Download content either:
  - **Local-first** (download to PC, then transfer to USB), or
  - **Direct-to-USB** (download straight to the USB).
- Install Kiwix readers + create portable launchers on the USB.
- Scan an existing USB for `.zim` files and surface update candidates.

## Safety / integrity

- Warn on filesystem constraints (for example FAT32 4GB limits).
- SHA-256 verification when the catalog provides a checksum.
- If no server checksum exists for a ZIM, compute and store a local SHA-256 and mark the download as **unverified** in the UI.

