// Cấu hình kết nối backend (NestJS). API_BASE_URL trỏ tới backend đã deploy (Vercel) hoặc dev local.
// PUSH_API_KEY = key dùng chung bảo vệ /push/tokens (MVP). LƯU Ý: key nằm trong bundle app → public-ish;
// đây là đánh đổi MVP đã chốt (rủi ro spoof uid). Siết sau: verify phiên Tuya / Supabase JWT.
// Để trống PUSH_API_KEY = đăng ký token sẽ bị 401 tới khi điền đúng key khớp backend.
export const API_BASE_URL = 'https://walrus-cb-backend.vercel.app';
export const PUSH_API_KEY = '';
