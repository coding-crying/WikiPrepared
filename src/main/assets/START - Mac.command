#!/bin/bash
# WikiPrepared - macOS launcher.
# Opens the Wikipedia archives on this USB drive in Kiwix. If Kiwix is not
# installed yet, opens the bundled installer instead.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DMG_PATH="$SCRIPT_DIR/.data/kiwix-macos.dmg"

fail() {
    echo ""
    echo "============================================="
    echo " ERROR: $1"
    echo "============================================="
    echo ""
    read -r -p "Press Enter to close this window..."
    exit 1
}

# Archives on this drive (current layout first, then the older builder layout).
shopt -s nullglob nocaseglob
ZIMS=("$SCRIPT_DIR/Library/"*.zim)
if [ ${#ZIMS[@]} -eq 0 ]; then
    ZIMS=("$SCRIPT_DIR/Library (.zim files)/"*.zim)
fi
shopt -u nullglob nocaseglob

find_kiwix() {
    local candidate
    for candidate in "/Applications/Kiwix.app" "$HOME/Applications/Kiwix.app" "$HOME/Applications/Kiwix/Kiwix.app"; do
        if [ -d "$candidate" ]; then
            printf '%s\n' "$candidate"
            return 0
        fi
    done
    if command -v mdfind >/dev/null 2>&1; then
        candidate="$(mdfind "kMDItemCFBundleIdentifier == 'org.kiwix.Kiwix'" 2>/dev/null | head -1)"
        if [ -n "$candidate" ] && [ -d "$candidate" ]; then
            printf '%s\n' "$candidate"
            return 0
        fi
    fi
    return 1
}

if KIWIX_APP="$(find_kiwix)"; then
    echo "Opening WikiPrepared in Kiwix..."
    if [ ${#ZIMS[@]} -gt 0 ]; then
        # Hand the archives straight to Kiwix so the user lands in the content
        # instead of an empty reader with a "File > Open" hint.
        open -a "$KIWIX_APP" "${ZIMS[@]}" || open -a "$KIWIX_APP" || fail "Could not start Kiwix."
    else
        echo "No .zim files were found in the Library folder on this drive."
        open -a "$KIWIX_APP" || fail "Could not start Kiwix."
    fi
    sleep 1
    exit 0
fi

if [ ! -f "$DMG_PATH" ]; then
    fail "Kiwix is not installed and its installer is missing from this USB drive. Get Kiwix from https://kiwix.org or the Mac App Store, then open the files in the Library folder."
fi

echo "Kiwix is not installed yet. Opening the installer..."
open "$DMG_PATH" || fail "Could not open the installer (.data/kiwix-macos.dmg)."
echo ""
echo "To install:"
echo "  1. Drag Kiwix into your Applications folder."
echo "  2. Double-click 'START - Mac.command' on this drive again."
echo ""
read -r -p "Press Enter to close this window..."
