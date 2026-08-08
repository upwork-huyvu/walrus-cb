// Radar model - gom thiết bị phát hiện được từ 2 NGUỒN KHÁC NHAU thành một danh sách blip để vẽ.
//
// Hai nguồn, hai bản chất khác nhau (đây là chỗ dễ hiểu nhầm nhất của màn này):
//   1. `ble` - từ `onBleScan()`. Scan TÁCH RỜI khỏi activate ⇒ blip BLE **chạm được → pair thật**.
//   2. `ez`  - từ `onPairingProgress()` step `device_find`. EZ phát mù, không có bước "thấy trước";
//      lúc SDK báo find thì nó **đã tự bind rồi** ⇒ blip EZ chỉ để HIỂN THỊ, chạm vào không gate
//      được gì. Xem dev-workflow/m1-pairing-radar-discovery/context.md (decision log 2026-07-15).
//
// Không import react-native ở đây (logic thuần) → test chạy thẳng, UI chỉ việc vẽ.
import type { BleScanItem, PairingProgress } from './pairing';

export type BlipSource = 'ble' | 'ez';

export type Blip = {
  /** Khoá dedupe + khoá React. Có tiền tố nguồn để BLE và EZ không đè nhau. */
  key: string;
  label: string;
  source: BlipSource;
  /** Góc trên mặt radar, độ (0-360). Tất định theo `key`. */
  angle: number;
  /** Bán kính chuẩn hoá 0-1 (0 = tâm). Tất định theo `key`. */
  radius: number;
  /** Chỉ có với source='ble' - cần cho pairing (uuid/productId/address/isCombo). */
  raw?: BleScanItem;
};

/** Tối đa số blip vẽ lên radar - hơn nữa thì rối và chồng icon. */
export const MAX_BLIPS = 8;

// Vùng bán kính hợp lệ: tránh tâm (chỗ icon 📡) và tránh sát mép (blip bị cắt).
const RADIUS_MIN = 0.38;
const RADIUS_MAX = 0.86;

/* eslint-disable no-bitwise -- FNV-1a là thuật toán trên bit; viết cách khác thì không còn là nó nữa. */
/** FNV-1a 32-bit. Cần hash TẤT ĐỊNH: cùng key → cùng chỗ, kể cả sau re-render/restart. */
function hashKey(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Vị trí blip trên radar, sinh từ `key`.
 * TẤT ĐỊNH có chủ đích: nếu random thì mỗi lần re-render (mỗi event scan mới) blip sẽ nhảy loạn
 * khắp mặt radar → user không chạm trúng. Đây là AC2.
 */
export function blipPosition(key: string): { angle: number; radius: number } {
  const h = hashKey(key);
  // Hai nửa của hash cho 2 đại lượng gần như độc lập nhau.
  const angle = h % 360;
  const spread = (h >>> 9) % 1000; // 0-999
  const radius = RADIUS_MIN + (spread / 999) * (RADIUS_MAX - RADIUS_MIN);
  return { angle, radius };
}
/* eslint-enable no-bitwise */

/** Khoá của 1 thiết bị BLE. uuid là thứ pairing thật sự dùng; mac/id chỉ là phương án chống rỗng. */
export function bleKey(item: Pick<BleScanItem, 'uuid' | 'mac' | 'id'>): string {
  return `ble:${item.uuid || item.mac || item.id || 'unknown'}`;
}

export function blipFromBleScan(item: BleScanItem): Blip {
  const key = bleKey(item);
  return {
    key,
    label: item.name || 'Walrus device',
    source: 'ble',
    ...blipPosition(key),
    raw: item,
  };
}

/**
 * Step EZ có phải "đã tìm thấy thiết bị" không?
 * ⚠️ Chuỗi step của Tuya CHƯA được document (docs/research/tuya-home-sdk-device-pairing.md dòng 530:
 * "cần log thực tế") - iOS đi qua `device_found`, Android trả nguyên văn `onStep()` (quan sát:
 * `device_find`). Nên khớp lỏng theo find/found, và loại nhánh lỗi TRƯỚC: `device_state_error`
 * cũng chứa "state" chứ không chứa find, nhưng `timeout/error/fail` thì phải chặn cứng vì chúng đi
 * chung kênh tiến trình này (bug cũ: UI tưởng timeout là tiến trình - xem m1-fix-wifi-pairing B3).
 */
export function isEzFindStep(step: string): boolean {
  const s = step.toLowerCase();
  if (s.includes('timeout') || s.includes('time_out') || s.includes('error') || s.includes('fail')) {
    return false;
  }
  return s.includes('find') || s.includes('found');
}

/**
 * Blip từ event tiến trình EZ. Trả null nếu step không phải "tìm thấy".
 * `devId` thường KHÔNG có (SDK không hứa gì ở đây) → gộp hết vào một blip vô danh, đúng hơn là
 * vẽ N blip trùng nhau cho cùng một thiết bị.
 */
export function blipFromEzStep(e: PairingProgress): Blip | null {
  if (!isEzFindStep(e.step)) return null;
  const id = e.devId || '';
  const key = `ez:${id || 'pending'}`;
  return {
    key,
    label: 'Device found (Wi-Fi)',
    source: 'ez',
    ...blipPosition(key),
  };
}

/**
 * Thêm/cập nhật blip vào danh sách.
 * - Dedupe theo `key` (scan BLE bắn LẶP LẠI cùng một thiết bị liên tục - không dedupe thì radar
 *   ngập blip trùng).
 * - Giữ NGUYÊN thứ tự first-seen: thiết bị mới xuống cuối, không xáo lại chỗ blip cũ (AC2).
 * - Chạm trần `cap` → bỏ qua thiết bị mới, giữ những cái đã hiện (đang cập nhật thì vẫn cho vào).
 */
export function upsertBlip(list: Blip[], blip: Blip, cap: number = MAX_BLIPS): Blip[] {
  const idx = list.findIndex((b) => b.key === blip.key);
  if (idx >= 0) {
    const next = list.slice();
    next[idx] = { ...blip, angle: list[idx].angle, radius: list[idx].radius };
    return next;
  }
  if (list.length >= cap) return list;
  return [...list, blip];
}

/** Blip chạm vào có pair được không? Chỉ BLE - xem ghi chú đầu file. */
export function isPairableBlip(blip: Blip): boolean {
  return blip.source === 'ble' && blip.raw != null;
}
