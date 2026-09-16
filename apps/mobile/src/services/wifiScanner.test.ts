import { bandOfFrequency } from './wifiScanner';

describe('bandOfFrequency - Wi-Fi EZ của Tuya chỉ chạy 2.4GHz', () => {
  it.each([
    [2412, '2.4GHz'], // channel 1
    [2437, '2.4GHz'], // channel 6
    [2472, '2.4GHz'], // channel 13
    [5180, '5GHz'], // channel 36
    [5500, '5GHz'],
    [5825, '5GHz'], // channel 165
    [5955, '6GHz'], // Wi-Fi 6E
    [7115, '6GHz'],
  ])('%i MHz → %s', (mhz, band) => {
    expect(bandOfFrequency(mhz)).toBe(band);
  });

  it.each([0, -1, 100, 3000, 5910, 9000])('%i MHz → unknown (không đoán bừa)', (mhz) => {
    expect(bandOfFrequency(mhz)).toBe('unknown');
  });
});

/** Nạp lại module với lib react-native-wifi-reborn giả + Platform.OS tuỳ chọn. */
function loadWithLib(getCurrentWifiSSID: () => Promise<string>, os: 'ios' | 'android' = 'ios') {
  jest.resetModules();
  jest.doMock('react-native', () => ({
    Platform: { OS: os },
    PermissionsAndroid: { PERMISSIONS: {}, RESULTS: {}, check: jest.fn(), request: jest.fn() },
  }));
  jest.doMock('react-native-wifi-reborn', () => ({ default: { getCurrentWifiSSID } }));
  return require('./wifiScanner') as typeof import('./wifiScanner');
}

describe('detectCurrentWifi - lý do phải đúng để UI nói đúng', () => {
  it('đọc được SSID router → ok', async () => {
    const w = loadWithLib(async () => 'Can March');
    await expect(w.detectCurrentWifi()).resolves.toEqual({ ok: true, ssid: 'Can March' });
  });

  // Mã lỗi thật của lib viết THƯỜNG chữ l (ConnectError.m: `locationPermissionDenied`). Bản trước so
  // `includes('LocationPermission')` (hoa) nên không bao giờ khớp → user chỉ thấy "Could not detect".
  it.each(['locationPermissionDenied', 'locationPermissionRestricted', 'locationPermissionMissing'])(
    'lib reject code "%s" → reason permission (kèm hướng dẫn cấp quyền)',
    async (code) => {
      const w = loadWithLib(async () => {
        throw Object.assign(new Error('Cannot detect SSID'), { code });
      });
      const res = await w.detectCurrentWifi();
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('permission');
        expect(res.message).toMatch(/Allow Location/);
      }
    },
  );

  it('lỗi khác → reason error, không nhận nhầm là permission', async () => {
    const w = loadWithLib(async () => {
      throw Object.assign(new Error('boom'), { code: 'couldNotDetectSSID' });
    });
    const res = await w.detectCurrentWifi();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('error');
  });

  // Máy đang ở hotspot của chính thiết bị → KHÔNG được coi là "đọc được" rồi điền vào ô router.
  it('SSID là hotspot thiết bị (SmartLife-xxxx) → reason hotspot', async () => {
    const w = loadWithLib(async () => 'SmartLife-BEEC');
    const res = await w.detectCurrentWifi();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('hotspot');
      expect(res.message).toMatch(/home Wi-Fi/);
    }
  });

  // iOS 13+ thiếu Location trả placeholder "WLAN"/"Wi-Fi" (doc Tuya "Pair") - không phải tên mạng.
  it.each(['WLAN', 'Wi-Fi'])('iOS trả placeholder "%s" → not-found, không điền chữ đó vào ô', async (s) => {
    const w = loadWithLib(async () => s, 'ios');
    const res = await w.detectCurrentWifi();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('not-found');
  });

  it('Android: tên mạng "WLAN" là tên thật, vẫn ok', async () => {
    const w = loadWithLib(async () => 'WLAN', 'android');
    await expect(w.detectCurrentWifi()).resolves.toEqual({ ok: true, ssid: 'WLAN' });
  });

  it('getCurrentWifiSsid (bản im lặng) → null cho mọi ca không ok, kể cả hotspot', async () => {
    const w = loadWithLib(async () => 'SmartLife-BEEC');
    await expect(w.getCurrentWifiSsid()).resolves.toBeNull();
  });
});
