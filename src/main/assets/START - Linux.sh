#!/bin/bash
# WikiPrepared - Linux Kiwix Reader Launcher
# Run with: bash "START - Linux.sh"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APPIMAGE="$SCRIPT_DIR/.data/kiwix-linux.AppImage"

if [ ! -f "$APPIMAGE" ]; then
    echo "ERROR: Kiwix AppImage not found."
    echo "Please run the WikiPrepared setup to install readers."
    exit 1
fi

chmod +x "$APPIMAGE" 2>/dev/null
"$APPIMAGE" 2>/dev/null &
disown
