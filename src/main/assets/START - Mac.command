#!/bin/bash
# WikiPrepared - macOS Kiwix Reader Launcher

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DMG_PATH="$SCRIPT_DIR/.data/kiwix-macos.dmg"

fail() {
    echo ""
    echo "============================================="
    echo " ERROR: $1"
    echo "============================================="
    echo ""
    echo "Press Enter to close this window..."
    read -r
    exit 1
}

launch_kiwix() {
    echo "Launching Kiwix..."
    open -a "Kiwix" 2>/dev/null && return 0
    # Fallback: look for the app in common install locations
    for APP_DIR in "/Applications/Kiwix.app" "$HOME/Applications/Kiwix.app" "$HOME/Applications/Kiwix/Kiwix.app"; do
        if [ -d "$APP_DIR" ]; then
            open "$APP_DIR" && return 0
        fi
    done
    return 1
}

# Check if Kiwix is already installed (system-wide, user-local, or via mdfind)
if launch_kiwix; then
    echo ""
    echo "TIP: In Kiwix, go to File > Open and select files from"
    echo "     the Library folder on this USB drive."
    sleep 2
    exit 0
fi

# Last-resort detection via Spotlight (covers custom install paths)
if command -v mdfind >/dev/null 2>&1 && [ -z "$(mdfind "kMDItemCFBundleIdentifier == 'org.kiwix.Kiwix'" 2>/dev/null)" ]; then
    : # not installed, continue to installer
elif command -v mdfind >/dev/null 2>&1 && [ -n "$(mdfind "kMDItemCFBundleIdentifier == 'org.kiwix.Kiwix'" 2>/dev/null)" ]; then
    KIWIX_APP_PATH="$(mdfind "kMDItemCFBundleIdentifier == 'org.kiwix.Kiwix'" 2>/dev/null | head -1)"
    if [ -n "$KIWIX_APP_PATH" ] && open "$KIWIX_APP_PATH" 2>/dev/null; then
        echo "Launching Kiwix..."
        echo ""
        echo "TIP: In Kiwix, go to File > Open and select files from"
        echo "     the Library folder on this USB drive."
        sleep 2
        exit 0
    fi
fi

# Check if DMG exists
if [ ! -f "$DMG_PATH" ]; then
    fail "Kiwix installer not found on this USB drive."
fi

echo "Kiwix not installed yet. Opening the installer..."
open "$DMG_PATH" || fail "Could not open the installer DMG."
echo ""
echo "To install:"
echo "1. Drag Kiwix to your Applications folder"
echo "2. Run this launcher again"
echo ""
read -r -p "Press Enter to exit..."
