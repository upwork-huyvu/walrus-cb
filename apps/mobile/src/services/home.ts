// Adapter Home cho app: dùng lib Tuya thật nếu native có mặt; nếu KHÔNG (Metro chưa build native) → mock
// (in-memory) để luồng UI clone chạy được trong dev. Cùng pattern require try/catch như services/tuya.ts.
//
// KHÔNG auto-create home ngầm: việc tạo home do màn Create Home gọi `createHome` tường minh (xem home-gate).
import { MOCK_DEVICES, MOCK_DEVICE_LIST } from '../config/mock';
import { logHomeDevices } from './deviceLog';

export type HomeInfo = {
  homeId: number;
  name: string;
  role: number; // 2=owner, 1=admin, 0=member
  admin: boolean;
};
export type HomeDevice = {
  devId: string;
  name: string;
  productId: string;
  isOnline: boolean;
  iconUrl: string;
};

let lib: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  lib = require('@jimmy-vu/react-native-turbo-tuya');
} catch {
  lib = null;
}
/** true khi native module Tuya có mặt (đã build native). Dev không build → false → dùng mock. */
export const homeAvailable: boolean = lib != null && lib.Tuya != null;

// --- Mock layer (chỉ khi native vắng) ---
// mockHomes bắt đầu RỖNG → dev thấy được màn Create Home; createHome push vào để list sau đó có home.
const mockHomes: HomeInfo[] = [];
// mockDevices có sẵn 1 thiết bị demo → device list + detail dùng được ngay trong dev.
const mockDevices: HomeDevice[] = [
  { devId: 'mock-dev-001', name: 'Walrus Ice Bath', productId: 'mock', isOnline: true, iconUrl: '' },
];
// Tombstone trong phiên cho bồn giả đã được remove. Nếu không lọc ở nguồn, mock cố định sẽ xuất hiện
// lại ngay lần refetch kế tiếp và che mất bug cache của luồng xoá thật.
const removedMockDeviceIds = new Set<string>();
// Tên bồn giả đã đổi trong phiên (devId → tên mới). Seed trong config/mock.ts là HẰNG SỐ nên không sửa
// tại chỗ; override ở đây để list/detail hiện tên mới y như thiết bị thật sau khi Tuya đổi tên xong.
const renamedMockDeviceNames = new Map<string, string>();

/** Áp tên đã đổi (nếu có) lên 1 bồn giả - dùng chung cho mọi nguồn list mock. */
function withMockName<T extends HomeDevice>(device: T): T {
  const renamed = renamedMockDeviceNames.get(device.devId);
  return renamed ? { ...device, name: renamed } : device;
}

function mapHome(h: any): HomeInfo {
  return {
    homeId: h.homeId,
    name: h.name ?? '',
    role: h.role ?? 0,
    admin: h.admin ?? false,
  };
}

/** Danh sách home của user. Native vắng → mock (rỗng cho tới khi createHome). */
export async function getHomeList(): Promise<HomeInfo[]> {
  if (!homeAvailable) return [...mockHomes];
  const list = await lib.Tuya.getHomeList();
  return Array.isArray(list) ? list.map(mapHome) : [];
}

/** Tạo home mới (tường minh từ màn Create Home). geoName/toạ độ optional cho ice-bath. */
export async function createHome(
  name: string,
  lon = 0,
  lat = 0,
  geoName = '',
  rooms: string[] = [],
): Promise<HomeInfo> {
  if (!homeAvailable) {
    const h: HomeInfo = { homeId: Date.now(), name, role: 2, admin: true };
    mockHomes.push(h);
    return h;
  }
  return mapHome(await lib.Tuya.createHome(name, lon, lat, geoName, rooms));
}

/** Chọn nhà "hiện tại" từ list: ưu tiên nhà Owner (role=2)/admin (pairing owner-only), fallback nhà đầu. */
export function pickCurrentHome(homes: HomeInfo[]): HomeInfo | null {
  if (!homes || homes.length === 0) return null;
  return homes.find((h) => h.admin || h.role === 2) ?? homes[0];
}

/**
 * Đảm bảo user có ít nhất 1 nhà (chuẩn Tuya SmartLife): nếu chưa có nhà nào → tạo mặc định **"My Home"**.
 * Trả về nhà hiện tại (owner-priority). Dùng ở home-gate sau login để vào thẳng device-list.
 */
export async function ensureDefaultHome(): Promise<HomeInfo> {
  const homes = await getHomeList();
  if (homes.length === 0) return createHome('My Home');
  // pickCurrentHome không null vì list không rỗng.
  return pickCurrentHome(homes) as HomeInfo;
}

/** Bồn giả → chỉ field HomeDevice (bỏ field trạng thái seed). */
function mockHomeDevices(): HomeDevice[] {
  return MOCK_DEVICE_LIST.filter((d) => !removedMockDeviceIds.has(d.devId)).map((d) =>
    withMockName({
      devId: d.devId,
      name: d.name,
      productId: d.productId,
      isOnline: d.isOnline,
      iconUrl: d.iconUrl,
    }),
  );
}

/** Xoá bồn giả khỏi nguồn list trong phiên (dùng để test trọn luồng remove mà không cần native). */
export function removeMockDevice(devId: string): void {
  if (devId) removedMockDeviceIds.add(devId);
}

/** Đổi tên bồn giả trong phiên (dùng để chạy trọn luồng rename khi native vắng / bồn giả). */
export function renameMockDevice(devId: string, name: string): void {
  if (devId && name) renamedMockDeviceNames.set(devId, name);
}

/**
 * Nạp home data để SDK có **cache thiết bị + MQTT** trước khi đọc/điều khiển thiết bị.
 *
 * Vì sao cần: `getDeviceSnapshot` (và mọi thao tác device) đi qua
 * `[ThingSmartDevice deviceWithDeviceId:]` / `newDeviceInstance` - hai hàm này **chỉ đọc cache local**,
 * không gọi mạng. Cache chưa nạp ⇒ native reject `no_device` (hay gặp NGAY SAU KHI PAIR: Device List
 * hiện bồn vừa pair từ state local trong lúc `getHomeDeviceList` còn đang bay).
 * Doc Tuya: "trước khi điều khiển device/group phải init home (getHomeDetail)" -
 * docs/research/tuya-home-sdk-device-control.md §Tiên quyết.
 *
 * Best-effort: native vắng / bridge cũ / lỗi mạng → **no-op, không throw** (caller vẫn thử đọc tiếp và
 * lỗi thật của lần đọc mới là thứ hiện cho người dùng).
 */
export async function warmHomeCache(homeId: number): Promise<void> {
  if (!homeAvailable || !homeId || typeof lib.Tuya.getHomeDetail !== 'function') return;
  try {
    await lib.Tuya.getHomeDetail(homeId);
  } catch {
    // nuốt có chủ đích: đây chỉ là bước hâm nóng cache, không phải thao tác người dùng yêu cầu.
  }
}

/**
 * Thiết bị trong 1 home → màn device list.
 * - Native vắng (Metro-only): mock list (nếu bật) / demo cũ.
 * - Native có: LẤY THIẾT BỊ THẬT từ SDK; nếu MOCK_DEVICES bật thì CHÈN THÊM bồn giả (không thay thế)
 *   để test UI - thiết bị thật vẫn hiển thị & điều khiển qua SDK. Native lỗi + mock bật → vẫn hiện mock.
 */
export async function getHomeDeviceList(homeId: number): Promise<HomeDevice[]> {
  if (!homeAvailable) {
    const fake = MOCK_DEVICES
      ? mockHomeDevices()
      : mockDevices.filter((d) => !removedMockDeviceIds.has(d.devId)).map(withMockName);
    logHomeDevices(homeId, fake); // native vắng → nói rõ đây là list GIẢ, không phải thiết bị thật
    return fake;
  }
  let real: HomeDevice[] = [];
  try {
    const list = await lib.Tuya.getHomeDeviceList(homeId);
    real = Array.isArray(list) ? list : [];
  } catch (e) {
    if (!MOCK_DEVICES) throw e; // prod: lỗi SDK phải nổi lên; dev mock: vẫn hiện bồn giả
  }
  const out = MOCK_DEVICES ? [...real, ...mockHomeDevices()] : real;
  logHomeDevices(homeId, out); // thấy ngay home có thiết bị nào (kể cả pair bằng Smart Life)
  return out;
}

export type HomeDeviceChange = {
  type: 'deviceAdded' | 'deviceRemoved';
  homeId: number;
  devId: string;
};

export type HomeSubscription = { remove(): void };

/**
 * Theo dõi thiết bị được thêm/xoá trong home (kể cả từ điện thoại/Smart Life khác).
 * Native vắng hoặc bridge cũ chưa có listener → no-op; Device List vẫn có refetch/refresh làm fallback.
 */
export function listenHomeDeviceChanges(homeId: number, onChange: (event: HomeDeviceChange) => void): HomeSubscription {
  if (!homeAvailable || typeof lib.onHomeChange !== 'function' || typeof lib.Tuya.startHomeStatusListener !== 'function') {
    return { remove() {} };
  }

  let eventSub: { remove?: () => void } | undefined;
  try {
    eventSub = lib.onHomeChange((raw: { type?: string; homeId?: number; devId?: string }) => {
      if (raw?.type !== 'deviceAdded' && raw?.type !== 'deviceRemoved') return;
      if (typeof raw.homeId === 'number' && raw.homeId !== homeId) return;
      if (!raw.devId) return;
      onChange({ type: raw.type, homeId, devId: raw.devId });
    });
  } catch {
    return { remove() {} };
  }

  // Promise.resolve().then giữ được cả lỗi throw đồng bộ lẫn reject bất đồng bộ của native.
  const started = Promise.resolve().then(() => lib.Tuya.startHomeStatusListener(homeId));
  // Luôn gắn rejection handler để native reject khi screen còn mounted không thành unhandled promise.
  void started.catch((e: unknown) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[home] startHomeStatusListener failed', e);
    }
  });

  return {
    remove() {
      eventSub?.remove?.();
      if (typeof lib.Tuya.stopHomeStatusListener === 'function') {
        // Chỉ stop sau khi start đã settle để tránh start muộn dựng lại listener sau khi screen unmount.
        void started.then(() => lib.Tuya.stopHomeStatusListener(homeId)).catch(() => {});
      }
    },
  };
}
