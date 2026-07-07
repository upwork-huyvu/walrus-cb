// Adapter Home cho app: dùng lib Tuya thật nếu native có mặt; nếu KHÔNG (Metro chưa build native) → mock
// (in-memory) để luồng UI clone chạy được trong dev. Cùng pattern require try/catch như services/tuya.ts.
//
// KHÔNG auto-create home ngầm: việc tạo home do màn Create Home gọi `createHome` tường minh (xem home-gate).
import { MOCK_DEVICES, MOCK_DEVICE_LIST } from '../config/mock';

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
  return MOCK_DEVICE_LIST.map((d) => ({
    devId: d.devId,
    name: d.name,
    productId: d.productId,
    isOnline: d.isOnline,
    iconUrl: d.iconUrl,
  }));
}

/**
 * Thiết bị trong 1 home → màn device list.
 * - Native vắng (Metro-only): mock list (nếu bật) / demo cũ.
 * - Native có: LẤY THIẾT BỊ THẬT từ SDK; nếu MOCK_DEVICES bật thì CHÈN THÊM bồn giả (không thay thế)
 *   để test UI - thiết bị thật vẫn hiển thị & điều khiển qua SDK. Native lỗi + mock bật → vẫn hiện mock.
 */
export async function getHomeDeviceList(homeId: number): Promise<HomeDevice[]> {
  if (!homeAvailable) return MOCK_DEVICES ? mockHomeDevices() : [...mockDevices];
  let real: HomeDevice[] = [];
  try {
    const list = await lib.Tuya.getHomeDeviceList(homeId);
    real = Array.isArray(list) ? list : [];
  } catch (e) {
    if (!MOCK_DEVICES) throw e; // prod: lỗi SDK phải nổi lên; dev mock: vẫn hiện bồn giả
  }
  return MOCK_DEVICES ? [...real, ...mockHomeDevices()] : real;
}
