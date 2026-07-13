// B1 DIAGNOSTIC (m1-fix-notifications) - log TẠM để chốt 2 root cause chưa xác định trên THIẾT BỊ THẬT:
//   • #1 (vào không thấy noti mới): FCM-history rỗng vì key/token/config? → log status + count + apiKeySet.
//   • #2 (đã đọc → thành mới): AsyncStorage có persist lastReadAt không? → log before/after/persistOk.
//
// ĐỌC LOG TRÊN DEVICE (không cần Metro):
//   Android:  adb logcat -s ReactNativeJS | grep NOTIF-DIAG
//   iOS:      Xcode → Window → Devices → Console  (lọc "NOTIF-DIAG")
//   (hoặc Metro terminal nếu đang gắn)
//
// ⚠️ GỠ TOÀN BỘ sau khi chốt root cause (B1 xong → B4/B3 fix thật). Chỉ chạy khi __DEV__.
export function notifDiag(event: string, data?: Record<string, unknown>): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[NOTIF-DIAG] ${event}`, data ? JSON.stringify(data) : '');
  }
}
