# Kế hoạch: Đăng nhập bằng Apple (Sign in with Apple) — mobile iOS

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-mobile-apple-login`
- **Milestone:** M1·B2 (mobile) — song song `m1-mobile-google-login`, để test cả 2 cùng lúc
- **Phần liên quan:** mobile (RN CLI) + **lib native iOS** (`packages/tuya-react-native`) + console Apple
- **Ngày tạo:** 2026-07-02
- **Cập nhật lần cuối:** 2026-07-02

## 1. Mục tiêu & phạm vi
Hoàn thiện nút **"Continue with Apple"** (hiện scaffold `thirdLogin('', 'ap')` token rỗng): lấy
**Apple identity token** từ native Sign in with Apple → truyền vào Tuya `thirdLogin(token, 'ap')`
→ đăng nhập (Tuya account = định danh M1, phải là **Owner** Home). Trọng tâm **iOS** (Apple Sign In
bản chất là tính năng iOS; App Store guideline **4.8**: đã có Google thì iOS **bắt buộc** có Apple).

**⚠️ Prerequisite cứng:** `thirdLogin` phía **iOS native đang là TODO stub**
([TuyaAuth.mm:101-106](../../packages/tuya-react-native/ios/Auth/TuyaAuth.mm)) → **cả Google lẫn Apple
trên iOS đều CHƯA chạy** ở tầng native. Feature này phải **implement iOS `thirdLogin`** (mirror
Android pass-through) — việc này **cũng unblock Google iOS**.

**Ngoài phạm vi:**
- **Apple sign-in trên Android** (cần web OAuth flow + Apple Services ID) — tách sau; Apple = iOS.
- Google login (`m1-mobile-google-login`).
- Đồng bộ Supabase ↔ Tuya (M1 = Tuya account).
- Tạo App ID capability / Services ID trên Apple Developer portal — **việc client** (cần Apple
  Developer Program trả phí); điều kiện để chạy device test.

## 2. Bối cảnh & ràng buộc
- **iOS native `thirdLogin` = stub** — phải wire bằng selector third-login của Tuya iOS SDK
  (`ThingSmartUser`), **khác** Android (Android là pass-through `thirdLogin(country,token,type,extraInfo,cb)`).
  Selector iOS + type string ('ap'?) + token (identityToken vs authorizationCode) + extraInfo **CHƯA
  chắc** → **cần `/tuya-research`** trước khi code B4.
- **Apple Sign In:** iOS 13+, cần **capability "Sign in with Apple"** (entitlement) + App ID bật
  capability trên Apple Developer portal. Dùng lib `@invertase/react-native-apple-authentication`.
- `identityToken` là JWT ngắn hạn; Tuya cloud verify với Apple. `nonce`/`user` (name/email) chỉ trả
  **lần đầu** authorize → nếu cần lưu thì lưu ngay.
- RN CLI (không Expo) → lib cần autolink + `pod install`.
- Tuya **Data Center = Cloud Project (EU)**; account sau login = **Owner** Home.
- **Link nghiên cứu:** ⏳ CHƯA CÓ note Apple riêng — chạy `/tuya-research` (Tuya iOS third-party/Apple
  login: selector + token + extraInfo). Note liên quan: [tuya-google-login.md](../../docs/research/tuya-google-login.md)
  (bảng provider có dòng Apple `ap`), [tuya-home-sdk-user-account.md](../../docs/research/tuya-home-sdk-user-account.md).

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
> Kiểm chứng được.
- [ ] AC1: `@invertase/react-native-apple-authentication` install + autolink OK — `tsc` resolve,
      `rn config` thấy module.
- [ ] AC2: `services/appleAuth.ts` — `signInApple(): Promise<string>` (identityToken) + `appleAvailable`
      + mock; jest (mock→token · huỷ→CANCELLED · không hỗ trợ→NOT_SUPPORTED).
- [ ] AC3: `AuthScreen.doThird('ap')` → `signInApple()` → `thirdLogin(identityToken,'ap')` (hết `''`);
      mock/dev chạy; huỷ = im lặng.
- [ ] AC4: **iOS `thirdLogin` implement** trong `TuyaAuth.mm` (không còn `TuyaTODO`) theo selector đã
      research; mirror Android. *(compile iOS deferred — cần Mac + pod.)*
- [ ] AC5: iOS entitlement **"Sign in with Apple"** (file `.entitlements` + capability trong pbxproj) +
      doc setup Apple Developer portal (App ID capability); `auth.ts` extraInfo cho `'ap'` đúng research.
- [ ] AC6 *(device — deferred)*: bấm Apple → Apple sheet → vào **Home**; Tuya account = **Owner** Home.

## 4. Các bước thực hiện
1. **B1 — Install + link `@invertase/react-native-apple-authentication`**
   - Việc: thêm dep + install (npm) + verify autolink; `pod install` (khi Mac).
   - File: `apps/mobile/package.json`, lock. Kiểm thử: `tsc` · `rn config` thấy module.
2. **B2 — Helper `services/appleAuth.ts`**
   - Việc: `signInApple()` (`appleAuth.performRequest({requestedOperation: LOGIN, scopes:[EMAIL,FULL_NAME]})`
     → `identityToken`) + `appleAvailable` (`appleAuth.isSupported`) + `AppleSignInError{code}` + mock.
     Pattern require try/catch như `googleAuth.ts`/`auth.ts`.
   - File: **mới** `apps/mobile/src/services/appleAuth.ts` (+ test). Kiểm thử: `jest`.
3. **B3 — Nối `AuthScreen.doThird('ap')`**
   - Việc: `doThird('ap')` → `signInApple()` → `thirdLogin(identityToken,'ap')` thay `''`; `run` đã nuốt
     `CANCELLED` (dùng lại). Cập nhật comment (Apple hết scaffold).
   - File: `apps/mobile/src/screens/AuthScreen.tsx`. Kiểm thử: `tsc` · `jest`.
4. **B4 — iOS native `thirdLogin` (bỏ stub)** ⚠️ *cần `/tuya-research` trước*
   - Việc: thay `TuyaTODO(@"thirdLogin")` bằng call selector third-login Tuya iOS thật
     (vd `loginByAuth2WithType:countryCode:accessToken:extraInfo:success:failure:` — **verify tên +
     tham số qua research**), map user → resolve. Mirror hành vi Android. **Unblock cả Google iOS.**
   - File: `packages/tuya-react-native/ios/Auth/TuyaAuth.mm`. Kiểm thử: build iOS (deferred Mac) +
     đối chiếu selector với research/header SDK.
5. **B5 — Entitlement iOS + extraInfo + doc portal**
   - Việc: tạo `CoolBathMobile.entitlements` (`com.apple.developer.applesignin = [Default]`) + gắn
     `CODE_SIGN_ENTITLEMENTS` trong pbxproj (capability). Chỉnh `auth.ts` extraInfo cho `'ap'` nếu
     research yêu cầu. Viết `APPLE_SIGNIN_SETUP.md` (App ID capability + ai-làm-gì).
   - File: `apps/mobile/ios/CoolBathMobile/CoolBathMobile.entitlements`, `project.pbxproj`,
     `apps/mobile/src/services/auth.ts`, `apps/mobile/APPLE_SIGNIN_SETUP.md`.
     Kiểm thử: `tsc` · đọc lại file · build deferred.
6. **B5→device / B6 — E2E thật (deferred)**
   - Việc: client bật capability App ID (Apple Developer); build iOS trên Mac (`pod install`); chạy
     checklist AC6.
   - Kiểm thử: **checklist thiết bị** trong `progress.md`.

## 5. Rủi ro & câu hỏi mở
- ⚠️ **iOS third-login selector/token CHƯA chắc** (Tuya iOS ≠ Android) → **chạy `/tuya-research` trước
  B4**; sai selector → build fail/runtime reject. Giảm thiểu: verify bằng header SDK khi build.
- ⚠️ **Không build iOS ở đây** (cần Mac + pod) → AC4/AC6 chỉ code + review, verify runtime deferred.
- ⚠️ **Apple Developer Program (trả phí)** + App ID bật "Sign in with Apple" = **việc client** → AC6 BLOCKED.
- ⚠️ **Guideline 4.8**: iOS phải có Apple nếu đã có Google — không làm sẽ bị App Store từ chối.
- ⚠️ Prereq iOS `thirdLogin` cũng ảnh hưởng **Google iOS** (đang tưởng xong nhưng iOS còn stub) — ghi rõ.
- ❓ **Token nào Tuya cần cho Apple** (identityToken JWT vs authorizationCode) + extraInfo? → research.
- ❓ **Android Apple**: bỏ (đề xuất) hay làm web-flow? Đề xuất **bỏ** — Apple = iOS trong M1.
