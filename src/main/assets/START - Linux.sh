#!/bin/bash
# WikiPrepared portable Linux reader. No sudo or mount-policy changes.
# Terminal fallback: bash "START - Linux.sh"
set -o pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" || exit 1
APPIMAGE="$SCRIPT_DIR/.data/kiwix-linux.AppImage"
# Also support older sticks when upgrading only their launchers.
if [[ ! -f "$APPIMAGE" && -f "$SCRIPT_DIR/START - Linux.AppImage" ]]; then
    APPIMAGE="$SCRIPT_DIR/START - Linux.AppImage"
fi

fail() {
    printf '\nWikiPrepared: %s\n' "$1" >&2
    if [[ -t 0 ]]; then
        read -r -p 'Press Enter to close... ' || true
    fi
    exit 1
}

[[ -f "$APPIMAGE" ]] || fail 'Linux reader not found. Add the Linux reader with the WikiPrepared USB builder.'
if command -v findmnt >/dev/null 2>&1; then
    MOUNT_OPTIONS="$(findmnt -n -o OPTIONS -T "$APPIMAGE" 2>/dev/null)"
    if [[ ",$MOUNT_OPTIONS," == *,noexec,* ]]; then
        fail 'This USB is mounted with noexec: Linux blocks running programs from it. Permissions and AppImage extraction cannot fix this. Ask your administrator about allowing this trusted USB, or use a locally installed Kiwix reader to open Library/*.zim. No system settings were changed.'
    fi
fi
if [[ ! -x "$APPIMAGE" ]]; then
    chmod u+x -- "$APPIMAGE" 2>/dev/null || true
    [[ -x "$APPIMAGE" ]] || fail 'Cannot make the Linux reader executable. FAT/exFAT permissions depend on how the USB is mounted. Ask your administrator or open the ZIM files with a locally installed Kiwix reader.'
fi
case "$(uname -m)" in
    x86_64|amd64) ;;
    *) fail 'The bundled Linux reader requires an x86-64 computer. Use a Kiwix reader built for this computer instead.' ;;
esac

# Pass absolute file arguments (never shell code) so Kiwix opens the USB content.
# Explicit command-line arguments take precedence over automatic discovery.
if [[ $# -eq 0 ]]; then
    shopt -s nullglob nocaseglob
    ZIMS=("$SCRIPT_DIR/Library/"*.zim)
    if [[ ${#ZIMS[@]} -eq 0 ]]; then
        ZIMS=("$SCRIPT_DIR/Library (.zim files)/"*.zim)
    fi
    if [[ ${#ZIMS[@]} -gt 0 ]]; then
        set -- "${ZIMS[@]}"
    else
        printf 'No ZIM files found in Library. Kiwix will open without USB content.\n'
    fi
fi

LOG="$(mktemp "${TMPDIR:-/tmp}/wikiprepared-linux.XXXXXX.log")" || fail 'Cannot create a temporary startup log.'
printf 'Starting WikiPrepared. Diagnostic log: %s\n' "$LOG"

# Observe early failures without misidentifying a clean single-instance exit as
# an error. The child keeps logging after this terminal closes.
start_reader() {
    # Use a separate session: Qt renderer children can restore default SIGHUP
    # handling, so ignoring SIGHUP only in the parent is not sufficient.
    # --wait propagates early exit status even when setsid must fork.
    nohup setsid --wait "$@" </dev/null >>"$LOG" 2>&1 &
    local pid=$! status
    for ((i=0; i<20; i++)); do
        if ! kill -0 "$pid" 2>/dev/null; then
            wait "$pid"
            status=$?
            return "$status"
        fi
        sleep 0.1
    done
    disown "$pid" 2>/dev/null || true
    return 0
}

start_reader "$APPIMAGE" "$@" && exit 0
# Extraction is only a FUSE fallback, not a cure for noexec, wrong architecture,
# Qt failures, damaged content, or arbitrary runtime errors.
if ! grep -Eqi 'libfuse|AppImages require FUSE|fuse:|fusermount|Cannot mount AppImage' "$LOG"; then
    cat "$LOG" >&2
    fail "The reader could not start. See $LOG for details."
fi
printf 'FUSE is unavailable; preparing an extracted reader on this USB...\n'
DATA_DIR="$SCRIPT_DIR/.data"
mkdir -p -- "$DATA_DIR" || fail 'Cannot create .data on this USB for the FUSE fallback.'
DIGEST="$(sha256sum -- "$APPIMAGE")" || fail 'Cannot read the AppImage to prepare the FUSE fallback.'
DIGEST="${DIGEST%% *}"
# GNU sha256sum prefixes a backslash when the filename needs escaping.
DIGEST="${DIGEST#\\}"
CACHE="$DATA_DIR/kiwix-extracted-$DIGEST"
if [[ ! -x "$CACHE/AppRun" ]]; then
    # Serialize first extraction; never delete an existing reader directory.
    exec 9>"$DATA_DIR/.kiwix-extract.lock" || fail 'The USB is read-only. The FUSE fallback needs writable space on the USB, or a locally installed Kiwix reader.'
    flock -x 9 || fail 'Cannot lock the USB extraction cache.'
    if [[ ! -x "$CACHE/AppRun" ]]; then
        [[ ! -e "$CACHE" ]] || fail "The extracted reader cache is incomplete or not executable: $CACHE. It was left untouched. Ask support to repair this cache, or use a locally installed Kiwix reader."
        STAGE="$(mktemp -d "$DATA_DIR/.kiwix-extract.XXXXXX")" || fail 'Cannot create extraction directory on the USB.'
        # STAGE was created by this process, never an existing user directory.
        trap '[[ -n "${STAGE:-}" ]] && rm -rf -- "$STAGE"' EXIT
        if ! (cd -- "$STAGE" && "$APPIMAGE" --appimage-extract) >>"$LOG" 2>&1; then
            cat "$LOG" >&2
            fail "AppImage extraction failed (check free space and USB write permissions). See $LOG."
        fi
        [[ -f "$STAGE/squashfs-root/AppRun" ]] || fail "Extraction produced no AppRun. See $LOG."
        chmod u+x -- "$STAGE/squashfs-root/AppRun" 2>/dev/null || true
        mv -T -- "$STAGE/squashfs-root" "$CACHE" || fail 'Cannot publish the extracted reader cache.'
        rmdir -- "$STAGE"
        STAGE=''
        trap - EXIT
    fi
    flock -u 9
    exec 9>&-
fi
start_reader "$CACHE/AppRun" "$@" && exit 0
cat "$LOG" >&2
fail "The extracted reader could not start. See $LOG for missing libraries or other errors."
