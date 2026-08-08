import {
  defaultPairingMode,
  getPairingMode,
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

// ⚠️ `wifiInput` (quét/gõ tay) và `prefillCurrentWifi` (tự điền mạng ĐANG NỐI) là HAI thứ khác
// nhau - bản trước gộp làm một rồi cấm cả hai ở AP. Quét trả về MỌI mạng xung quanh nên luôn an
// toàn; chỉ "tự điền mạng đang nối" mới ra hotspot SmartLife của thiết bị.
describe('wifiInput - quét hay gõ tay, quyết định bởi NỀN TẢNG có quét được không (AC8/AC9)', () => {
  it('Android quét được → EZ và AP đều dropdown', () => {
    expect(getPairingMode('ez', 'android').wifiInput).toBe('dropdown');
    expect(getPairingMode('ap', 'android').wifiInput).toBe('dropdown');
  });

  it('iOS không có API liệt kê Wi-Fi → CẢ EZ lẫn AP đều gõ tay', () => {
    expect(getPairingMode('ap', 'ios').wifiInput).toBe('manual');
    expect(getPairingMode('ez', 'ios').wifiInput).toBe('manual');
  });

  // Gõ tay ≠ không tự điền. iOS đọc được SSID đang nối (entitlement wifi-info), và ở EZ thì mạng
  // đang nối CHÍNH LÀ mạng cần truyền → vẫn prefill được, khác hẳn AP.
  it('iOS EZ: gõ tay nhưng VẪN tự điền; iOS AP: gõ tay và KHÔNG tự điền', () => {
    expect(getPairingMode('ez', 'ios').prefillCurrentWifi).toBe(true);
    expect(getPairingMode('ap', 'ios').prefillCurrentWifi).toBe(false);
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

describe('prefillCurrentWifi - tự điền mạng ĐANG NỐI (tách khỏi wifiInput)', () => {
  it('EZ → true: máy đang ở chính mạng cần truyền cho thiết bị', () => {
    expect(getPairingMode('ez', 'android').prefillCurrentWifi).toBe(true);
  });

  it('AP → false ở CẢ 2 nền tảng, kể cả khi có dropdown: mạng đang nối có thể là hotspot thiết bị', () => {
    expect(getPairingMode('ap', 'android').prefillCurrentWifi).toBe(false);
    expect(getPairingMode('ap', 'ios').prefillCurrentWifi).toBe(false);
  });

  it('AP Android: có dropdown NHƯNG vẫn cấm tự điền - hai thứ độc lập nhau', () => {
    const ap = getPairingMode('ap', 'android');
    expect(ap.wifiInput).toBe('dropdown');
    expect(ap.prefillCurrentWifi).toBe(false);
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
  // Bản trước bảo user Android "khỏi rời app" dựa vào 1 dòng doc Android mâu thuẫn với user manual
  // + nhiều khả năng lỗi thời (Android 10+ không cho app tự join Wi-Fi ngầm).
  it.each(['ios', 'android'] as const)(
    'AP (%s): phải có bước NỐI ĐIỆN THOẠI vào hotspot của thiết bị, gọi đúng tên "SmartLife"',
    (platform) => {
      const steps = getPairingMode('ap', platform).steps.join(' ');
      expect(steps).toMatch(/SmartLife/);
      expect(steps).toMatch(/Wi-Fi settings|Settings → Wi-Fi/);
      expect(steps).toMatch(/Walrus hotspot/);
    },
  );

  it('AP: KHÔNG được bảo user "khỏi rời app" nữa (hồi quy - hướng dẫn cũ sai)', () => {
    for (const platform of ['ios', 'android'] as const) {
      expect(getPairingMode('ap', platform).steps.join(' ')).not.toMatch(/no need to leave the app/);
    }
  });

  it('AP: nhắc giữ máy ở hotspot tới khi xong (rời sớm là hỏng giữa chừng)', () => {
    for (const platform of ['ios', 'android'] as const) {
      expect(getPairingMode('ap', platform).steps.join(' ')).toMatch(/Keep the phone on the Walrus hotspot/);
    }
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
