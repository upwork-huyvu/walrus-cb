// Cấu hình kết nối backend (NestJS). API_BASE_URL trỏ tới backend đã deploy (Vercel) hoặc dev local.
// PUSH_API_KEY = key dùng chung bảo vệ /push/tokens (MVP). LƯU Ý: key nằm trong bundle app → public-ish;
// đây là đánh đổi MVP đã chốt (rủi ro spoof uid). Siết sau: verify phiên Tuya / Supabase JWT.
// Để trống PUSH_API_KEY = đăng ký token sẽ bị 401 tới khi điền đúng key khớp backend.
// DEV: backend chạy LOCAL trên Mac (port 3006). Điện thoại thật phải cùng mạng (LAN/hotspot) với Mac.
// 172.20.10.2 = IP hotspot hiện tại của Mac - ĐỔI lại khi mạng/hotspot đổi (ipconfig getifaddr en0).
// Backend chưa deploy public; khi deploy Vercel xong thì đổi về https URL thật.
export const API_BASE_URL = 'http://172.20.10.2:3006';
export const PUSH_API_KEY = '7472840defcf041ec08a51fff433dfeb2e1aba0fcdd66654102f158934884fa5';
