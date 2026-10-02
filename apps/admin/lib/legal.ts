// Thông tin pháp lý dùng chung cho các trang PUBLIC (/privacy, /terms, /delete-account, /support).
// Đây là URL điền vào App Store Connect (Privacy Policy URL, Support URL) và Google Play Console
// (Privacy policy, Delete account URL) - không cần đăng nhập, proxy.ts không chặn.
//
// Pháp nhân / địa chỉ / số công ty lấy từ privacy policy + terms trên walruswellness.com (2026-10-02).
// Đổi nội dung chính sách → cập nhật LEGAL_UPDATED để người đọc thấy ngày sửa mới nhất.

export const APP_NAME = 'Walrus';
export const COMPANY = 'Walrus Wellness Limited';
export const COMPANY_NUMBER = '16403960';
export const COMPANY_ADDRESS = [
  'Unit 7 & 8 Bolingbroke Court',
  'Bolingbroke Road',
  'Louth LN11 0ZW',
  'United Kingdom',
];
export const SUPPORT_EMAIL = 'support@walruswellness.com';
export const WEBSITE_URL = 'https://www.walruswellness.com';
export const WEBSITE_TERMS_URL = 'https://www.walruswellness.com/terms-and-condition';

/** Ngày sửa nội dung gần nhất (hiện trên đầu mỗi trang). */
export const LEGAL_UPDATED = '2 October 2026';

/** Tuya cho 7 ngày ân hạn sau khi user yêu cầu xoá tài khoản (đăng nhập lại = huỷ yêu cầu). */
export const DELETION_GRACE_DAYS = 7;

export const LEGAL_PAGES = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Use' },
  { href: '/delete-account', label: 'Delete account' },
  { href: '/support', label: 'Support' },
] as const;
