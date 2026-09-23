// Thông tin thiết bị cho màn Device settings, parse từ `rawJson` của `getDeviceSnapshot`.
//
// Hai nền tảng trả KHÁC field nhau (iOS: `timezoneId`, `pv`, `bv`, `isCloudOnline`; Android: `uiType`,
// `ownerId`, `sharedTime`, `devAttribute`) ⇒ chỉ lấy field chung và **bỏ hẳn dòng nào không có dữ liệu**,
// thà thiếu một dòng còn hơn hiện "undefined" cho người dùng.

export type DeviceInfoRow = { label: string; value: string };

export type DeviceInfo = {
  name: string;
  /** null = không đọc được (mock / native vắng / payload hỏng) → màn dùng trạng thái từ state app. */
  online: boolean | null;
  rows: DeviceInfoRow[];
};

export const EMPTY_DEVICE_INFO: DeviceInfo = { name: '', online: null, rows: [] };

const str = (v: unknown): string =>
  typeof v === 'string' ? v.trim() : typeof v === 'number' && !isNaN(v) ? String(v) : '';

/** `"d8c80c31d5ef"` → `"D8:C8:0C:31:D5:EF"`. Chuỗi đã có dấu `:` hoặc độ dài lạ → chỉ hoa hoá. */
export function formatMac(raw: unknown): string {
  const s = str(raw).replace(/[^0-9a-fA-F:]/g, '');
  if (!s || s.includes(':') || s.length !== 12) return s.toUpperCase();
  return (s.match(/.{2}/g) ?? []).join(':').toUpperCase();
}

export function parseDeviceInfo(rawJson: string): DeviceInfo {
  let o: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(rawJson || '{}');
    if (parsed && typeof parsed === 'object') o = parsed as Record<string, unknown>;
  } catch {
    return EMPTY_DEVICE_INFO; // payload hỏng: màn vẫn còn tên + trạng thái từ state
  }

  const online = typeof o.isOnline === 'boolean' ? o.isOnline : null;
  const rows: DeviceInfoRow[] = [];
  const push = (label: string, value: string) => {
    if (value) rows.push({ label, value });
  };

  if (online != null) push('Status', online ? 'Online' : 'Offline');
  // Chỉ có nghĩa khi đang online: LAN = điều khiển được cả khi mất internet.
  if (online) push('Connection', o.isLocalOnline === true ? 'Local network' : 'Cloud');
  push('Model', str(o.productId));
  push('Firmware', str(o.verSw));
  push('MAC address', formatMac(o.mac));
  push('Time zone', str(o.timezoneId));
  push('Device ID', str(o.devId));
  if (o.isShare === true) push('Sharing', 'Shared with you');

  return { name: str(o.name), online, rows };
}
