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
