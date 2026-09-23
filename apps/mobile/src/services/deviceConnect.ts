// Đọc snapshot thiết bị có HÂM NÓNG CACHE + THỬ LẠI - tách khỏi `useAppState` để test được bằng jest
// (repo không có harness cho hook; mọi logic dễ sai phải nằm ở services/).
//
// Vì sao tồn tại (dev-workflow/m1-fix-device-connect-error/): `readDevice` → native `getDeviceSnapshot`
// → `[ThingSmartDevice deviceWithDeviceId:]` / `newDeviceInstance` chỉ đọc **cache local** của SDK.
// Ngay sau khi pair, Device List hiện bồn vừa pair từ state local trong lúc `getHomeDeviceList` (thứ nạp
// home data) còn đang bay ⇒ chạm vào bồn là native reject `no_device` ⇒ màn detail kẹt ở `error` vì
// `connectDevice` trước đây chỉ đọc ĐÚNG MỘT LẦN, không retry.
import { readDevice, type DeviceSnapshot } from './tuya';
import { warmHomeCache } from './home';
import { isRetryableTuyaError } from './tuyaError';

/**
 * Chờ bao lâu trước mỗi lần đọc lại. Số phần tử = số lần THỬ LẠI ⇒ tổng số lần đọc = length + 1.
 * 600ms/1500ms: đủ cho `getHomeDetail` về mà người dùng vẫn thấy pill `CONNECTING…` chứ không đứng hình.
 */
export const CONNECT_RETRY_DELAYS_MS = [600, 1500];

export type ConnectDeps = {
  read: (devId: string) => Promise<DeviceSnapshot>;
  warmHome: (homeId: number) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  isRetryable: (e: unknown) => boolean;
};

const DEFAULT_DEPS: ConnectDeps = {
  read: readDevice,
  warmHome: warmHomeCache,
  sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  isRetryable: isRetryableTuyaError,
};

/**
 * Đọc snapshot; lỗi TRANSIENT (`no_device` / `no_home` / `timeout` / mã số retryable) thì nạp home data
 * rồi đọc lại theo backoff. Lỗi KHÔNG transient (vd `ios_todo`, chưa đăng nhập) → throw ngay, không
 * chờ vô ích. Hết lượt → throw lỗi **của lần cuối** (không bọc lại) để UI hiện đúng nguyên nhân thật.
 *
 * @param homeId cần cho việc hâm nóng cache; không có (điều hướng bất thường) thì vẫn retry, chỉ bỏ warm.
 * @param deps   inject để test (mặc định: adapter thật).
 * @param delays inject để test (mặc định `CONNECT_RETRY_DELAYS_MS`).
 */
export async function readDeviceWithWarmup(
  devId: string,
  homeId?: number,
  deps?: Partial<ConnectDeps>,
  delays: number[] = CONNECT_RETRY_DELAYS_MS,
): Promise<DeviceSnapshot> {
  const d: ConnectDeps = { ...DEFAULT_DEPS, ...deps };
  for (let attempt = 0; ; attempt++) {
    try {
      return await d.read(devId);
    } catch (e) {
      if (attempt >= delays.length || !d.isRetryable(e)) throw e;
      // Warm TRƯỚC khi chờ: `getHomeDetail` chính là thứ đưa thiết bị vào cache SDK, còn `sleep` chỉ để
      // thiết bị/MQTT kịp lên. Warm nuốt lỗi bên trong nên không che được lỗi đọc thật.
      if (homeId) await d.warmHome(homeId);
      await d.sleep(delays[attempt]);
    }
  }
}
