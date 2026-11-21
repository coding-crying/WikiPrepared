jest.mock('drivelist', () => ({ list: jest.fn() }), { virtual: true });
const DriveManager = require('../src/main/managers/DriveManager');

describe('canonicalFilesystem', () => {
  const dm = new DriveManager();
  test.each([
    ['MS-DOS FAT32', 'fat32'], // diskutil
    ['vfat', 'fat32'], // Linux
    ['FAT32', 'fat32'], // Windows
    ['ExFAT', 'exfat'],
    ['exFAT', 'exfat'],
    ['NTFS', 'ntfs'],
    ['APFS', 'apfs'],
    ['Mac OS Extended (Journaled)', 'hfs+'],
    ['Not applicable', null],
    [null, null],
  ])('%s -> %s', (input, expected) => {
    expect(dm.canonicalFilesystem(input)).toBe(expected);
  });
});

describe('Linux format script', () => {
  test('sets an MBR partition type Windows mounts and formats in one privileged call', () => {
    const src = require('fs').readFileSync(require.resolve('../src/main/managers/DriveManager.js'), 'utf8');
    expect(src).toMatch(/mkpart primary "\$ptype" 1MiB 100%/);
    expect(src).not.toMatch(/mkpart', 'primary', '0%'/);
    expect((src.match(/safeExec\('pkexec'/g) || []).length).toBe(2); // format script + lazy-unmount fallback
  });
});
