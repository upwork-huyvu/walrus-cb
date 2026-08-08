import {
  MAX_BLIPS,
  bleKey,
  blipFromBleScan,
  blipFromEzStep,
  blipPosition,
  isEzFindStep,
  isPairableBlip,
  upsertBlip,
} from './radarModel';
import type { Blip } from './radarModel';
import type { BleScanItem } from './pairing';

const ble = (over: Partial<BleScanItem> = {}): BleScanItem => ({
  id: 'id-1',
  name: 'Walrus Ice Bath',
  productId: 'p1',
  uuid: 'uuid-1',
  mac: 'AA:BB',
  address: '',
  deviceType: 0,
  isCombo: true,
  ...over,
});

describe('blipPosition - vị trí phải TẤT ĐỊNH (AC2: blip không được nhảy chỗ khi re-render)', () => {
  it('cùng key → cùng toạ độ, gọi bao nhiêu lần cũng vậy', () => {
    const a = blipPosition('ble:uuid-1');
    const b = blipPosition('ble:uuid-1');
    expect(a).toEqual(b);
  });

  it('key khác nhau → toạ độ khác nhau (không dồn cục 1 chỗ)', () => {
    const keys = ['ble:a', 'ble:b', 'ble:c', 'ble:d', 'ez:pending'];
    const positions = keys.map((k) => `${blipPosition(k).angle}|${blipPosition(k).radius}`);
    expect(new Set(positions).size).toBe(keys.length);
  });

  it('luôn nằm trong vùng vẽ được: góc 0-360, bán kính tránh tâm và tránh mép', () => {
    for (let i = 0; i < 200; i++) {
      const { angle, radius } = blipPosition(`ble:uuid-${i}`);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThan(360);
      // Tâm là chỗ icon radar, mép thì blip bị cắt → phải nằm giữa.
      expect(radius).toBeGreaterThanOrEqual(0.38);
      expect(radius).toBeLessThanOrEqual(0.86);
    }
  });
});

describe('bleKey - khoá dedupe', () => {
  it('ưu tiên uuid (thứ pairing thật sự dùng)', () => {
    expect(bleKey(ble())).toBe('ble:uuid-1');
  });

  it('uuid rỗng → lùi về mac, rồi id (chống blip trùng khi SDK trả thiếu field)', () => {
    expect(bleKey(ble({ uuid: '' }))).toBe('ble:AA:BB');
    expect(bleKey(ble({ uuid: '', mac: '' }))).toBe('ble:id-1');
    expect(bleKey(ble({ uuid: '', mac: '', id: '' }))).toBe('ble:unknown');
  });
});

describe('blipFromBleScan', () => {
  it('giữ raw để pair được + label lùi về tên chung khi SDK không trả tên', () => {
    const blip = blipFromBleScan(ble({ name: '' }));
    expect(blip.source).toBe('ble');
    expect(blip.label).toBe('Walrus device');
    expect(blip.raw?.uuid).toBe('uuid-1');
    expect(isPairableBlip(blip)).toBe(true);
  });
});

describe('isEzFindStep - chuỗi step Tuya CHƯA document → khớp lỏng nhưng chặn cứng nhánh lỗi', () => {
  it.each(['device_find', 'device_found', 'DEVICE_FIND'])('%s → là blip', (step) => {
    expect(isEzFindStep(step)).toBe(true);
  });

  it.each([
    'device_timeout', // iOS ThingActivatorStep 4 - đi CHUNG kênh tiến trình, từng bị hiểu nhầm là tiến trình
    'device_state_error',
    'device_bind_success',
    'device_registered',
    'pairing_fail',
  ])('%s → KHÔNG phải blip', (step) => {
    expect(isEzFindStep(step)).toBe(false);
  });
});

describe('blipFromEzStep', () => {
  it('step không phải find → null', () => {
    expect(blipFromEzStep({ step: 'device_bind_success' })).toBeNull();
    expect(blipFromEzStep({ step: 'device_timeout' })).toBeNull();
  });

  it('find không kèm devId (ca thường gặp) → 1 blip vô danh, KHÔNG pair được bằng tap', () => {
    const blip = blipFromEzStep({ step: 'device_find' })!;
    expect(blip.source).toBe('ez');
    expect(blip.key).toBe('ez:pending');
    expect(isPairableBlip(blip)).toBe(false); // EZ đã tự bind rồi - tap không gate được gì
  });

  it('nhiều lần find liên tiếp không devId → vẫn 1 blip (không vẽ trùng)', () => {
    const a = blipFromEzStep({ step: 'device_find' })!;
    const b = blipFromEzStep({ step: 'device_find' })!;
    let list: Blip[] = [];
    list = upsertBlip(list, a);
    list = upsertBlip(list, b);
    expect(list).toHaveLength(1);
  });

  it('có devId → mỗi thiết bị 1 blip riêng', () => {
    const a = blipFromEzStep({ step: 'device_find', devId: 'd1' })!;
    const b = blipFromEzStep({ step: 'device_find', devId: 'd2' })!;
    expect(a.key).not.toBe(b.key);
  });
});

describe('upsertBlip', () => {
  it('BLE bắn lặp cùng thiết bị → dedupe theo key, không ngập blip trùng', () => {
    let list: Blip[] = [];
    for (let i = 0; i < 20; i++) list = upsertBlip(list, blipFromBleScan(ble()));
    expect(list).toHaveLength(1);
  });

  it('cập nhật blip cũ giữ NGUYÊN toạ độ (tên đổi giữa chừng không được làm blip nhảy chỗ)', () => {
    const first = blipFromBleScan(ble({ name: 'Walrus' }));
    let list = upsertBlip([], first);
    const moved: Blip = { ...first, label: 'Walrus Ice Bath', angle: 999, radius: 0.1 };
    list = upsertBlip(list, moved);

    expect(list[0].label).toBe('Walrus Ice Bath');
    expect(list[0].angle).toBe(first.angle);
    expect(list[0].radius).toBe(first.radius);
  });

  it('thiết bị mới xuống cuối, không xáo chỗ thiết bị đã hiện', () => {
    let list = upsertBlip([], blipFromBleScan(ble({ uuid: 'u1' })));
    list = upsertBlip(list, blipFromBleScan(ble({ uuid: 'u2' })));
    list = upsertBlip(list, blipFromBleScan(ble({ uuid: 'u3' })));
    expect(list.map((b) => b.key)).toEqual(['ble:u1', 'ble:u2', 'ble:u3']);
  });

  it('BLE và EZ cùng lúc → 2 blip riêng, phân biệt được nguồn (AC5)', () => {
    let list = upsertBlip([], blipFromBleScan(ble()));
    list = upsertBlip(list, blipFromEzStep({ step: 'device_find' })!);
    expect(list.map((b) => b.source)).toEqual(['ble', 'ez']);
  });

  it('chạm trần cap → bỏ qua thiết bị mới, giữ cái đã hiện', () => {
    let list: Blip[] = [];
    for (let i = 0; i < MAX_BLIPS + 5; i++) {
      list = upsertBlip(list, blipFromBleScan(ble({ uuid: `u${i}` })));
    }
    expect(list).toHaveLength(MAX_BLIPS);
    expect(list[0].key).toBe('ble:u0'); // cái đầu tiên vẫn còn đó

    // Nhưng thiết bị ĐÃ hiện thì vẫn cập nhật được dù đang full.
    list = upsertBlip(list, blipFromBleScan(ble({ uuid: 'u0', name: 'Renamed' })));
    expect(list).toHaveLength(MAX_BLIPS);
    expect(list[0].label).toBe('Renamed');
  });
});
