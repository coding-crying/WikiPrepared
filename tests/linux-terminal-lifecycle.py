#!/usr/bin/env python3
"""Exercise terminal close against a reader whose child restores default SIGHUP."""
import os
from pathlib import Path
import pty
import shutil
import signal
import tempfile
import time

assets = Path(__file__).resolve().parents[1] / 'src/main/assets'
with tempfile.TemporaryDirectory(prefix='wp-terminal-life-') as tmp:
    root = Path(tmp)
    (root / '.data').mkdir()
    launcher = root / 'START - Linux.sh'
    shutil.copy2(assets / launcher.name, launcher)
    reader = root / '.data/kiwix-linux.AppImage'
    reader.write_text('''#!/usr/bin/python3
import os,signal,time
from pathlib import Path
root=Path(os.environ['LIFECYCLE_ROOT'])
pid=os.fork()
if pid==0:
    signal.signal(signal.SIGHUP,signal.SIG_DFL)
    (root/'child.pid').write_text(str(os.getpid()))
    (root/'child.sid').write_text(str(os.getsid(0)))
    time.sleep(4)
    (root/'survived').write_text('reader child survived terminal close')
    os._exit(0)
os.waitpid(pid,0)
''')
    reader.chmod(0o755)
    pid, fd = pty.fork()
    if pid == 0:
        os.environ['LIFECYCLE_ROOT'] = str(root)
        os.environ['TMPDIR'] = str(root)
        os.execlp('bash', 'bash', str(launcher))
    status = None
    try:
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            done, result = os.waitpid(pid, os.WNOHANG)
            if done:
                status = result
                break
            time.sleep(0.05)
        assert status is not None, 'launcher did not detach in time'
        assert os.waitstatus_to_exitcode(status) == 0, status
        assert int((root / 'child.sid').read_text()) != pid, 'reader still shares launcher terminal session'
        os.close(fd)
        fd = -1
        while time.monotonic() < deadline and not (root / 'survived').exists():
            time.sleep(0.05)
        assert (root / 'survived').exists(), 'reader child died when the launcher terminal closed'
        print('PASS: reader child survives terminal closure even after restoring default SIGHUP')
    finally:
        if fd != -1:
            os.close(fd)
        if status is None:
            os.kill(pid, signal.SIGTERM)
            os.waitpid(pid, 0)
