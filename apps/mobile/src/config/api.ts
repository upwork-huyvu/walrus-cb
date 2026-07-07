// Cấu hình kết nối backend (NestJS), đọc từ .env qua react-native-dotenv (module '@env').
// Đổi giá trị trong apps/mobile/.env (KHÔNG sửa file này), rồi restart Metro: npm start -- --reset-cache.
// Mẫu: .env.example. Xem babel.config.js cho cấu hình plugin.
//
// - API_BASE_URL: backend đã deploy (Vercel https) hoặc dev local (http://<IP-Mac>:3006).
//   DEV: điện thoại thật phải cùng mạng (LAN/hotspot) với Mac.
// - PUSH_API_KEY: key dùng chung bảo vệ /push/tokens (MVP), phải khớp backend.
//   Trống → đăng ký token bị 401 tới khi điền đúng.
//
// LƯU Ý BẢO MẬT: react-native-dotenv nhúng giá trị vào JS bundle lúc build → vẫn public-ish
// (rủi ro spoof uid, đánh đổi MVP đã chốt). .env chỉ giúp tách config khỏi source + đổi theo máy/env.
// Siết sau: verify phiên Tuya / Supabase JWT ở backend.
import { API_BASE_URL as ENV_API_BASE_URL, PUSH_API_KEY as ENV_PUSH_API_KEY } from '@env';

export const API_BASE_URL = ENV_API_BASE_URL ?? '';
export const PUSH_API_KEY = ENV_PUSH_API_KEY ?? '';
