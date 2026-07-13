// Cấu hình mock thiết bị. Cờ bật/tắt đọc từ .env (MOCK_DEVICES) qua react-native-dotenv,
// xem babel.config.js. Đổi giá trị ở apps/mobile/.env rồi restart Metro --reset-cache.
//
// MOCK_DEVICES là LỚP PHỦ CHỈ ĐỂ TEST UI - KHÔNG thay thế/tắt SDK Tuya:
//   - true  → SDK vẫn init + login/home/pairing + thiết bị THẬT chạy bình thường qua SDK;
//             chỉ CHÈN THÊM các bồn giả (MOCK_DEVICE_LIST) vào device list và mock riêng
//             phần điều khiển/realtime CỦA CHÚNG (bồn thật vẫn điều khiển qua SDK).
//   - false → không có bồn giả; chỉ fallback mock khi native vắng (chạy Metro-only).
// Env trả về string; thiếu key / khác 'true' → tắt (default an toàn cho prod).
import { MOCK_DEVICES as ENV_MOCK_DEVICES } from '@env';

export const MOCK_DEVICES = String(ENV_MOCK_DEVICES).trim().toLowerCase() === 'true';

// Seed 1 bồn giả: field HomeDevice (devId/name/productId/isOnline/iconUrl) + state ban đầu cho
// mockDevice.ts (mỗi bồn có nhiệt độ / công tắc riêng → mở bồn nào thấy state bồn đó).
export type MockDeviceSeed = {
  devId: string;
  name: string;
  productId: string;
  isOnline: boolean;
  iconUrl: string;
  currentTemp: number;
  targetTemp: number;
  lightOn: boolean;
  purifyOn: boolean;
  freezeOn: boolean;
};

/** Danh sách bồn giả hiển thị ở Device List (thêm/bớt tuỳ ý để test nhiều thiết bị). */
export const MOCK_DEVICE_LIST: MockDeviceSeed[] = [
  {
    devId: 'mock-walrus-pro-2',
    name: 'Walrus Pro 2',
    productId: 'mock',
    isOnline: true,
    iconUrl: '',
    currentTemp: 12,
    targetTemp: 6,
    lightOn: false,
    purifyOn: false,
    freezeOn: true,
  },
  {
    devId: 'mock-walrus-mini',
    name: 'Walrus Mini',
    productId: 'mock',
    isOnline: true,
    iconUrl: '',
    currentTemp: 8,
    targetTemp: 4,
    lightOn: true,
    purifyOn: true,
    freezeOn: true,
  },
  {
    devId: 'mock-walrus-home',
    name: 'Walrus Home',
    productId: 'mock',
    isOnline: false,
    iconUrl: '',
    currentTemp: 19,
    targetTemp: 10,
    lightOn: false,
    purifyOn: false,
    freezeOn: false,
  },
];

/**
 * devId này có phải bồn GIẢ không → chỉ những id trong MOCK_DEVICE_LIST (và chỉ khi MOCK_DEVICES bật)
 * mới đi qua mockDevice. Thiết bị THẬT (id Tuya) → false → điều khiển qua SDK.
 */
export function isMockDevId(devId?: string): boolean {
  return MOCK_DEVICES && !!devId && MOCK_DEVICE_LIST.some((d) => d.devId === devId);
}
