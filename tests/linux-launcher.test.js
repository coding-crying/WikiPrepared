const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const PlatformLauncherService = require('../src/main/services/PlatformLauncherService');
const FileService = require('../src/main/services/FileService');
const assets = path.resolve(__dirname, '../src/main/assets');
let root;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'wp-linux-test-')); });
afterEach(async () => { jest.restoreAllMocks(); await fs.remove(root); });
function service() {
  const instance = new PlatformLauncherService();
  instance.getAssetPath = name => path.join(assets, name);
  return instance;
}
async function bundle(script = '#!/bin/bash\nprintf "%s\\n" "$@" > "$CAPTURE"\nexit 0\n') {
  const usb = path.join(root, 'USB with spaces \' $cash % & (test)');
  await fs.ensureDir(path.join(usb, '.data'));
  await fs.ensureDir(path.join(usb, 'Library'));
  await service().copyLinuxLaunchers(usb);
  await fs.writeFile(path.join(usb, '.data/kiwix-linux.AppImage'), script, { mode: 0o644 });
  return usb;
}
function launch(usb, args = [], overrides = {}) {
  return spawnSync('bash', [path.join(usb, 'START - Linux.sh'), ...args], {
    encoding: 'utf8', timeout: 15000,
    env: { ...process.env, TMPDIR: root, CAPTURE: path.join(root, 'args'), ...overrides },
  });
}
test('both structure creation paths ship identical relocatable Linux launchers', async () => {
  const direct = path.join(root, 'direct');
  const transfer = path.join(root, 'transfer');
  await fs.ensureDir(direct);
  await service().createAllLaunchers(direct);
  const fileService = new FileService();
  fileService.getAssetPath = name => path.join(assets, name);
  await fileService.prepareUSBStructure(transfer);
  for (const name of ['START - Linux.sh', 'Open WikiPrepared.desktop', 'README.txt']) {
    expect(await fs.readFile(path.join(direct, name), 'utf8')).toBe(await fs.readFile(path.join(transfer, name), 'utf8'));
  }
  const desktop = await fs.readFile(path.join(direct, 'Open WikiPrepared.desktop'), 'utf8');
  expect(desktop).toContain('%k');
  expect(desktop).not.toContain(root);
  expect((await fs.stat(path.join(direct, 'Open WikiPrepared.desktop'))).mode & 0o111).toBe(0o111);
});
test('desktop entry passes native desktop-file-validate when available', () => {
  const result = spawnSync('desktop-file-validate', [path.join(assets, 'Open WikiPrepared.desktop')], { encoding: 'utf8' });
  if (result.error && result.error.code === 'ENOENT') return;
  expect(result.stdout + result.stderr).toBe('');
  expect(result.status).toBe(0);
});
test('unsupported chmod preserves the copied launcher and warns', async () => {
  jest.spyOn(fs, 'chmod').mockRejectedValue(Object.assign(new Error('unsupported'), { code: 'EPERM' }));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await service().copyLinuxLaunchers(root);
  expect(await fs.pathExists(path.join(root, 'Open WikiPrepared.desktop'))).toBe(true);
  expect(warn).toHaveBeenCalled();
});
test('USB preparation copies both Linux launchers and README when chmod rejects EPERM', async () => {
  const chmod = jest.spyOn(fs, 'chmod').mockRejectedValue(Object.assign(new Error('unsupported'), { code: 'EPERM' }));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const fileService = new FileService();
  fileService.getAssetPath = name => path.join(assets, name);
  await expect(fileService.prepareUSBStructure(root)).resolves.toBeUndefined();
  expect(chmod).toHaveBeenCalledWith(path.join(root, 'START - Mac.command'), 0o755);
  for (const name of ['START - Linux.sh', 'Open WikiPrepared.desktop', 'README.txt']) {
    expect(await fs.readFile(path.join(root, name), 'utf8')).toBe(await fs.readFile(path.join(assets, name), 'utf8'));
  }
});
test('unexpected chmod I/O errors are not swallowed', async () => {
  jest.spyOn(fs, 'chmod').mockRejectedValue(Object.assign(new Error('I/O'), { code: 'EIO' }));
  await expect(service().makeExecutable('unused')).rejects.toThrow('I/O');
});
test('repairs reader execute bit, passes ZIM paths literally, and does not extract on clean exit', async () => {
  const usb = await bundle();
  const names = ['first book.zim', "quotes' $dollar ; touch BAD.zim"];
  for (const name of names) await fs.writeFile(path.join(usb, 'Library', name), 'fixture');
  const result = launch(usb);
  expect(result.status).toBe(0);
  const args = (await fs.readFile(path.join(root, 'args'), 'utf8')).trim().split('\n');
  expect(args.sort()).toEqual(names.map(name => path.join(usb, 'Library', name)).sort());
  expect(await fs.pathExists(path.join(usb, '.data/squashfs-root'))).toBe(false);
});
test('explicit args override automatic content discovery', async () => {
  const usb = await bundle();
  await fs.writeFile(path.join(usb, 'Library/a.zim'), 'fixture');
  expect(launch(usb, ['--help']).status).toBe(0);
  expect(await fs.readFile(path.join(root, 'args'), 'utf8')).toBe('--help\n');
});
test('relocated bundle and legacy content directory work', async () => {
  const usb = await bundle();
  await fs.move(path.join(usb, 'Library'), path.join(usb, 'Library (.zim files)'));
  await fs.writeFile(path.join(usb, 'Library (.zim files)/book.zim'), 'fixture');
  const moved = path.join(root, 'different mount');
  await fs.move(usb, moved);
  expect(launch(moved).status).toBe(0);
  expect(await fs.readFile(path.join(root, 'args'), 'utf8')).toContain(path.join(moved, 'Library (.zim files)/book.zim'));
});
test('legacy root AppImage is supported without moving it', async () => {
  const usb = await bundle();
  await fs.move(path.join(usb, '.data/kiwix-linux.AppImage'), path.join(usb, 'START - Linux.AppImage'));
  expect(launch(usb).status).toBe(0);
});
test('empty library opens the reader with an informative message', async () => {
  const usb = await bundle();
  const result = launch(usb);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('No ZIM files');
});
test('missing reader fails clearly without waiting on noninteractive stdin', async () => {
  const usb = await bundle();
  await fs.remove(path.join(usb, '.data/kiwix-linux.AppImage'));
  const result = launch(usb);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Linux reader not found');
});
test('noexec reports policy instead of attempting chmod or extraction (mocked findmnt)', async () => {
  const usb = await bundle();
  const bin = path.join(root, 'bin');
  await fs.ensureDir(bin);
  await fs.writeFile(path.join(bin, 'findmnt'), '#!/bin/sh\nprintf "rw,nosuid,noexec\\n"\n', { mode: 0o755 });
  const result = launch(usb, [], { PATH: `${bin}:${process.env.PATH}` });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('mounted with noexec');
  expect(await fs.pathExists(path.join(root, 'args'))).toBe(false);
});
test('unrelated runtime error is not misreported as FUSE and does not extract', async () => {
  const usb = await bundle('#!/bin/bash\necho "Qt platform error" >&2\nexit 9\n');
  const result = launch(usb);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Qt platform error');
  expect(result.stdout).not.toContain('FUSE is unavailable');
});
const fuseReader = `#!/bin/bash
if [[ "$1" == --appimage-extract ]]; then
  printf 'extract\\n' >> "$COUNT"
  mkdir squashfs-root
  printf '#!/bin/bash\\nprintf "%%s\\\\n" "$@" > "$CAPTURE"\\nexit 0\\n' > squashfs-root/AppRun
  chmod +x squashfs-root/AppRun
  exit 0
fi
echo 'AppImages require FUSE to run.' >&2
exit 1
`;
test('FUSE fallback extracts on USB, opens content, and reuses fingerprinted cache', async () => {
  const usb = await bundle(fuseReader);
  await fs.writeFile(path.join(usb, 'Library/book.zim'), 'fixture');
  const env = { COUNT: path.join(root, 'extractions') };
  for (let i = 0; i < 2; i++) {
    const result = launch(usb, [], env);
    expect(result.status).toBe(0);
  }
  expect(await fs.readFile(env.COUNT, 'utf8')).toBe('extract\n');
  expect(await fs.readFile(path.join(root, 'args'), 'utf8')).toContain('Library/book.zim');
  expect((await fs.readdir(path.join(usb, '.data'))).some(name => name.startsWith('kiwix-extracted-'))).toBe(true);
});
test('failed extraction is reported and staging directory is cleaned', async () => {
  const usb = await bundle('#!/bin/bash\nif [[ "$1" == --appimage-extract ]]; then echo "disk full" >&2; exit 1; fi\necho "AppImages require FUSE" >&2\nexit 1\n');
  const result = launch(usb);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('AppImage extraction failed');
  expect((await fs.readdir(path.join(usb, '.data'))).filter(name => name.startsWith('.kiwix-extract.'))).toEqual(['.kiwix-extract.lock']);
});
