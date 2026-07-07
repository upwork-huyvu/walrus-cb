# FCM Push - thiết lập native (B5)

> Phần JS đã xong (services/push.ts, api.ts, wire useAuth, handler index.js/App). Đây là các bước
> **native** cần làm để noti chạy thật trên thiết bị. `google-services.json` + `GoogleService-Info.plist`
> đã được `.gitignore` - KHÔNG commit.

## 0. Firebase project
1. Tạo Firebase project (hoặc dùng project sẵn của app).
2. Thêm app **Android** (package `com.walrus.wellnesscb`) → tải `google-services.json`
   → đặt vào `apps/mobile/android/app/google-services.json`.
3. Thêm app **iOS** (bundle id của `CoolBathMobile`) → tải `GoogleService-Info.plist`
   → thêm vào Xcode target (`apps/mobile/ios/CoolBathMobile/`).

## 1. Backend service account (server-only)
- Firebase Console → Project settings → Service accounts → **Generate new private key** (JSON).
- Điền vào backend `.env`: `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` (giữ `\n` escaped),
  và đặt `PUSH_API_KEY` (khớp `apps/mobile/src/config/api.ts`).

## 2. Android
- `android/build.gradle`: thêm classpath `com.google.gms:google-services`.
- `android/app/build.gradle`: `apply plugin: 'com.google.gms.google-services'`.
- `AndroidManifest.xml`: quyền `POST_NOTIFICATIONS` (Android 13+) - Notifee xin runtime.
- Notifee tự tạo channel `default` (xem services/push.ts).

## 3. iOS (APNs - cần Apple Developer Program + Mac)
- Xcode: **Push Notifications** capability + **Background Modes → Remote notifications**.
- Tạo **APNs Auth Key (.p8)** trên Apple Developer → upload lên Firebase Console (Cloud Messaging → APNs).
- `AppDelegate`: `@react-native-firebase/messaging` tự swizzle; đảm bảo `FirebaseApp.configure()` nếu cần.
- `cd ios && pod install`.

## 4. Cấu hình app
- `apps/mobile/src/config/api.ts`: đặt `API_BASE_URL` (backend đã deploy) + `PUSH_API_KEY`.

## 5. Kiểm thử (B8 - device)
1. Login → kiểm DB `push_tokens` có bản ghi `{tuyaUid, token, platform}`.
2. `POST /push/send` (admin) `{tuyaUid, title, body, data:{screen:'device-detail',devId:'...'}}`.
3. App **foreground** → noti hiện qua Notifee. **Background/quit** → noti hệ thống hiện.
4. Tap noti → điều hướng tới `device-detail`.
5. Logout → bản ghi token bị xoá khỏi `push_tokens`.
