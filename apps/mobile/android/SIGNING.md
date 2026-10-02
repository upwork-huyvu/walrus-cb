# Android Signing - SHA fingerprints

Package name (applicationId / namespace): **`com.walrus.android.wellness`**

Dùng để đăng ký với **Google Cloud / Firebase** (Google Sign-In, FCM) và **Tuya** (App SDK Android).
- Google → dùng **SHA-1** + package name, rồi tải lại `google-services.json`.
- Tuya → dùng **SHA-256** + package name.

> ⚠️ File này chỉ chứa **fingerprint công khai** (không phải bí mật).
> Mật khẩu keystore nằm ở `secrets.properties` (`WALRUS_RELEASE_*`, gitignored),
> **ngoài repo** - tuyệt đối không commit password/keystore vào git.

## Một keystore cho cả debug và release - `app/walrus-release.keystore` (alias `walrus`)

Khi có `WALRUS_RELEASE_*` trong `secrets.properties`, **cả debug lẫn release** đều ký bằng keystore
này (xem `app/build.gradle`) → chỉ cần đăng ký MỘT bộ fingerprint ở Tuya + Google.

- SHA-1:   `42:D4:92:F4:86:44:06:F0:02:36:98:71:03:BD:9B:DE:8C:21:BE:3B`
- SHA-256: `C7:26:01:70:E3:0E:17:B5:3B:1D:11:61:9C:95:2D:58:C2:D0:D0:0C:5E:B2:17:A7:A3:89:E5:35:C5:B5:09:5E`
- Đo bằng `./gradlew :app:signingReport` ngày 2026-09-30.

Máy không có `secrets.properties` (dev khác / CI) → cả hai rơi về `app/debug.keystore`
(alias `androiddebugkey`, SHA-256 `FA:C6:17:45:…:03:3B:9C`). Bản ký bằng debug.keystore sẽ bị Tuya
từ chối nếu fingerprint đó không được đăng ký trên Tuya console.

## Google Play App Signing - fingerprint THỨ HAI

Khi phát hành qua Google Play, keystore ở trên chỉ là **upload key**. Google ký lại bản cài cho
người dùng bằng **app signing key** của Google ⇒ app tải từ Play có SHA KHÁC.

Sau lần upload `.aab` đầu tiên: Play Console → *Test and release → App integrity → App signing* →
chép **SHA-1** và **SHA-256** của *App signing key certificate*, rồi thêm vào:
- Google Cloud → OAuth client Android (SHA-1) - không có thì Google Sign-In báo `DEVELOPER_ERROR`.
- Tuya console → App SDK Android (SHA-256) - không có thì Tuya SDK từ chối khởi tạo.

## Lấy lại fingerprint
```bash
./gradlew :app:signingReport     # in SHA của mọi variant, không in mật khẩu
```
