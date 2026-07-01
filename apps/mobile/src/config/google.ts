// Google OAuth client IDs cho Google Sign-In.
// KHÔNG bí mật — là định danh client phía app, an toàn để trong bundle (giống google-services.json).
//
// Tạo ở Google Cloud Console (1 project, 3 OAuth client) — xem docs/research/tuya-google-login.md:
//   - Web client   → điền GOOGLE_WEB_CLIENT_ID dưới đây (idToken audience; dùng CHUNG Android+iOS)
//                    + dán vào Tuya console (Login Configuration for Android VÀ iOS).
//   - iOS client   → điền GOOGLE_IOS_CLIENT_ID (chỉ iOS; + URL scheme reversed-id trong Info.plist).
//   - Android client (package com.walrus.wellnesscb + SHA-1) → KHÔNG cần điền ở đây, Google tự khớp.
//
// Để trống = Google Sign-In sẽ lỗi (DEVELOPER_ERROR) tới khi điền client thật.
export const GOOGLE_WEB_CLIENT_ID = ''; // '<xxxxxxxx>.apps.googleusercontent.com'
export const GOOGLE_IOS_CLIENT_ID = ''; // '<xxxxxxxx>.apps.googleusercontent.com'
