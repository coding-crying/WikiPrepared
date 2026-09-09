#!/bin/bash
# WikiPrepared - Linux Kiwix Reader Launcher
# Run with: bash "START - Linux.sh"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APPIMAGE="$SCRIPT_DIR/.data/kiwix-linux.AppImage"

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

[ -f "$APPIMAGE" ] || fail "Kiwix AppImage not found on this USB drive."
[ -x "$APPIMAGE" ] || chmod +x "$APPIMAGE" 2>/dev/null

# Launch with stderr visible so failures (missing FUSE, bad arch, etc.)
# are diagnosable. If a direct launch fails, fall back to --appimage-extract.
"$APPIMAGE" "$@" 2>&1 &
APP_PID=$!

# Give it a moment; if it died immediately, try the extraction fallback
sleep 2
if ! kill -0 "$APP_PID" 2>/dev/null; then
    echo "Direct launch failed - trying portable extraction mode..."
    cd "$SCRIPT_DIR/.data" || fail "Cannot access .data folder."
    "$APPIMAGE" --appimage-extract 2>&1 | tail -1
    EXTRACTED="$SCRIPT_DIR/.data/squashfs-root/AppRun"
    if [ -f "$EXTRACTED" ]; then
        chmod +x "$EXTRACTED" 2>/dev/null
        "$EXTRACTED" "$@" 2>&1 &
        disown
        echo "Kiwix started (portable mode)."
        exit 0
    fi
    fail "Could not start Kiwix. Your system may be missing FUSE (install with: sudo apt install libfuse2) or the AppImage may be damaged."
fi

disown
exit 0
