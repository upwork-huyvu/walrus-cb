export {}; // module scope

/** Nạp lại module với 1 bản wifiScanner giả (band + khả năng đọc band). */
function load(opts: { band?: string; frequency?: number; bandAvailable?: boolean } = {}) {
  jest.resetModules();
  jest.doMock('./wifiScanner', () => ({
    wifiBandAvailable: opts.bandAvailable ?? true,
    getCurrentWifiBand: jest
      .fn()
      .mockResolvedValue({ band: opts.band ?? '2.4GHz', frequency: opts.frequency ?? 2437 }),
  }));
  jest.doMock('./pairingLog', () => ({ logPairing: jest.fn() }));
  return require('./pairingPreflight');
}

const codes = (issues: any[]) => issues.map((i) => i.code);

describe('preflightPairing - chặn sớm thay vì chạy 120s rồi báo lỗi rỗng', () => {
  it('SSID rỗng → block', async () => {
    const p = load();
    const issues = await p.preflightPairing({ mode: 'AP', ssid: '   ', platform: 'android' });
    expect(codes(issues)).toContain('ssid_empty');
    expect(p.hasBlocker(issues)).toBe(true);
  });

  it('EZ trên mạng 5GHz → block, message nêu rõ tần số + lối thoát', async () => {
    const p = load({ band: '5GHz', frequency: 5180 });
    const issues = await p.preflightPairing({ mode: 'EZ', ssid: 'Can March', platform: 'android' });

    expect(codes(issues)).toContain('band_5ghz');
    expect(p.hasBlocker(issues)).toBe(true);
    const msg = issues.find((i: any) => i.code === 'band_5ghz').message;
    expect(msg).toContain('5180');
    expect(msg).toMatch(/2\.4GHz/);
    expect(msg).toMatch(/AP mode/);
  });

  it('EZ trên 6GHz cũng bị chặn', async () => {
    const p = load({ band: '6GHz', frequency: 5955 });
    const issues = await p.preflightPairing({ mode: 'EZ', ssid: 'x', platform: 'android' });
    expect(p.hasBlocker(issues)).toBe(true);
  });

  it('EZ trên 2.4GHz (Android) → không chặn, không cảnh báo thừa', async () => {
    const p = load({ band: '2.4GHz', frequency: 2437 });
    const issues = await p.preflightPairing({ mode: 'EZ', ssid: 'Can March', platform: 'android' });
    expect(p.hasBlocker(issues)).toBe(false);
    expect(codes(issues)).not.toContain('band_unknown');
  });

  it('EZ trên iOS → cảnh báo entitlement multicast + không đọc được băng tần (nói thật, không giả vờ)', async () => {
    const p = load({ band: 'unknown', frequency: 0, bandAvailable: false });
    const issues = await p.preflightPairing({ mode: 'EZ', ssid: 'Can March', platform: 'ios' });

    expect(codes(issues)).toEqual(expect.arrayContaining(['ios_ez_multicast', 'band_unknown']));
    // Cảnh báo thôi - không chặn, vì có thể entitlement đã được Apple duyệt trong bản build này.
    expect(p.hasBlocker(issues)).toBe(false);
  });

  it('AP mode bỏ qua hết check băng tần/entitlement (nó không dùng multicast)', async () => {
    const p = load({ band: '5GHz', frequency: 5180, bandAvailable: false });
    const issues = await p.preflightPairing({ mode: 'AP', ssid: 'Can March', platform: 'ios' });
    expect(issues).toHaveLength(0);
    expect(p.hasBlocker(issues)).toBe(false);
  });
});

describe('hasBlocker', () => {
  it('chỉ severity=block mới chặn', () => {
    const p = load();
    expect(p.hasBlocker([{ code: 'x', severity: 'warn', message: '' }])).toBe(false);
    expect(p.hasBlocker([{ code: 'x', severity: 'block', message: '' }])).toBe(true);
    expect(p.hasBlocker([])).toBe(false);
  });
});
