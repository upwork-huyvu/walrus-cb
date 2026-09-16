import {
  HOTSPOT_SSID_MESSAGE,
  defaultPairingMode,
  getPairingMode,
  isTuyaHotspotSsid,
  modeNeedsBlePermission,
  modeNeedsWifi,
  pairingModesFor,
} from './pairingModes';

describe('danh sách mode theo nền tảng (AC4) - KHÔNG có auto', () => {
  it('Android: đúng 3 mode, đúng thứ tự client chốt (EZ → AP → BLE)', () => {
    expect(pairingModesFor('android').map((m) => m.id)).toEqual(['ez', 'ap', 'ble']);
  });

  it('iOS: cũng 3 mode, cùng thứ tự - Apple đã duyệt multicast entitlement nên EZ chạy được', () => {
    expect(pairingModesFor('ios').map((m) => m.id)).toEqual(['ez', 'ap', 'ble']);
  });

  it('mode `auto` đã bị bỏ hẳn khỏi cả 2 nền tảng', () => {
    for (const platform of ['ios', 'android'] as const) {
      expect(pairingModesFor(platform).map((m) => m.id)).not.toContain('auto');
    }
  });

  it('default = phần tử đầu = EZ trên CẢ HAI nền (iOS giống Android)', () => {
    expect(defaultPairingMode('android')).toBe('ez');
    expect(defaultPairingMode('ios')).toBe('ez');
  });

  it('id lạ (state cũ/deep-link) → lùi về mode mặc định, không sập màn', () => {
    expect(getPairingMode('auto' as any, 'ios').id).toBe('ez');
    expect(getPairingMode('auto' as any, 'android').id).toBe('ez');
  });
});

describe('mỗi mode đúng MỘT kênh - không còn chạy song song', () => {
  it.each([
    ['ez', 'ez'],
    ['ap', 'ap'],
    ['ble', 'ble'],
  ] as const)('android %s → channel=%s', (id, channel) => {
    expect(getPairingMode(id, 'android').channel).toBe(channel);
  });

  it('`channel` là chuỗi đơn, KHÔNG phải mảng (kiểu dữ liệu phải chặn việc gộp kênh trở lại)', () => {
    for (const m of pairingModesFor('android')) {
      expect(Array.isArray(m.channel)).toBe(false);
      expect(typeof m.channel).toBe('string');
    }
  });
});

// `wifiInput` (quét/gõ tay) là chuyện NỀN TẢNG; `prefillCurrentWifi` (tự điền mạng ĐANG NỐI) là
// chuyện MODE có ô Wi-Fi hay không. Hai thứ độc lập nhau.
describe('wifiInput - quét hay gõ tay, quyết định bởi NỀN TẢNG có quét được không (AC8/AC9)', () => {
  it('Android quét được → EZ và AP đều dropdown', () => {
    expect(getPairingMode('ez', 'android').wifiInput).toBe('dropdown');
    expect(getPairingMode('ap', 'android').wifiInput).toBe('dropdown');
  });

  it('iOS không có API liệt kê Wi-Fi → CẢ EZ lẫn AP đều gõ tay', () => {
    expect(getPairingMode('ap', 'ios').wifiInput).toBe('manual');
    expect(getPairingMode('ez', 'ios').wifiInput).toBe('manual');
  });

  // Gõ tay ≠ không tự điền. iOS đọc được SSID đang nối (entitlement wifi-info + quyền Location).
  it('iOS EZ và AP: gõ tay nhưng VẪN tự điền', () => {
    expect(getPairingMode('ez', 'ios').prefillCurrentWifi).toBe(true);
    expect(getPairingMode('ap', 'ios').prefillCurrentWifi).toBe(true);
  });

  it('BLE → none (không cần Wi-Fi)', () => {
    expect(getPairingMode('ble', 'android').wifiInput).toBe('none');
  });

  it('modeNeedsWifi suy từ wifiInput, không phải cờ riêng (tránh 2 nguồn sự thật lệch nhau)', () => {
    expect(modeNeedsWifi('ez', 'android')).toBe(true);
    expect(modeNeedsWifi('ap', 'ios')).toBe(true);
    expect(modeNeedsWifi('ble', 'android')).toBe(false);
  });
});

// Đính chính 2026-09-15 (client chỉ ra): Smart Life + doc iOS SDK lấy Wi-Fi nhà TRƯỚC khi nối hotspot
// - lúc đó máy còn ở Wi-Fi nhà ⇒ tự điền ở AP là đúng, y như EZ. Bản trước cấm hẳn ở AP.
describe('prefillCurrentWifi - tự điền mạng ĐANG NỐI ở mọi mode có ô Wi-Fi', () => {
  it.each([
    ['ez', 'android'],
    ['ez', 'ios'],
    ['ap', 'android'],
    ['ap', 'ios'],
  ] as const)('%s / %s → true', (id, platform) => {
    expect(getPairingMode(id, platform).prefillCurrentWifi).toBe(true);
  });

  it('BLE → false (không có ô Wi-Fi để điền)', () => {
    expect(getPairingMode('ble', 'ios').prefillCurrentWifi).toBe(false);
  });
});

// Ca DUY NHẤT tự điền sai là máy đang ở hotspot của chính thiết bị → nhận ra bằng tên.
describe('isTuyaHotspotSsid - nhận diện hotspot thiết bị để không điền vào ô router', () => {
  it.each(['SmartLife-BEEC', 'smartlife-1a2b', 'SmartLife_0F3C', 'SmartLife-XXXX-extra', 'SL-Walrus-A1B2'])(
    '"%s" là hotspot Tuya',
    (ssid) => expect(isTuyaHotspotSsid(ssid)).toBe(true),
  );

  it.each(['Can March', 'SL-Home', 'SmartHome', 'MySmartLife', 'SL-A1B2', '', '   '])(
    '"%s" KHÔNG phải hotspot (router nhà / rỗng) - không được chặn nhầm',
    (ssid) => expect(isTuyaHotspotSsid(ssid)).toBe(false),
  );

  it('null/undefined → false, không ném lỗi', () => {
    expect(isTuyaHotspotSsid(null)).toBe(false);
    expect(isTuyaHotspotSsid(undefined)).toBe(false);
  });

  it('message dùng chung bảo user nhập Wi-Fi nhà và rời hotspot', () => {
    expect(HOTSPOT_SSID_MESSAGE).toMatch(/Walrus hotspot/);
    expect(HOTSPOT_SSID_MESSAGE).toMatch(/home Wi-Fi/);
  });
});

describe('wifiNotice - cảnh báo trên ô Wi-Fi', () => {
  it('AP có cảnh báo "Wi-Fi nhà, không phải hotspot SmartLife" ở cả 2 nền tảng', () => {
    for (const platform of ['ios', 'android'] as const) {
      expect(getPairingMode('ap', platform).wifiNotice).toMatch(/SmartLife/);
      expect(getPairingMode('ap', platform).wifiNotice).toMatch(/HOME Wi-Fi/);
    }
  });

  it('EZ không cần cảnh báo đó (không có hotspot nào để nhầm)', () => {
    expect(getPairingMode('ez', 'android').wifiNotice).toBeUndefined();
  });
});

describe('hướng dẫn từng bước (AC10) - phải khớp doc, không viết theo trí nhớ', () => {
  it('mọi mode đều có danh sách bước (không phải 1 đoạn văn), mỗi bước đủ dài để làm theo', () => {
    for (const platform of ['ios', 'android'] as const) {
      for (const m of pairingModesFor(platform)) {
        expect(Array.isArray(m.steps)).toBe(true);
        expect(m.steps.length).toBeGreaterThanOrEqual(3);
        m.steps.forEach((s) => expect(s.length).toBeGreaterThan(20));
      }
    }
  });

  it('đèn: EZ nháy NHANH, AP nháy CHẬM - và luôn là bước 1 (thứ user hay làm sai nhất)', () => {
    expect(getPairingMode('ez', 'android').steps[0]).toMatch(/QUICKLY/);
    expect(getPairingMode('ap', 'android').steps[0]).toMatch(/SLOWLY/);
    expect(getPairingMode('ap', 'ios').steps[0]).toMatch(/SLOWLY/);
  });

  // Yêu cầu client 2026-07-16: "mode AP phải ghi rõ là kết nối với cái wifi của thiết bị".
  // Bản trước bảo user Android "khỏi rời app" dựa vào 1 dòng doc Android - dòng đó thuộc AP flow MỚI
  // (newOptimizedActivator, firmware ≥ 3.6.1), app này đi path legacy nên Android KHÔNG tự nối.
  it.each(['ios', 'android'] as const)(
    'AP (%s): phải có bước NỐI ĐIỆN THOẠI vào hotspot của thiết bị, gọi đúng tên "SmartLife"',
    (platform) => {
      const steps = getPairingMode('ap', platform).steps.join(' ');
      expect(steps).toMatch(/SmartLife/);
      expect(steps).toMatch(/Wi-Fi settings|Settings → Wi-Fi/);
      expect(steps).toMatch(/Walrus hotspot/);
    },
  );

  it('AP: KHÔNG được bảo user "khỏi rời app" hay "Android tự nối hộ" (hồi quy - hướng dẫn cũ sai)', () => {
    for (const platform of ['ios', 'android'] as const) {
      const steps = getPairingMode('ap', platform).steps.join(' ');
      expect(steps).not.toMatch(/no need to leave the app/);
      expect(steps).not.toMatch(/offers to connect for you/);
    }
  });

  // Thiết bị tắt hotspot NGAY khi nhận xong credentials (doc iOS SDK), trước khi pairing xong ⇒ mốc
  // "giữ máy ở hotspot" phải là "tới khi hotspot biến mất", không phải "tới khi xong".
  it('AP: nhắc giữ máy ở hotspot tới khi HOTSPOT BIẾN MẤT, rồi tự về Wi-Fi nhà nếu máy không tự về', () => {
    for (const platform of ['ios', 'android'] as const) {
      const steps = getPairingMode('ap', platform).steps.join(' ');
      expect(steps).toMatch(/Keep the phone on the Walrus hotspot until it disappears/);
      expect(steps).not.toMatch(/until it finishes/);
      expect(steps).toMatch(/reconnect to it yourself/);
    }
  });

  // Bước nhập Wi-Fi phải khớp CONTROL thật: Android là dropdown (pick), iOS là ô gõ tay đã tự điền
  // có điều kiện (Location) - không hứa "it is filled in for you" vô điều kiện (D1).
  it('bước nhập Wi-Fi theo control: Android "Pick", iOS "Check ... when Location is allowed; otherwise type"', () => {
    expect(getPairingMode('ap', 'android').steps[1]).toMatch(/^Pick your home 2\.4GHz Wi-Fi/);
    expect(getPairingMode('ap', 'ios').steps[1]).toMatch(/^Check the Wi-Fi name below/);
    expect(getPairingMode('ap', 'ios').steps[1]).toMatch(/when Location is allowed; otherwise type it/);
    expect(getPairingMode('ez', 'ios').steps[2]).toMatch(/when Location is allowed; otherwise type it/);
    expect(getPairingMode('ez', 'ios').steps[2]).not.toMatch(/it is filled in for you/);
  });

  it('AP nói rõ ssid/password là của ROUTER, không phải hotspot thiết bị (gõ nhầm = fail 100%)', () => {
    for (const platform of ['ios', 'android'] as const) {
      expect(getPairingMode('ap', platform).steps.join(' ')).toMatch(
        /NOT the device’s own hotspot/,
      );
    }
  });

  it('EZ cảnh báo 2.4GHz (Walrus không join được 5GHz)', () => {
    expect(getPairingMode('ez', 'android').steps.join(' ')).toMatch(/2\.4GHz/);
  });

  it('AP iOS và AP Android có nội dung KHÁC NHAU', () => {
    expect(getPairingMode('ap', 'ios').steps).not.toEqual(getPairingMode('ap', 'android').steps);
  });

  it('label + hint riêng từng mode', () => {
    const modes = pairingModesFor('android');
    expect(new Set(modes.map((m) => m.label)).size).toBe(modes.length);
    expect(new Set(modes.map((m) => m.hint)).size).toBe(modes.length);
  });
});

describe('modeNeedsBlePermission - chỉ xin quyền Bluetooth khi mode thật sự quét BLE', () => {
  it.each([
    ['ble', true],
    ['ez', false],
    ['ap', false],
  ] as const)('android %s → %s', (id, expected) => {
    expect(modeNeedsBlePermission(id, 'android')).toBe(expected);
  });

  it('iOS: BLE cần quyền, AP thì không', () => {
    expect(modeNeedsBlePermission('ble', 'ios')).toBe(true);
    expect(modeNeedsBlePermission('ap', 'ios')).toBe(false);
  });
});
