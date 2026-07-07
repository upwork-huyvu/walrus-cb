# Android Signing - SHA fingerprints

Package name (applicationId / namespace): **`com.walrus.wellnesscb`**

Dùng để đăng ký với **Firebase (FCM)** và **Tuya Cloud Project**.
- Firebase → dùng **SHA-1** (đăng ký cả debug + release), rồi tải lại `google-services.json`.
- Tuya → dùng **SHA-256** + package name.

> ⚠️ File này chỉ chứa **fingerprint công khai** (không phải bí mật).
> Mật khẩu keystore nằm ở `~/.gradle/gradle.properties` (`WALRUS_RELEASE_*`),
> **ngoài repo** - tuyệt đối không commit password/keystore vào git.

## Debug - `app/debug.keystore` (alias `androiddebugkey`)
- SHA-1:   `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
- SHA-256: `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`

## Release - `app/walrus-release.keystore` (alias `walrus`)
- SHA-1:   `AA:78:FA:1E:8C:30:FF:4A:A3:24:01:05:7A:A9:6E:6E:53:EA:6B:06`
- SHA-256: `C0:05:44:FC:78:3A:DF:31:96:AD:B7:56:35:9B:E1:91:FA:58:5A:4C:3A:7A:60:5F:42:A6:D0:8E:63:B2:54:71`
- Valid: 2026-06-30 → 2053-11-15

## Lấy lại fingerprint
```bash
# Debug
keytool -list -v -keystore app/debug.keystore -alias androiddebugkey -storepass android

# Release (đọc creds từ ~/.gradle/gradle.properties)
keytool -list -v -keystore app/walrus-release.keystore -alias walrus
```
