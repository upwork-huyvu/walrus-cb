// Router tối giản (port từ replit) — không dùng react-navigation.
// Khoá screen giữ NGUYÊN chuỗi như replit (kebab cho onboarding).
export type ScreenName =
  | 'splash'
  | 'onboard-welcome'
  | 'onboard-email'
  | 'onboard-name'
  | 'onboard-why'
  | 'onboard-experience'
  | 'onboard-device'
  | 'auth'
  | 'home-gate' // transient: sau login → kiểm home list → create-home | device-list
  | 'create-home' // chưa có nhà → tạo nhà trước (chuẩn Tuya SmartLife)
  | 'device-list' // landing sau login: danh sách thiết bị của home
  | 'device-detail' // tap 1 thiết bị → điều khiển (DashboardScreen) + ritual
  | 'pairing'
  | 'home'
  | 'dashboard'
  | 'breathwork'
  | 'session'
  | 'completion'
  | 'progress';

export type Navigate = (
  screen: ScreenName,
  params?: Record<string, unknown>,
) => void;
