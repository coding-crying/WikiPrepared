#!/usr/bin/env python3
"""Concurrent FUSE fallback and incomplete-cache behavior with explicit fixtures."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

assets = Path(__file__).resolve().parents[1] / 'src/main/assets'
with tempfile.TemporaryDirectory(prefix='wp-cache-test-') as tmp:
    root = Path(tmp)
    (root / '.data').mkdir()
    launcher = root / 'START - Linux.sh'
    shutil.copy2(assets / launcher.name, launcher)
    reader = root / '.data/kiwix-linux.AppImage'
    reader.write_text('''#!/bin/bash
if [[ "$1" == --appimage-extract ]]; then
    echo extract >> "$CACHE_TEST_ROOT/count"
    sleep 0.5
    mkdir squashfs-root
    printf '#!/bin/sh\\nexit 0\\n' > squashfs-root/AppRun
    chmod +x squashfs-root/AppRun
    exit 0
fi
echo 'AppImages require FUSE to run.' >&2
exit 1
''')
    reader.chmod(0o755)
    env = dict(os.environ, CACHE_TEST_ROOT=str(root), TMPDIR=str(root))
    children = [subprocess.Popen(['bash', str(launcher)], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) for _ in range(2)]
    for child in children:
        out, err = child.communicate(timeout=15)
        assert child.returncode == 0, (out, err)
    assert (root / 'count').read_text() == 'extract\n'
    assert not list((root / '.data').glob('.kiwix-extract.??????'))
    print('PASS: two concurrent launches publish one cache with no staging leftovers')
    digest = hashlib.sha256(reader.read_bytes()).hexdigest()
    cache = root / '.data' / ('kiwix-extracted-' + digest)
    (cache / 'AppRun').chmod(0o644)
    result = subprocess.run(['bash', str(launcher)], env=env, capture_output=True, text=True, timeout=15)
    assert result.returncode == 1, result
    assert 'cache is incomplete or not executable' in result.stderr
    assert (root / 'count').read_text() == 'extract\n', 'invalid cache triggered unnecessary extraction'
    assert (cache / 'AppRun').exists(), 'existing cache was deleted'
    print('PASS: invalid existing cache is diagnosed without re-extraction or deleting user files')
