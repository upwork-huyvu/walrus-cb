# Bảng điều phối tiến trình — Tuya Smart Ice Bath App

> Nơi DUY NHẤT trả lời "dự án đang ở đâu?". Mọi feature đều phải có 1 dòng ở đây.
> `/plan` thêm dòng mới; `/dev` `/test` `/fix-plan` cập nhật cột Phase/Trạng thái.

- **Cập nhật lần cuối:** 2026-07-02 (thêm `m1-mobile-home-device-flow`)

> ⚠️ **M1 đã MỞ RỘNG scope (2026-06-28).** Bản brief mới đưa thêm **Part A (thư
> viện npm Tuya SDK)**, **Part C (backend NestJS + quản lý user)** và **Part D
> (admin web)** vào M1 (trước đây C/D thuộc M2). Ngân sách $250 ban đầu **cần ET lại**.
> M1 nay được chia nhỏ thành các feature A/B/C/D bên dưới.

> ⚠️ **MẠNG ĐÃ THÔNG (2026-06-30).** Registry npm trước đây bị E503/chặn → nhiều feature ghi "tsc/jest deferred (no
> node_modules+503)" và đánh dấu code dựa trên **type-review thủ công**. Verify thật trên `m1-mobile-dashboard` vừa
> phát hiện 2 file ("code xong" trong progress) **chưa từng tồn tại trên đĩa**. → Mọi feature còn dòng "deferred" cần
> chạy `npm install` (hoặc `yarn`/`corepack yarn` tùy app) + `tsc`/`jest`/`eslint` thật trước khi tin progress.md cũ.
>
> 🐛 **ROOT CAUSE đã sửa (2026-06-30):** `.gitignore` gốc có rule `**/lib/` (ý định: ignore build output
> `packages/tuya-react-native/lib/`) nhưng glob quá rộng → nuốt luôn `apps/mobile/src/lib/` và `apps/admin/lib/`
> (2 thư mục **source thật**, không phải build output). Đây chính là lý do `lib/format.ts`, `lib/debounce.ts`
> (m1-mobile-dashboard) và `lib/auth.ts` (m1-admin-push) liên tục bị coi là "thiếu trên đĩa" giữa các session — file
> được tạo nhưng **không bao giờ commit**, nên không sống sót qua session/worktree mới. Đã thu hẹp rule thành
> `packages/*/lib/`. `apps/mobile/src/lib/*` sống sót (untracked). **`apps/admin/lib/*` thì KHÔNG** — file thật sự
> chưa từng tồn tại lại trên đĩa (không chỉ untracked) cho tới khi build-thử 2026-06-30 phát hiện `tsc`/`next build`
> fail 100% (mọi route import `@/lib/api`, `@/lib/auth` không resolve) và dựng lại theo đúng contract README/code gọi.
> **2 thư mục `lib/*` này giờ cần `git add` ở lần commit tới**, nếu không sẽ tái diễn lỗi này.

## Đang làm / Tồn đọng
| Feature (slug) | Milestone | Phần | Phase | Trạng thái | Cập nhật | Thư mục |
|---|---|---|---|---|---|---|
| m3-push-fcm | M3 | mobile+backend | TEST | **B1–B7 CODE XONG + verify JS ✅** (backend tsc+jest 29/29+eslint; mobile tsc+jest **70/70**+eslint 0 err). Backend: bảng `push_tokens` (**migration ĐÃ apply** Supabase) + module `push` (đăng ký/gỡ token `ApiKeyGuard`, `sendToUid` firebase-admin + prune token chết, send endpoint admin-guard). Mobile: `services/push.ts`+`api.ts` (require-guard) wire `useAuth` (login→register/onTokenRefresh/logout→unregister) + handler foreground(Notifee)/background/quit(index.js) + tap-routing (`routeFromData`). **Còn nợ (BLOCKED device):** B5 native config thật (google-services/plist+APNs .p8, `PUSH_SETUP.md`) + B8 E2E Android/iOS + điền env. Rủi ro: API key tin uid (spoof, MVP). | 2026-07-02 | [↗](m3-push-fcm/progress.md) |
| m1-mobile-home-device-flow | M1·B3+B4+B5 | mobile+lib | TEST | **B0–B7 CODE XONG + verify JS ✅** (tsc clean · eslint 0 err · jest test mới 15/15). Điều hướng chuẩn SmartLife: login→home-gate(chưa nhà→**CreateHomeScreen**; có→**DeviceListScreen** landing)→+Add→Pairing(confirm đa bước `pairingStepLabel`+**đặt tên** `renameDevice`)→về list(remount refetch)→tap→**device-detail**(DashboardScreen: điều khiển+CleaningPanel+section Nghi thức). Lib +**`getHomeDeviceList`** (spec+facade+Kotlin+ObjC). B0: replit KHÔNG thiếu tính năng (đã port đủ). **Còn nợ:** build native + round-trip thiết bị thật (BLOCKED toolchain/device). ⚠️ appleAuth.test fail PRE-EXISTING (thiếu dep). | 2026-07-02 | [↗](m1-mobile-home-device-flow/progress.md) |
| m1-tuya-sdk-library | M1·A | mobile/lib | DEV | in_progress (audit ✅ API Android đúng; **build-ready wired** aar+gradle.properties+Maven repos, BLE pairing + iOS RCT_EXPORT_MODULE done; **JDK17+Android SDK đã có sẵn trên máy (xác nhận 2026-06-30, note cũ "máy đang JDK8" SAI/lỗi thời)** — còn console SHA-256/DC + iOS 17 method) | 2026-06-30 | [↗](m1-tuya-sdk-library/progress.md) |
| m1-tuya-sdk-expansion | M1·A+ | mobile/lib | TEST | **BUILD XANH 2026-06-30** — `:jimmy-vu_react-native-turbo-tuya:compileDebugKotlin` + `:app:assembleDebug` **BUILD SUCCESSFUL** (APK `app-debug.apk` 156MB). 12 TurboModule compile sạch. **ĐÍNH CHÍNH chẩn đoán "thiếu module → cần console" (SAI):** quét lại đủ 55 artifact → mọi class ĐỀU CÓ trong `thingsmart:7.5.6`; lỗi thật = **8 import sai package + API drift** (enum `THING_AP/EZ`, `ThingTimerBuilder.Builder`, `IDevOTAListener.firmwareUpgradeStatus`, `MemberBean.getNickName/getMemberStatus`, DND không có trên Android `IThingPush` → stub…). Xác minh bằng `javap` trên SDK thật → [docs/research/tuya-android-sdk-missing-modules.md](../docs/research/tuya-android-sdk-missing-modules.md). Còn: chạy thiết bị thật verify runtime + hoàn thiện stub (DND/joinByCode/getTimerList…) + console SHA-256 cho SDK init | 2026-06-30 | [↗](m1-tuya-sdk-expansion/progress.md) |
| m1-backend-scaffold | M1·C1 | backend | DEV | in_progress (B1–B5 + **Tuya token LIVE ✅** Central EU; **AC3 DB LIVE ✅ 2026-07-02** — Prisma nối Supabase + baseline `0_init` applied. DB đã provision sẵn từ trước (db push, +1 admin `admin@walrus.app`) → dùng baseline né reset. Còn `TUYA_APP_SCHEMA` comment) | 2026-07-02 | [↗](m1-backend-scaffold/progress.md) |
| m1-backend-user-mgmt | M1·C2 | backend | DEV | **backend ĐÚNG 100%** (code + live verify); nhưng `GET /users` = **total:0** vì 🎯 **DATA CENTER MISMATCH** (client confirm 2026-07-02): account đăng ký ở **Western Europe**, project ở **Central Europe** → project không thấy user. **KHÔNG fix được ở code** (DC do **NGÀY TẠO appKey**, không phải countryCode — appKey đời 2026 → mọi nước EU về Western Europe; App SDK **không có** Customize Rules như OEM). → Central Europe cần **ticket Tuya**, hoặc **Option B** (dời project→Western Europe `openapi-weaz` cho khớp). Đã loại: timing (user mới cũng 0), schema, signing, countryCode. App-auth key ≠ OpenAPI cred (1004 sign invalid). ⚠️ DC account cố định lúc đăng ký | 2026-07-02 | [↗](m1-backend-user-mgmt/progress.md) |
| m1-backend-admin-auth | M1·C3 | backend | DEV | in_progress (B1–B3 code xong; **LIVE ✅ 2026-07-02** — `admin@walrus.app` có trong Supabase Auth (confirmed) + allowlist `admin_users` + đã sign-in 2026-07-01 → full auth stack thông) | 2026-07-02 | [↗](m1-backend-admin-auth/progress.md) |
| m1-admin-web | M1·D | admin | DEV | in_progress (B1–B4 code xong; **boot LIVE ✅ 2026-07-02** — Next 16 chạy port 3001, `/login` 200, đọc `.env.local`. Trang `/users` cần backend có `TUYA_APP_SCHEMA`) | 2026-07-02 | [↗](m1-admin-web/progress.md) |
| m1-mobile-auth | M1·B2 | mobile | TEST | code_done — **B1–B4 XONG** (auth.ts adapter+mock · AuthScreen login/register email+OTP+Google/Apple scaffold · useAuth + App gating splash→home/auth + onSessionExpired→auth + logout · Welcome→auth). `tsc`/`jest` deferred (no node_modules+503). Google/Apple cần native SDK (idToken). AC5 device chờ build. Chốt: Tuya account=định danh M1; Supabase sau. **B4 Google → hoàn thiện ở `m1-mobile-google-login`** | 2026-06-30 | [↗](m1-mobile-auth/progress.md) |
| m1-admin-royal-redesign | M1·D | admin+backend | TEST | **B1–B5 code XONG + verified** (admin tsc 0 · eslint 0 · backend jest 26/26 · browser 4 khu vực đẹp). Reskin admin "Gilded Noir" (royal vàng-đen): B1 globals.css+next/font(Cormorant+Inter) · B2 AdminShell sidebar · B3 reskin login. B4 admin-mgmt list+xoá (`GET/DELETE /admin/users`, chặn tự-xoá 403). B5 gửi nhiều user/tất cả (`SendPushDto` uids[]/all + loop per-uid, jest 8/8; UI multi-select+manual). **Bonus:** fix bug redirect-loop token-expiry (proxy.ts). Ảnh royal-*.png. Còn: commit; AC4 gửi thật chờ Tuya subscribe. Chốt: bỏ filter iOS/Android + admin tạo-mới seed tay | 2026-07-02 | [↗](m1-admin-royal-redesign/progress.md) |
| m1-mobile-apple-login | M1·B2 | mobile+lib | TEST | **B1–B5 code XONG + verified** (tsc 0 · eslint 0 err · jest 44/44 · plist OK). Sign in with Apple (iOS) → Tuya `loginByAuth2WithType:'ap'`. B1 install `@invertase/react-native-apple-authentication@2.5.1` · B2 `appleAuth.ts`(jest 5/5) · B3 `doThird('ap')`+`auth.ts` extraInfo Apple · **B4 impl iOS native `thirdLogin` (`loginByAuth2WithType:`+JSON→NSDictionary) — bỏ stub, UNBLOCK cả Google iOS** · B5 entitlement+`APPLE_SIGNIN_SETUP.md`. Research: [tuya-ios-third-party-login.md](../docs/research/tuya-ios-third-party-login.md). Còn **B6/AC6 device BLOCKED** (Xcode capability+pod, Apple Dev Program, Mac build). Cần `git add` appleAuth.ts+test+entitlements+SETUP.md | 2026-07-02 | [↗](m1-mobile-apple-login/progress.md) |
| m1-mobile-google-login | M1·B2 | mobile | **DONE (Android)** | **AC6 ANDROID VERIFIED 2026-07-02** (SM-A325F): build thật (JDK17 + `security-algorithm.aar`→`app/libs` + `secrets.properties`; `assembleDebug` 164MB) → Google login E2E: picker→consent→idToken(aud=Web `rh83..`)→`thirdLogin('gg')`→**Home**, persist qua restart; 2 user Tuya thật (`imax.dev.sn@`,`showroom.imax@`). **🐛 FIX bug logout** không gọi `signOutGoogle` → picker không hiện; vá `src/state/useAuth.ts`, verified on-device (picker đủ 3 acc). **🎯 DC (không phải bug code):** account rơi **Western Europe** ≠ project **Central Europe** → root cause `/users` rỗng ([[m1-backend-user-mgmt]]). Verify verbatim: DC do **NGÀY TẠO appKey**, KHÔNG countryCode nào cứu app post-split. Central Europe self-serve bất khả thi (App SDK)→ticket Tuya / Option B. Đã **expose country code** trên AuthScreen (chỉ để xem/thử, không đổi được DC). iOS device chờ Mac | 2026-07-02 | [↗](m1-mobile-google-login/progress.md) |
| m1-mobile-pairing | M1·B4 | mobile | DEV | in_progress — **B1–B4 code XONG** (adapter pairing+mock · deviceStore AsyncStorage · PairingScreen state-machine Wi-Fi/BLE · success→connectDevice). `tsc`/`jest` deferred (no node_modules+503). Còn AC5 device round-trip + thay `ensureHome` tạm bằng auth/home thật | 2026-06-30 | [↗](m1-mobile-pairing/progress.md) |
| m1-mobile-scaffold | M1·B(clone UI) | mobile | DEV | in_progress — **B1–B6 code XONG** (clone UI 12 screens + **B6 nối lib Tuya**: adapter require+mock, DP-id, useAppState device→Tuya). `tsc`/`jest` deferred (no node_modules+503). Còn AC6 device round-trip (build+thiết bị+DP schema) → rồi feature mobile pairing/dashboard | 2026-06-30 | [↗](m1-mobile-scaffold/progress.md) |
| m1-mobile-dashboard | M1·B5 | mobile | DEV | in_progress — **B1–B9 code XONG + verify PASS** (mạng đã thông → `npm install`+`jest` 34/34+`tsc` clean+`eslint` 0 lỗi; sửa 2 divergence code-vs-đĩa phát hiện qua verify thật: `lib/format.ts`+`lib/debounce.ts` từng ghi "code xong" nhưng chưa từng tồn tại trên đĩa + 1 TS-quirk `withTimeout<any>`). **AC7 ĐẠT.** Còn: H-2 DP schema thật + AC6/HW1-8 chờ build+thiết bị; nit L-1/L-2/L-3 backlog | 2026-06-30 | [↗](m1-mobile-dashboard/progress.md) |
| m1-admin-push | M1·C+D | backend+admin | DEV | in_progress — Option A **Tuya Cloud App Push** (reuse `TuyaCloudService`+`AdminAuthGuard`, KHÔNG Firebase). **B1–B6 + lib/auth CODE XONG**: backend (env biz_type · DTO · `NotificationsService` push+template + spec · controller/module/app.module) + admin (`lib/api.ts`+`lib/auth.ts` tự tạo · `notifications/` gửi: page+action+layout+`SendPushForm` parse `${var}` · `notifications/templates` tạo+list duyệt · proxy+nav). **Divergence đã gỡ:** vá `lib/auth` (vốn thiếu, scope `m1-admin-web`) → mọi import `@/...` resolve. `tsc`/`jest`/`build` defer (E503 Nexus). AC6 live BLOCKED: subscribe product + duyệt template + token-reg **M3** `m3-push-fcm` | 2026-06-30 | [↗](m1-admin-push/progress.md) |

## Backlog M1 — chia theo brief mở rộng (chạy `/plan <slug>` khi tới)
> Thứ tự phụ thuộc: **A → B**; **C → D** (track backend/admin chạy song song được).
| Feature (slug) | Milestone | Phần | Mô tả ngắn |
|---|---|---|---|
| m1-mobile-home-setup | M1·B3 | mobile | Setup Home đầu tiên cho user (1 nhà/user) |

## Backlog M2 / M3 (ngoài phạm vi M1)
| Feature (slug) | Milestone | Phần | Mô tả ngắn |
|---|---|---|---|
| m2-ui-completion | M2 | mobile | Hoàn thiện UI từ design (đèn, UV, defrost), tối ưu mobile |
| m2-backend-device-mapping | M2 | backend | User profile chi tiết + device mapping + RLS (phần backend còn lại) |
| m2-home-rooms-roles | M2 | mobile | Quản lý nhà nâng cao: gán phòng, phân quyền thiết bị, multi-home |
| m2-admin-device-usage | M2 | admin | Admin web: theo dõi trạng thái thiết bị + dữ liệu usage (phần admin còn lại) |
| m3-into-the-cold | M3 | mobile | Đồng hồ đếm ngược + daily summary |
| m3-push-fcm | M3 | mobile+backend | Push notification qua Firebase (nhắc dọn, cảnh báo) |
| m3-filter-reminder | M3 | mobile | Nhắc bộ lọc: trạng thái + reset + link mua |
| m3-testing-delivery | M3 | all | Kiểm thử toàn diện, tối ưu, bàn giao mã nguồn + tài liệu |

## Đã xong
| Feature (slug) | Milestone | Phần | Ngày xong | Đã audit? | Thư mục |
|---|---|---|---|---|---|
| — | | | | | |

## Đã thay thế (Superseded)
| Feature (slug) | Thay bằng | Ngày | Lý do |
|---|---|---|---|
| m1-scaffold-and-tuya-init | m1-tuya-sdk-library + m1-mobile-scaffold | 2026-06-28 | Đổi hướng: wrap Tuya SDK thành thư viện npm riêng (TurboModule) thay vì nhúng native vào app; M1 mở rộng scope |

## Bị chặn
| Feature (slug) | Đang chờ gì | Từ ngày |
|---|---|---|
| m1-tuya-sdk-library | Build-ready đã wire (2026-06-29). **JDK17 + Android SDK xác nhận đã có sẵn trên máy (2026-06-30)** — không còn là blocker. Còn: console applicationId TRÙNG package + keystore SHA-256 + DC. iOS cần Mac. Xem progress.md. | 2026-06-29 |

---
### Quy ước
- **Phase:** PLAN → DEV → TEST → FIX-PLAN → DONE (xem `.claude/skills/dev-loop/SKILL.md`).
- **Milestone:** M1 Nền tảng, Kết nối lõi & Quản lý User (mở rộng — ngân sách cần ET lại) · M2 UI & Backend/Admin nâng cao · M3 Nâng cao & bàn giao.
- **Phần:** mobile (RN CLI) · lib (`packages/tuya-react-native`) · backend (NestJS+Supabase) · admin (Next.js web).
