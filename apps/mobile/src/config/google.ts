// Google OAuth client IDs cho Google Sign-In.
// KHÔNG bí mật - là định danh client phía app, an toàn để trong bundle (giống google-services.json).
//
// Tạo ở Google Cloud Console (1 project, 3 OAuth client) - xem docs/research/tuya-google-login.md:
//   - Web client   → điền GOOGLE_WEB_CLIENT_ID dưới đây (idToken audience; dùng CHUNG Android+iOS)
//                    + dán vào Tuya console (Login Configuration for Android VÀ iOS).
//   - iOS client   → điền GOOGLE_IOS_CLIENT_ID (chỉ iOS; + URL scheme reversed-id trong Info.plist).
//   - Android client (package com.walrus.android.wellness + SHA-1) → KHÔNG cần điền ở đây, Google tự khớp.
//
// Để trống = Google Sign-In sẽ lỗi (DEVELOPER_ERROR) tới khi điền client thật.
// ⚠️ WEB phải là client type WEB (root "web" trong file tải về), KHÔNG phải Desktop/installed -
//    dùng sai loại → idToken = null. Đây là client 'rh83...' (root "web"), không phải 'vkcr...' (installed).
export const GOOGLE_WEB_CLIENT_ID = '855254973930-7jqj7t4t3r7g4d6damnj86o8qafj9qgq.apps.googleusercontent.com';
export const GOOGLE_IOS_CLIENT_ID = '855254973930-7ntsolqjobnrokedrqrga1d5hg59mkj6.apps.googleusercontent.com';
export const GOOGLE_ANDROID_CLIENT_ID = '855254973930-9d303fj1d5ets8b7k57e25ionj4lbh5b.apps.googleusercontent.com';
