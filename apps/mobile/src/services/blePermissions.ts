// Permission gate cho BLE scan - chặn cái bug "radar quay 120s rồi báo không thấy gì".
//
// Vì sao file này tồn tại: AndroidManifest.xml:18-19 CÓ KHAI `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT`,
// nhưng trước đây KHÔNG chỗ nào trong app xin chúng lúc runtime. Với `targetSdkVersion=36`,
// Android 12+ (API 31+) coi 2 quyền này là runtime permission ⇒ `startLeScan` KHÔNG crash, KHÔNG
// báo lỗi, chỉ IM LẶNG trả 0 kết quả ⇒ luồng BLE-discovery-first coi như chết mà không ai biết.
//
// Nguồn: docs/research/tuya-home-sdk-device-pairing.md (mục BLE unified) liệt kê đúng bộ quyền
// SDK cần: BLUETOOTH, BLUETOOTH_ADMIN, BLUETOOTH_SCAN, BLUETOOTH_CONNECT, ACCESS_FINE_LOCATION.
// BLUETOOTH/BLUETOOTH_ADMIN là install-time (manifest khai `maxSdkVersion=30`) → không xin ở đây.
//
// ⚠️ Vì sao Android 12+ vẫn phải xin ACCESS_FINE_LOCATION: manifest khai `BLUETOOTH_SCAN` KHÔNG có
// `usesPermissionFlags="neverForLocation"`, nên hệ thống vẫn coi scan là suy ra được vị trí ⇒ thiếu
// location thì scan trả rỗng. Sửa manifest = phải rebuild native ⇒ ngoài scope (xem plan mục 1).
import { PermissionsAndroid, Platform } from 'react-native';
import { logPairing } from './pairingLog';

export type BlePermissionReason =
  /** User bấm Deny lần này - hỏi lại được. */
  | 'denied'
  /** User chọn "Don't ask again" / bị policy chặn - chỉ mở Settings mới gỡ được. */
  | 'blocked'
  /** Nền tảng không phải iOS/Android (vd test env) - không kết luận bừa. */
  | 'unsupported';

export type BlePermissionResult =
  | { ok: true }
  | { ok: false; reason: BlePermissionReason; message: string };

export type BlePermissionInput = {
  /** cho phép test bơm platform thay vì phụ thuộc RN runtime (cùng pattern pairingPreflight.ts) */
  platform?: 'ios' | 'android';
  /** Android API level. Test bơm vào thay vì phụ thuộc `Platform.Version`. */
  apiLevel?: number;
};

/** Android 12 (API 31) - mốc BLUETOOTH_SCAN/BLUETOOTH_CONNECT thành runtime permission. */
const ANDROID_12 = 31;

/**
 * Bộ quyền cần xin theo API level.
 * - API 31+: BLUETOOTH_SCAN + BLUETOOTH_CONNECT + ACCESS_FINE_LOCATION (xem ghi chú neverForLocation ở đầu file).
 * - API ≤ 30: BLUETOOTH/BLUETOOTH_ADMIN là install-time → chỉ còn location là runtime.
 */
export function blePermissionsFor(apiLevel: number): string[] {
  if (apiLevel >= ANDROID_12) {
    return [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ];
  }
  return [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
}

/**
 * Xin đủ quyền để quét BLE. Gọi TRƯỚC mọi `startBleScan()`.
 *
 * iOS: no-op `{ok:true}` - hệ thống tự bật prompt Bluetooth lúc SDK quét lần đầu
 * (Info.plist đã có `NSBluetoothAlwaysUsageDescription`; xem docs/research/tuya-auto-scan-discovery.md).
 */
export async function ensureBlePermissions(input: BlePermissionInput = {}): Promise<BlePermissionResult> {
  const platform = input.platform ?? (Platform.OS as 'ios' | 'android');

  if (platform === 'ios') {
    logPairing('ble.permission', { platform, ok: true, note: 'ios: hệ thống tự prompt' });
    return { ok: true };
  }

  if (platform !== 'android') {
    return {
      ok: false,
      reason: 'unsupported',
      message: 'Bluetooth scanning is not available on this platform.',
    };
  }

  const apiLevel = input.apiLevel ?? Number(Platform.Version);
  const wanted = blePermissionsFor(apiLevel);

  let statuses: Record<string, string>;
  try {
    statuses = await PermissionsAndroid.requestMultiple(wanted as any);
  } catch (e: any) {
    logPairing('ble.permission', { platform, apiLevel, ok: false, error: String(e?.message ?? e) });
    return {
      ok: false,
      reason: 'denied',
      message: 'Could not request Bluetooth permissions. Try again.',
    };
  }

  const missing = wanted.filter((p) => statuses[p] !== PermissionsAndroid.RESULTS.GRANTED);
  if (missing.length === 0) {
    logPairing('ble.permission', { platform, apiLevel, ok: true, asked: wanted.length });
    return { ok: true };
  }

  // "Don't ask again" ở BẤT KỲ quyền nào → hỏi lại vô ích, phải đẩy user sang Settings.
  const blocked = missing.some((p) => statuses[p] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);
  logPairing('ble.permission', {
    platform,
    apiLevel,
    ok: false,
    reason: blocked ? 'blocked' : 'denied',
    missing,
  });

  // Message nói ĐÚNG cái user phải làm - đây là điểm khác biệt với bug cũ (quay mù rồi báo
  // "No Walrus devices found", khiến ai cũng tưởng thiết bị hỏng thay vì thiếu quyền).
  const needsLocation = missing.includes(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  const what = needsLocation ? 'Bluetooth and Location' : 'Bluetooth';
  return {
    ok: false,
    reason: blocked ? 'blocked' : 'denied',
    message: blocked
      ? `Walrus needs ${what} access to find your device. Open Settings → Permissions and allow them, then scan again.`
      : `Walrus needs ${what} access to find your device nearby. It only looks for Walrus devices - it never tracks your location.`,
  };
}
