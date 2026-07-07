// Router tối giản (port từ replit) - không dùng react-navigation.
// Khoá screen giữ NGUYÊN chuỗi như replit (kebab cho onboarding).
export type ScreenName =
  | 'splash'
  | 'intro' // 4 slide video giới thiệu - hiện SAU lần đăng nhập đầu tiên (một lần, cờ AsyncStorage)
  | 'onboard-welcome'
  | 'onboard-email'
  | 'onboard-name'
  | 'onboard-why'
  | 'onboard-experience'
  | 'onboard-device'
  | 'auth'
  | 'home-gate' // transient: sau login → kiểm home list → create-home | device-list
  | 'create-home' // chưa có nhà → tạo nhà trước (chuẩn Tuya SmartLife)
  | 'device-list' // TAB Device (landing sau login): danh sách thiết bị của home
  | 'device-detail' // tap 1 thiết bị → điều khiển (DashboardScreen) + ritual
  | 'reminder' // TAB Reminder: filter reminder (90 ngày, local)
  | 'shop' // TAB Shop: filters/accessories/parts → walruswellness.com/shop
  | 'help' // TAB Help: FAQ + email support
  | 'me' // TAB Account: profile + thông báo + cấu hình thông tin + quản lý nhà
  | 'home-management' // Account → quản lý nhà (list + tạo + chọn nhà)
  | 'notifications' // Account → thông báo
  | 'profile' // Account → cấu hình thông tin + đăng xuất
  | 'change-password' // Profile → đổi password (Tuya reset qua OTP email)
  | 'pairing'
  | 'home'
  | 'dashboard'
  | 'session'
  | 'completion'
  | 'progress'; // TAB Tracking: record ritual lũy kế + tổng hợp theo ngày (hôm nay + 7 ngày)

export type Navigate = (
  screen: ScreenName,
  params?: Record<string, unknown>,
) => void;
