# Context: Đăng nhập bằng Google (wire idToken thật) - mobile

> File "trí nhớ" - giữ context xuyên suốt các phiên. Mọi quyết định, phát hiện, cạm bẫy ghi vào đây.

- **Slug:** `m1-mobile-google-login`

## Quyết định kỹ thuật (Decision log)
- **2026-07-01** - Tách feature riêng `m1-mobile-google-login` (thay vì refresh `m1-mobile-auth`).
  Lý do: B4 của `m1-mobile-auth` chỉ là *scaffold* (nút + `thirdLogin('', 'gg')`) và đã đóng ở
  trạng thái deferred; phần wire idToken thật đủ nặng (install/link native + helper + iOS URL
  scheme + phối hợp console) để có state riêng. Đã cân nhắc & loại: nhồi tiếp vào `m1-mobile-auth`
  (sẽ làm progress feature đó rối, lẫn Apple).
- **2026-07-01** - Định danh M1 = **Tuya account** (không Supabase). Google idToken → `thirdLogin`
  → Tuya tạo/đăng nhập account tương ứng; account đó phải là **Owner** Home. (Kế thừa
  [[m1-mobile-auth]].)
- **2026-07-01 (đề xuất, chốt ở B4)** - Android dùng **Google Sign-In thuần** (webClientId qua
  `configure`), **KHÔNG** bắt buộc `google-services.json`/Firebase. Firebase chỉ cần khi làm FCM
  (M3 `m3-push-fcm`). Chỉ cần **SHA-1** đăng ký ở Android OAuth client.

## Bản đồ file/module
| File / Module | Vai trò |
|---|---|
| `apps/mobile/src/config/google.ts` | (đã có) hằng `GOOGLE_WEB_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID` - **đang trống** |
| `apps/mobile/src/services/googleAuth.ts` ✅ | (B2) `configureGoogle()` + `signInGoogle():Promise<string>` + `signOutGoogle()` + `GoogleSignInError{code}`; require try/catch + `googleAvailable`; mock trả `'mock-google-id-token'` |
| `apps/mobile/src/services/googleAuth.test.ts` ✅ | (B2) jest 5 case: mock→token · config rỗng→NO_CONFIG · success→idToken · huỷ→CANCELLED · idToken null→NO_ID_TOKEN |
| `apps/mobile/src/services/auth.ts` | (đã có) `thirdLogin(token,type)` - adapter Tuya, `extraInfo='{"pubVersion":1}'` cho `'gg'` |
| `apps/mobile/src/screens/AuthScreen.tsx` ✅ | (B3) `doThird('gg')`→`signInGoogle()`→`thirdLogin(idToken,'gg')`; `run` nuốt `CANCELLED` + dùng `.message` cho `GoogleSignInError`. 'ap' vẫn scaffold `''` |
| `apps/mobile/App.tsx` | (B2) gọi `configureGoogle()` 1 lần cạnh `initSdk()` (dòng ~48-54) |
| `apps/mobile/ios/CoolBathMobile/Info.plist` ✅ | (B4) `CFBundleURLTypes` placeholder `com.googleusercontent.apps.YOUR_IOS_CLIENT_ID` (plist lint OK) |
| `apps/mobile/GOOGLE_SIGNIN_SETUP.md` ✅ | (B4) checklist: Google Cloud 3 client + fill google.ts + iOS URL scheme/openURL + Tuya console + bảng ai-làm-gì |
| `apps/mobile/android/SIGNING.md` | (đã có) SHA-1/SHA-256 fingerprint - GOOGLE_SIGNIN_SETUP link tới |
| `apps/mobile/package.json` | (đã có) dep `@react-native-google-signin/google-signin@^16.1.2` - **chưa install** |

## Phát hiện & cạm bẫy (Findings / Gotchas)
- **Trạng thái đầu vào (2026-07-01):** commit `bd3cccc` đã thêm dep + `config/google.ts` + research;
  nhưng `node_modules/@react-native-google-signin` **CHƯA install**, client ID **trống**, và
  `doThird` **vẫn truyền `''`** → nút Google hiện lỗi `REMOTE_API_RUN_UNKNOW_FAILED`.
- **`idToken = null` nếu `webClientId` không phải type WEB** - cạm bẫy số 1.
- **SHA-1 phải khớp Google ↔ Tuya**, nếu không `DEVELOPER_ERROR`. Debug SHA-1 ghi trong research.
- Chưa có `google-services.json` (android) / `GoogleService-Info.plist` (ios) trên đĩa - khớp
  quyết định "Google Sign-In thuần, không Firebase".
- `services/auth.ts.thirdLogin` dùng `DEFAULT_COUNTRY='49'` cứng (không lấy từ field UI) - chấp
  nhận cho M1.
- App init: `App.tsx` đã `await initSdk()` trước `auth.bootstrap()` (commit `a2632b5`) - chèn
  `configureGoogle()` vào cùng chỗ.
- **node_modules hỏng + cách cài tin cậy (2026-07-01):** thư mục `@react-native-google-signin`
  sót trạng thái đệ quy/rác từ thời "503/Nexus" (con `node_modules` lồng ~558 entries + copy RN-app
  App.tsx/dev-workflow xuất hiện ở nhiều tầng, `du` treo vô tận, cài lại cho kết quả khác nhau mỗi
  lần). **Fix:** `npm install` full (884 pkg) ghi đè sạch → `require.resolve` OK + 16 `.d.ts` thật +
  `tsc` resolve. Cách cài **tin cậy nhất** khi 1 package cụt: `rm -rf node_modules/<pkg> && npm
  install <pkg>@<ver>` (explicit) - `npm install` trơn sau `rm -rf` từng ra package cụt chỉ 2 file.
  **Quirk còn lại:** `du` trên cây package vẫn treo dù `find`/`ls`/resolve/tsc đều xanh → nghi
  Spotlight/`du` quirk trên máy, **KHÔNG** phải blocker (mọi gate chức năng pass).
- **B1 (2026-07-01):** `@react-native-google-signin/google-signin@16.1.2` install OK,
  autolink thấy (android `sourceDir` + ios present), `tsc` sạch. peer `react-native:*` → RN 0.85 khớp
  (peer `expo>=52` bị bỏ qua vì không có expo - không lỗi). **Cạm bẫy môi trường:** máy đang **node
  v20.20.2** nhưng `engines` yêu cầu ≥22.11 → `npm warn EBADENGINE` (non-fatal, không có `.npmrc`
  engine-strict). Nếu sau này CI bật engine-strict thì phải nâng node.

## Client ID đã điền + cạm bẫy web-vs-installed (2026-07-02)
- Client tải file OAuth từ Google Cloud, bỏ vào `assets/google/` (3 file). **Đã xử:** rút giá trị
  public → điền `google.ts` + Info.plist; **XOÁ cả 3 file raw** (untracked, chưa commit nên sạch,
  không cần rotate); thêm gitignore `**/client_secret*.json` + `**/GoogleService-Info.plist`.
- ⚠️ **CẠM BẪY đã sửa:** ban đầu `GOOGLE_WEB_CLIENT_ID` bị điền nhầm bằng `vkcr...` = client
  **`installed`/Desktop** (root key `installed` trong json) → sai loại → idToken=null. **WEB thật =
  `rh83jmqo8h0secjc4sbpn8n2gf3ldcig`** (root key `web`). Đã sửa. → **Kiểm tra: Web Client ID dán
  vào Tuya console cũng phải là `rh83...` (web), KHÔNG phải `vkcr...`.**
- Giá trị cuối (public, committed): WEB=`...rh83...`, iOS=`...vnig...`, reversed(Info.plist)=
  `com.googleusercontent.apps.118408958508-vnigt7uncnsu8lobhvb9p5hfefre2u1j`, bundle=`com.walrus.wellness`.
- 3 client id 118408958508-*: `rh83`=Web, `vnig`=iOS, `vkcr`=Desktop(thừa, không dùng).

## iOS native thirdLogin - đã unblock (2026-07-02)
- Lúc làm Google, iOS `TuyaAuth.mm thirdLogin` còn là **TODO stub** → Google iOS thực ra **chưa chạy
  native**. Feature [[m1-mobile-apple-login]] (B4) đã **implement** `thirdLogin`→`loginByAuth2WithType:`
  (research [tuya-ios-third-party-login.md](../../docs/research/tuya-ios-third-party-login.md)) → **Google
  iOS giờ sẵn sàng native**. Còn thiếu (build-time): `AppDelegate` openURL handler + `pod install` +
  điền client id (đã điền) → xem [GOOGLE_SIGNIN_SETUP.md](../../apps/mobile/GOOGLE_SIGNIN_SETUP.md).

## Cấu hình env (khảo sát 2026-07-01 qua workflow map-env-config)
- **Mobile KHÔNG có `.env`.** Config = 2 tầng: (1) **public** = TS const trong `src/config/`
  (Google client id ở `google.ts` - commit thẳng, an toàn bundle); (2) **secret** = `secrets.properties`
  (Android) + `secrets.xcconfig` (iOS), gitignore, inject lúc build native (KHÔNG đụng JS).
- Tuya keys: Android qua `build.gradle`→`manifestPlaceholders`→`<meta-data>`→SDK tự đọc; iOS qua
  `secrets.xcconfig`→`Config/*.xcconfig #include?`→`$(VAR)` trong Info.plist. Copy từ `*.example`,
  điền từ `docs/sdk/keys.txt`.
- ⚠️ **LEAK đã biết - user CHỦ ĐỘNG hoãn (2026-07-01):** `docs/sdk/keys.txt` **đang track trong git**
  (3 commit) chứa secret THẬT (IOS_SECRET/ANDROID_SECRET/CLOUD_CLIENT_SECRET); rule `.gitignore`
  vô tác dụng vì đã track. User nói "tao tự lo" → **KHÔNG tự sửa, KHÔNG báo lại nữa** (cần purge
  history + rotate keys - việc của user).
- ⚠️ iOS `Config/*.xcconfig` **chưa nối** vào pbxproj (baseConfigurationReference trỏ thẳng Pods) →
  secret iOS resolve rỗng tới khi set "Based on Configuration File" trong Xcode. Và `android/app/libs/`
  thiếu `security-algorithm-*.aar` → `init()` crash runtime. (Ngoài scope Google login, ghi để nhớ.)

## Device verify (Android) + bug logout + DC issue (2026-07-02)
- **AC6 Android VERIFIED** (SM-A325F): build thật (JDK17; copy `security-algorithm-*.aar`→`app/libs`; tạo
  `android/secrets.properties` Tuya AppKey/Secret; `assembleDebug` OK 164MB). Google login E2E: picker→consent
  →idToken (aud=Web `rh83..`)→`thirdLogin('gg')`→**Home**; persist qua restart. 2 user Tuya thật:
  `imax.dev.sn@gmail.com`, `showroom.imax@gmail.com`.
- **🐛 BUG (đã FIX):** `useAuth.signOut`→`auth.logout` chỉ logout Tuya, **không gọi `signOutGoogle`** → Google
  giữ cache → `signIn()` one-tap account cũ, **không hiện account picker**. Fix: nối `signOutGoogle()` vào
  `src/state/useAuth.ts` (JS-only). Verified on-device: picker "Choose an account" hiện đủ 3 acc. **Cần commit.**
- **🎯 DC MISMATCH (root cause `/users` rỗng):** `thirdLogin` truyền `countryCode='49'` → account rơi
  **Western Europe DC** (app tạo sau 2025-11-25 → mọi nước EU về Western Europe), nhưng project ở **Central
  Europe** → backend không thấy user. **FIX KHÔNG PHẢI ở code** - zone do **bảng mapping OEM app trên portal**
  quyết (client không override được; bridge không có region API là ĐÚNG). **Client chọn Option A:** OEM App →
  Required Setting → Data Center → **Customize Rules** map EU→Central Europe → **launch (1 lần/app)** → **rebuild
  app** (giữ nguyên `countryCode='49'`) → xoá user Western Europe cũ + re-register. ⚠️ DC account cố định lúc
  đăng ký → 2 user cũ (`imax`/`showroom` `we...`) phải **tạo lại** ở Central Europe. "Show zone" Android không
  preview pre-login được (chỉ đọc `Domain.regionCode` sau login). Chi tiết → [[m1-backend-user-mgmt]] context.
- **🔒 CHỐT CUỐI (2026-07-02) - đính chính Option A ở trên:** **Customize Rules chỉ OEM App, App SDK KHÔNG
  có** → không tự ép Central Europe được. DC do **ngày tạo appKey** (post-split → Western Europe); không
  countryCode nào cứu. Central Europe = **ticket Tuya** hoặc **Option B** (dời project→Western Europe). Đã
  **expose country code** trên [AuthScreen.tsx](../../apps/mobile/src/screens/AuthScreen.tsx) + truyền vào
  `thirdLogin` ([auth.ts](../../apps/mobile/src/services/auth.ts)) - **chỉ để xem/thử, KHÔNG đổi được DC.**

## Liên kết
- Plan: [plan.md](plan.md)
- Progress: [progress.md](progress.md)
- Research liên quan: [tuya-google-login.md](../../docs/research/tuya-google-login.md)
- Feature gốc: [[m1-mobile-auth]] · liên quan [[m1-mobile-pairing]] (cần Owner Home) · DC blocker của [[m1-backend-user-mgmt]]

## Tóm tắt khi hoàn thành (điền lúc FINISH)
<chưa hoàn thành>
