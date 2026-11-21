#!/usr/bin/env python3
"""Run with: unshare --user --map-root-user --mount python3 tests/linux-noexec-integration.py"""
from pathlib import Path
import shutil
import subprocess
import tempfile

assets = Path(__file__).resolve().parents[1] / 'src/main/assets'
subprocess.run(['mount', '--make-rprivate', '/'], check=True)
with tempfile.TemporaryDirectory(prefix='wp-noexec-test-') as tmp:
    usb = Path(tmp) / 'usb'
    usb.mkdir()
    subprocess.run(['mount', '-t', 'tmpfs', '-o', 'noexec,nosuid,nodev,size=8m', 'tmpfs', str(usb)], check=True)
    try:
        (usb / '.data').mkdir()
        shutil.copy2(assets / 'START - Linux.sh', usb / 'START - Linux.sh')
        binary = shutil.which('true')
        assert binary is not None, 'true executable is required for this Linux test'
        shutil.copy2(binary, usb / '.data/kiwix-linux.AppImage')
        result = subprocess.run(['bash', str(usb / 'START - Linux.sh')], capture_output=True, text=True, timeout=10)
        assert result.returncode == 1, result
        assert 'mounted with noexec' in result.stderr, result.stderr
        assert not list((usb / '.data').glob('kiwix-extracted-*'))
        print('PASS: real noexec mount is diagnosed; no extraction, remount, or local installation attempted')
    finally:
        subprocess.run(['umount', str(usb)], check=True)
