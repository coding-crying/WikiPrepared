const z = require('../src/shared/zim-names');

describe('parseZimFilename', () => {
  test.each([
    ['wikipedia_en_all_maxi_2026-08.zim', { language: 'en', topic: 'all', scope: 'maxi', date: '2026-08' }],
    ['wikipedia_en_all_nopic_2026-06.zim', { topic: 'all', scope: 'nopic', date: '2026-06' }],
    // Current Kiwix names without a flavour used to parse as scope "2026-08".
    ['wikipedia_en_100_2026-08.zim', { topic: '100', scope: 'maxi', date: '2026-08' }],
    ['wikipedia_en_ray-charles_mini_2026-10.zim', { topic: 'ray-charles', scope: 'mini', date: '2026-10' }],
    // Topics containing underscores used to parse as topic "for", scope "schools".
    ['wikipedia_ar_for_schools_maxi_2024-05.zim', { language: 'ar', topic: 'for_schools', scope: 'maxi', date: '2024-05' }],
  ])('%s', (name, expected) => {
    const m = z.parseZimFilename(name);
    expect(m.valid).toBe(true);
    expect(m).toMatchObject(expected);
  });

  test('friendly/renamed files are not mistaken for catalog entries', () => {
    expect(z.parseZimFilename('Wikipedia - English (Full).zim').valid).toBe(false);
    expect(z.parseZimFilename('foo.zim').valid).toBe(false);
  });
});

describe('latestPerSeries', () => {
  test('keeps only the newest release of each edition', () => {
    const entries = [
      'wikipedia_en_all_maxi_2026-02.zim',
      'wikipedia_en_all_maxi_2026-08.zim',
      'wikipedia_en_all_nopic_2026-03.zim',
      'wikipedia_en_all_nopic_2026-06.zim',
      'wikipedia_en_100_2026-07.zim',
      'wikipedia_en_100_2026-08.zim',
    ].map((filename) => ({ filename }));
    expect(z.latestPerSeries(entries).map((e) => e.filename)).toEqual([
      'wikipedia_en_all_maxi_2026-08.zim',
      'wikipedia_en_all_nopic_2026-06.zim',
      'wikipedia_en_100_2026-08.zim',
    ]);
  });
});

describe('Kiwix URLs', () => {
  const dumps = 'https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/wikipedia_en_100_2026-08.zim';
  test('maps the Wikimedia mirror to download.kiwix.org', () => {
    expect(z.kiwixDownloadUrl(dumps)).toBe('https://download.kiwix.org/zim/wikipedia/wikipedia_en_100_2026-08.zim');
    expect(z.wikimediaMirrorUrl(z.kiwixDownloadUrl(dumps))).toBe(dumps);
  });
  test('checksum lookup asks download.kiwix.org first (dumps has no .sha256)', () => {
    expect(z.sha256CandidateUrls(dumps)[0]).toBe('https://download.kiwix.org/zim/wikipedia/wikipedia_en_100_2026-08.zim.sha256');
  });
  test('non-ZIM URLs are left alone', () => {
    expect(z.kiwixDownloadUrl('https://download.kiwix.org/release/kiwix-macos/kiwix-macos.dmg')).toBeNull();
  });
});
