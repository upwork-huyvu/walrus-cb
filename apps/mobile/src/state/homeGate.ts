import type { HomeInfo } from '../services/home';
import type { ScreenName } from '../navigation';

// Quyết định điều hướng sau khi login (home-gate), tách thuần để test được (AC1):
// chưa có nhà → màn tạo nhà TRƯỚC; có nhà → thẳng danh sách thiết bị.
export type HomeGateResult = { screen: ScreenName; homeId?: number };

export function decideAfterAuth(homes: HomeInfo[]): HomeGateResult {
  if (!homes || homes.length === 0) return { screen: 'create-home' };
  // Ưu tiên nhà mà user là Owner (role=2) / admin - pairing là thao tác owner-only (ràng buộc Tuya).
  // Nhà chia sẻ (member) không pair được → tránh chọn nhầm. Không có nhà owner → dùng nhà đầu (fallback).
  const owned = homes.find((h) => h.admin || h.role === 2);
  return { screen: 'device-list', homeId: (owned ?? homes[0]).homeId };
}
