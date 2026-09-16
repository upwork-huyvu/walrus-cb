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

  it('EZ trên iOS → nhắc Local Network + không đọc được băng tần (nói thật, không giả vờ)', async () => {
    const p = load({ band: 'unknown', frequency: 0, bandAvailable: false });
    const issues = await p.preflightPairing({ mode: 'EZ', ssid: 'Can March', platform: 'ios' });

    expect(codes(issues)).toEqual(expect.arrayContaining(['ios_local_network', 'band_unknown']));
    // Chỉ cảnh báo, KHÔNG chặn: EZ giờ là mode mặc định trên iOS, chặn nó là chặn luồng chính.
    expect(p.hasBlocker(issues)).toBe(false);
  });

  // SSID hotspot thiết bị không bao giờ là SSID router hợp lệ → chặn ở MỌI mode (D7). EZ dính khi máy
  // còn kẹt ở hotspot sau lần AP hỏng và prefill điền nó vào; AP dính khi user chọn nhầm.
  it.each([
    ['EZ', 'ios'],
    ['EZ', 'android'],
    ['AP', 'ios'],
    ['AP', 'android'],
  ] as const)('%s / %s: SSID "SmartLife-BEEC" (hotspot thiết bị) → block', async (mode, platform) => {
    const p = load();
    const issues = await p.preflightPairing({ mode, ssid: 'SmartLife-BEEC', platform });
    expect(codes(issues)).toContain('ssid_is_device_hotspot');
    expect(p.hasBlocker(issues)).toBe(true);
    expect(issues.find((i: any) => i.code === 'ssid_is_device_hotspot').message).toMatch(/home Wi-Fi/);
  });

  it('SSID router bình thường → không bị chặn nhầm là hotspot', async () => {
    const p = load();
    const issues = await p.preflightPairing({ mode: 'AP', ssid: 'SL-Home', platform: 'android' });
    expect(codes(issues)).not.toContain('ssid_is_device_hotspot');
  });

  // Entitlement multicast đã được Apple duyệt → không còn cảnh báo nào bảo user tránh EZ trên iOS.
  it('không còn cảnh báo multicast đuổi user sang AP', async () => {
    const p = load({ band: 'unknown', frequency: 0, bandAvailable: false });
    const issues = await p.preflightPairing({ mode: 'EZ', ssid: 'Can March', platform: 'ios' });
    expect(codes(issues)).not.toContain('ios_ez_multicast');
    expect(issues.map((i: any) => i.message).join(' ')).not.toMatch(/Use AP mode instead/i);
  });

  // AP không check băng tần (lúc Start máy ở hotspot thiết bị, router 2.4/5GHz đều được) NHƯNG vẫn là
  // traffic LAN → iOS hỏi Local Network y hệt EZ (D6). Quyền này không liên quan multicast entitlement.
  it('AP trên iOS: bỏ check băng tần nhưng VẪN nhắc Local Network (warn, không chặn)', async () => {
    const p = load({ band: '5GHz', frequency: 5180, bandAvailable: false });
    const issues = await p.preflightPairing({ mode: 'AP', ssid: 'Can March', platform: 'ios' });
    expect(codes(issues)).toEqual(['ios_local_network']);
    expect(p.hasBlocker(issues)).toBe(false);
  });

  it('AP trên Android: không có gì để cảnh báo', async () => {
    const p = load({ band: '5GHz', frequency: 5180 });
    const issues = await p.preflightPairing({ mode: 'AP', ssid: 'Can March', platform: 'android' });
    expect(issues).toHaveLength(0);
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
