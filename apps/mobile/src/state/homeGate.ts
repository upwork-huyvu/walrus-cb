import type { HomeInfo } from '../services/home';
import type { ScreenName } from '../navigation';

// Quyết định điều hướng sau khi login (home-gate), tách thuần để test được (AC1):
// chưa có nhà → màn tạo nhà TRƯỚC; có nhà → thẳng danh sách thiết bị.
export type HomeGateResult = { screen: ScreenName; homeId?: number };

export function decideAfterAuth(homes: HomeInfo[]): HomeGateResult {
  if (!homes || homes.length === 0) return { screen: 'create-home' };
  return { screen: 'device-list', homeId: homes[0].homeId };
}
