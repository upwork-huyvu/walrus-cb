# Kế hoạch: Scaffold monorepo + RN CLI app + init Tuya SDK

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-scaffold-and-tuya-init`
- **Milestone:** M1 - Nền tảng & Kết nối lõi ($250)
- **Phần liên quan:** mobile (chủ yếu) + thiết lập monorepo
- **Ngày tạo:** 2026-06-28
- **Cập nhật lần cuối:** 2026-06-28

## 1. Mục tiêu & phạm vi
Dựng nền dự án: monorepo có chỗ cho mobile/backend/admin; khởi tạo app **React
Native CLI** (KHÔNG Expo); tích hợp và **init Tuya Smart Life App SDK đúng Data
Center**; chạy được app rỗng mà SDK init thành công. Đây là tiền đề cho login,
pairing, control.

**Ngoài phạm vi (không làm trong feature này):**
- Login Tuya, tạo Home → `m1-tuya-login-home`.
- Pairing thiết bị → `m1-wifi-pairing`, `m1-ble-pairing`.
- Backend/admin (chỉ tạo thư mục trống, chưa code).

## 2. Bối cảnh & ràng buộc
- UI hiện có ở `replit_generate/` là **Expo Snack** (expo-status-bar, expo-font,
  @expo/vector-icons...) → chỉ dùng làm tham chiếu thiết kế, phải migrate sang RN
  CLI, bỏ toàn bộ `expo-*`.
- **Tuya Data Center của SDK PHẢI trùng Data Center của Cloud Project** (dự án
  hướng EU) - sai là không tìm thấy thiết bị về sau.
- **AppSecret** Tuya không được nằm trong JS/repo (xem checklist security-secrets).
- **Link nghiên cứu liên quan:** _chưa có_ → chạy `/tuya-research SDK init & Data Center & integration` TRƯỚC khi code B4–B5.

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
- [ ] AC1: Monorepo có cấu trúc `apps/mobile|backend|admin` (backend/admin có thể là placeholder), `.gitignore` chuẩn, app mobile build được.
- [ ] AC2: App RN CLI chạy trên Android (và iOS nếu có máy) ra màn hình rỗng/placeholder, KHÔNG còn phụ thuộc `expo-*`.
- [ ] AC3: Tuya SDK init thành công, log region/Data Center đúng cấu hình; AppKey từ env/native config, AppSecret KHÔNG trong repo.
- [ ] AC4: `grep` repo không lộ secret; `.env.example` có placeholder.

## 4. Các bước thực hiện
1. **B1 - Khởi tạo monorepo + git**
   - Tạo `apps/mobile`, `apps/backend` (placeholder), `apps/admin` (placeholder); `.gitignore` gốc; `git init`.
   - Kiểm thử: cây thư mục đúng; `git status` sạch hợp lý.
2. **B2 - Init RN CLI app**
   - `npx @react-native-community/cli init` trong `apps/mobile` (bản RN ổn định, Hermes on).
   - Kiểm thử: `npm run android` build ra app rỗng.
3. **B3 - Port design tokens từ replit UI**
   - Lấy màu/spacing/typography/components tham chiếu từ `replit_generate/components`, bỏ `expo-*`.
   - Kiểm thử: 1 màn hình placeholder render đúng theme.
4. **B4 - Thêm native deps Tuya SDK**
   - Android: gradle deps + keep rules (R8); iOS: Pod. (Theo `/tuya-research`.)
   - Kiểm thử: build cả 2 nền tảng không lỗi link.
5. **B5 - Init SDK đúng Data Center + AppKey từ config**
   - Module bridge khởi tạo SDK sớm; region = EU (hoặc theo Cloud Project); AppKey từ `react-native-config`/native; AppSecret native-only, git-ignored.
   - Kiểm thử: log init success + region; smoke test gọi 1 API SDK không cần thiết bị (vd lấy trạng thái init/user nil).
6. **B6 - Quét secret + .env.example**
   - `.gitignore` phủ env/keystore/google-services/plist; tạo `.env.example`.
   - Kiểm thử: grep secret sạch.

## 5. Rủi ro & câu hỏi mở
- ⚠️ Phiên bản RN ↔ Tuya SDK có thể kén version → chốt version theo doc Tuya (research B4).
- ⚠️ New Architecture (Fabric/TurboModules) có thể ảnh hưởng bridge Tuya → xác minh ở research.
- ❓ Cần user cung cấp: AppKey/AppSecret Tuya, Data Center của Cloud Project, xác nhận account là Owner của Home.
