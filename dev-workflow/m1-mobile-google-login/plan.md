# Kế hoạch: Đăng nhập bằng Google (wire idToken thật) - mobile

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-mobile-google-login`
- **Milestone:** M1·B2 (mobile) - hoàn thiện phần B4 "scaffold" còn nợ của `m1-mobile-auth`
- **Phần liên quan:** mobile (RN CLI) + phối hợp console (client)
- **Ngày tạo:** 2026-07-01
- **Cập nhật lần cuối:** 2026-07-01

## 1. Mục tiêu & phạm vi
Nút **"Continue with Google"** hiện gọi `thirdLogin('', 'gg')` với **token rỗng** → Tuya cloud
trả `REMOTE_API_RUN_UNKNOW_FAILED`. Feature này **wire Google Sign-In thật**: lấy `idToken` từ
`@react-native-google-signin` rồi truyền vào `thirdLogin(idToken, 'gg')`, để user đăng nhập được
bằng Google (Tuya account = định danh M1, phải là **Owner** của Home). Bao gồm: install + link
native package, viết helper lấy idToken, nối vào `AuthScreen`, cắm URL scheme iOS + tài liệu
việc console cho client.

**Ngoài phạm vi (không làm trong feature này):**
- **Apple sign-in** (`doThird('ap')`) - vẫn để scaffold, tách feature riêng.
- Đồng bộ Supabase ↔ Tuya (M1 chốt định danh = Tuya account).
- Tạo OAuth client trên Google Cloud + dán Client ID vào Tuya console - **việc của client**
  (dev chỉ điền client ID vào `config/google.ts` + hướng dẫn); là điều kiện để chạy device test.

## 2. Bối cảnh & ràng buộc
- **RN CLI (không Expo)** → package cần **autolink + `pod install`** (iOS), không dùng Expo plugin.
- `@react-native-google-signin/google-signin@^16.1.2` **đã có trong `package.json`** nhưng
  **CHƯA install** (`node_modules` trống) và **chưa link native** - bước đầu tiên phải làm.
- **`webClientId` bắt buộc type WEB**, nếu không `idToken = null` (cạm bẫy hay bị bỏ sót).
- **idToken audience = Web Client ID**, dùng **CHUNG** Android + iOS → dán cùng 1 Web Client ID
  vào Tuya console cho **cả** Android lẫn iOS.
- OAuth Client ID **KHÔNG bí mật** (định danh client phía app) → an toàn để trong bundle
  (`config/google.ts` đã ghi rõ). Không vi phạm ràng buộc secrets server-only.
- **SHA-1 keystore** (debug + release) phải khớp giữa **Google Cloud** ↔ **Tuya console**, nếu
  không → `DEVELOPER_ERROR`. Package Android = `com.walrus.wellnesscb`; Bundle iOS = `com.walrus.wellness`.
- Tuya **Data Center = Cloud Project region (EU)**; Tuya account sau login phải là **Owner** Home.
- **Link nghiên cứu:** [tuya-google-login.md](../../docs/research/tuya-google-login.md) (đầy đủ luồng + checklist).

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
> Kiểm chứng được. Đây là cái `/test` sẽ check.
- [ ] AC1: `@react-native-google-signin` **install + autolink OK** - `tsc` resolve type,
      `npx react-native config` liệt kê module, iOS có pod (hoặc build Android thấy dependency).
- [ ] AC2: Có helper `services/googleAuth.ts` - `configureGoogle()` (gọi 1 lần) + `signInGoogle()`
      trả `idToken: string`; đọc client ID từ `config/google.ts`.
- [ ] AC3: `doThird('gg')` trong `AuthScreen` gọi `signInGoogle()` → `thirdLogin(idToken,'gg')`
      (KHÔNG còn `''`). Đường mock/dev (chưa build native) vẫn chạy được (không crash Metro).
- [ ] AC4: Khi client ID **để trống** → báo lỗi rõ ràng ("Chưa cấu hình Google Client ID …"),
      không crash trần; `tsc`/`jest`/`eslint` sạch với config trống.
- [ ] AC5: iOS `Info.plist` có **URL scheme = reversed iOS client id** (placeholder + hướng dẫn);
      tài liệu setup console cho client đầy đủ (Google Cloud 3 client + Tuya 2 tab + SHA-1).
- [ ] AC6 *(device - deferred)*: Trên build thật + client ID thật + console đã cấu hình → bấm
      Google → chọn account → vào **Home**; Tuya account là **Owner** của Home (pairing chạy).

## 4. Các bước thực hiện
> Mỗi bước nhỏ, làm được trong 1 lượt dev + test. Đánh số để `progress.md` tham chiếu.

1. **B1 - Install + link native package**
   - Việc: chạy install trong `apps/mobile` (npm/yarn tùy lock) để `node_modules` có
     google-signin; xác nhận autolink (Android `settings.gradle`), `pod install` iOS (khi có Mac).
     Kiểm tương thích version 16 với **RN 0.85 / new arch** - ghi lại nếu lệch.
   - File đụng: `apps/mobile/package.json` (đã có dep), `package-lock.json`/`yarn.lock`,
     `ios/Podfile.lock` (khi pod). Không code.
   - Kiểm thử: `npx react-native config` thấy module · `tsc` resolve type · (build Android khi có).

2. **B2 - Helper lấy idToken (`services/googleAuth.ts`)**
   - Việc: viết `configureGoogle()` (`GoogleSignin.configure({ webClientId, iosClientId, offlineAccess:true })`)
     và `signInGoogle(): Promise<string>` (`signIn()` → `idToken`). Guard: client ID rỗng → throw lỗi rõ;
     `hasPlayServices()` (Android). Pattern `require` try/catch + cờ `googleAvailable` như `services/auth.ts`.
   - File đụng: **mới** `apps/mobile/src/services/googleAuth.ts`; đọc `src/config/google.ts`;
     `App.tsx` (gọi `configureGoogle()` 1 lần, cạnh `initSdk()`).
   - Kiểm thử: `tsc` · `jest` mock (rỗng→throw, có idToken→trả chuỗi).

3. **B3 - Nối vào `AuthScreen.doThird('gg')`**
   - Việc: `doThird('gg')` → `signInGoogle()` → `thirdLogin(idToken,'gg')` thay cho `''`.
     Giữ `'ap'` scaffold (comment rõ). Xử lý mock: native chưa build → giữ hành vi mock hiện tại.
   - File đụng: `apps/mobile/src/screens/AuthScreen.tsx` (`doThird`).
   - Kiểm thử: `tsc` · `jest`/RTL luồng bấm Google → gọi thirdLogin với token khác rỗng.

4. **B4 - Cấu hình native (Android + iOS) + tài liệu console**
   - Việc: **iOS** - thêm URL scheme (reversed iOS client id) vào `Info.plist` (placeholder từ
     `config/google.ts` / `secrets.xcconfig`). **Android** - chốt hướng: Google Sign-In thuần
     (webClientId qua `configure`) **không bắt buộc Firebase/`google-services.json`**, chỉ cần SHA-1
     đăng ký ở Android OAuth client; ghi rõ trong doc. Viết mục "Setup Google login" (việc client).
   - File đụng: `apps/mobile/ios/CoolBathMobile/Info.plist`, `apps/mobile/android/SIGNING.md`
     (hoặc doc setup mới), `docs/research/tuya-google-login.md` (link tới).
   - Kiểm thử: đọc lại file (URL scheme đúng dạng) · build (deferred device).

5. **B5 - E2E thật (deferred - chờ client + build)**
   - Việc: client tạo 3 OAuth client (Web/Android+SHA-1/iOS) + dán Web Client ID vào Tuya console
     (Android **và** iOS) + đảm bảo SHA-1 khớp; dev điền `config/google.ts`; build → chạy checklist AC6.
   - Kiểm thử: **checklist thiết bị** trong `progress.md`.

## 5. Rủi ro & câu hỏi mở
- ⚠️ **Console là việc của client** (Google Cloud + Tuya) → AC6 device **BLOCKED** cho tới khi
  client xong. Giảm thiểu: B1–B4 code + verify được đầy đủ bằng mock/typecheck; tách AC6 ra riêng.
- ⚠️ **`webClientId` sai type (không phải WEB)** → `idToken = null`, lỗi âm thầm. Giảm thiểu:
  helper check rỗng + doc nhấn mạnh "type WEB"; log audience khi debug.
- ⚠️ **SHA-1 không khớp** Google ↔ Tuya → `DEVELOPER_ERROR`. Giảm thiểu: doc liệt kê SHA-1 debug
  ([tuya-google-login.md](../../docs/research/tuya-google-login.md)) + release từ `walrus-release.keystore`.
- ⚠️ **google-signin v16 × RN 0.85 (new arch/TurboModule)** có thể lệch peer/API. Giảm thiểu:
  verify ngay ở B1; nếu vỡ → `/fix-plan` (hạ version / patch).
- ❓ Android có cần `google-services.json` (Firebase) không? Đề xuất **KHÔNG** (Google Sign-In thuần
  đủ) - chốt ở B4; nếu client muốn Firebase (cho FCM M3) thì thêm plugin sau.
- ❓ Apple sign-in làm luôn hay tách? Đề xuất **tách** - giữ scope feature này chỉ Google.
