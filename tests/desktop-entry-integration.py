#!/usr/bin/env python3
"""Integration checks through GLib's actual desktop-entry parser (needs python3-gi)."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
from gi.repository import Gio, GLib

assets = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'src/main/assets'
with tempfile.TemporaryDirectory(prefix='wp-desktop-entry-') as tmp:
    root = Path(tmp)
    # No interpolation of this mount path into executable shell source is safe.
    usb = root / "Moved USB ' $cash %20 \\ slash ; (安全)"
    usb.mkdir()
    desktop = usb / 'Open WikiPrepared.desktop'
    # Disable terminal only for this parser fixture; real desktop smoke uses the original.
    desktop.write_text((assets / desktop.name).read_text().replace('Terminal=true', 'Terminal=false'))
    desktop.chmod(0o755)
    capture = root / 'capture'
    script = usb / 'START - Linux.sh'
    script.write_text('#!/bin/bash\nprintf "%s" "$0" > "$CAPTURE"\n')
    script.chmod(0o644)  # bootstrap must explicitly use bash
    os.environ['CAPTURE'] = str(capture)
    app = Gio.DesktopAppInfo.new_from_filename(str(desktop))
    assert app is not None
    assert app.launch([], None)
    for _ in range(100):
        if capture.exists():
            break
        time.sleep(0.05)
    assert capture.read_text() == str(script), capture.read_text() if capture.exists() else 'no launch'
    print('PASS: GLib launches relocated desktop entry with literal hostile-looking path and 0644 script')
    capture.unlink()
    # Exercise the specification's alternate %k URI form as well.
    _, argv = GLib.shell_parse_argv(app.get_commandline())
    result = subprocess.run([argv[0], '-c', argv[2], desktop.as_uri()], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert capture.read_text() == str(script)
    print('PASS: local file URI decoding preserves percent, backslash, quotes and Unicode exactly once')
