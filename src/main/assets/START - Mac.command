#!/bin/bash
# WikiPrepared - macOS Kiwix Reader Launcher

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DMG_PATH="$SCRIPT_DIR/.data/kiwix-macos.dmg"

# Check if Kiwix is already installed
if [ -d "/Applications/Kiwix.app" ]; then
    echo "Launching Kiwix..."
    open "/Applications/Kiwix.app"
    echo ""
    echo "TIP: In Kiwix, go to File > Open and select files from"
    echo "     the Library folder on this USB drive."
    sleep 2
    exit 0
fi

# Check if DMG exists
if [ ! -f "$DMG_PATH" ]; then
    echo "ERROR: Kiwix installer not found."
    echo "Please run the WikiPrepared setup to install readers."
    read -p "Press Enter to exit..."
    exit 1
fi

echo "Kiwix not installed yet. Opening the installer..."
open "$DMG_PATH"
echo ""
echo "To install:"
echo "1. Drag Kiwix to your Applications folder"
echo "2. Run this launcher again"
echo ""
read -p "Press Enter to exit..."
