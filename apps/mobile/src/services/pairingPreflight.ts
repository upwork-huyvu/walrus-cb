// Preflight: chặn SỚM những ca chắc chắn fail, kèm hướng dẫn hành động được.
//
// Vì sao: trước đây app cứ chạy đủ 120s rồi ném ra một lỗi rỗng. Ba nguyên nhân dưới đây có thể biết
// TRƯỚC khi bấm Start - bắt chúng ở đây tiết kiệm cho user 2 phút và một cú fail khó hiểu.
//
// Nguồn: docs/research/tuya-wifi-ez-pairing-failure.md
//   - iOS 14.5+ KHÔNG gửi được gói EZ nếu app thiếu entitlement `com.apple.developer.networking.multicast`.
//     Apple ĐÃ duyệt (2026-08-07) và entitlement nằm trong `CoolBathMobile.entitlements` ⇒ EZ chạy được
//     trên iOS. Không cảnh báo về entitlement nữa: thiếu quyền thì Xcode fail lúc KÝ chứ không fail lúc
//     chạy, nên app đang chạy được nghĩa là quyền đã có - cảnh báo chỉ tổ đuổi user khỏi mode mặc định.
//   - Cái iOS VẪN có thể vướng là quyền **Local Network**: user bấm Deny một lần thì iOS không hỏi lại,
//     và EZ sẽ im lặng không tới đâu → cảnh báo cái đó thay vì cảnh báo entitlement.
//   - Wi-Fi EZ chỉ chạy trên 2.4GHz; AP mode thì hỗ trợ cả router 2.4+5GHz.
import { Platform } from 'react-native';
import { getCurrentWifiBand, wifiBandAvailable } from './wifiScanner';
import { logPairing } from './pairingLog';

export type PreflightCode =
  | 'ssid_empty'
  | 'band_5ghz'
  | 'band_unknown'
  | 'ios_ez_local_network';

export type PreflightIssue = {
  code: PreflightCode;
  /** `block` = không cho chạy; `warn` = vẫn chạy nhưng báo trước. */
  severity: 'block' | 'warn';
  message: string;
};

export type PreflightInput = {
  mode: 'EZ' | 'AP';
  ssid: string;
  /** cho phép test bơm platform thay vì phụ thuộc RN runtime */
  platform?: 'ios' | 'android';
};

export function hasBlocker(issues: PreflightIssue[]): boolean {
  return issues.some((i) => i.severity === 'block');
}

export async function preflightPairing(input: PreflightInput): Promise<PreflightIssue[]> {
  const platform = input.platform ?? (Platform.OS as 'ios' | 'android');
  const issues: PreflightIssue[] = [];

  if (!input.ssid.trim()) {
    issues.push({
      code: 'ssid_empty',
      severity: 'block',
      message: 'Enter the Wi-Fi network name your Walrus should join.',
    });
  }

  // AP mode né được cả 5GHz lẫn quyền mạng nội bộ → không cần check băng tần.
  if (input.mode === 'EZ') {
    if (platform === 'ios') {
      issues.push({
        code: 'ios_ez_local_network',
        severity: 'warn',
        message:
          'If pairing never finds Walrus, check Settings → Walrus → Local Network is on. iOS only asks once.',
      });
    }

    const { band, frequency } = await getCurrentWifiBand();
    if (band === '5GHz' || band === '6GHz') {
      issues.push({
        code: 'band_5ghz',
        severity: 'block',
        message: `This phone is on a ${band} network (${frequency} MHz). Walrus pairs over 2.4GHz only - switch the phone to the 2.4GHz network, or use AP mode.`,
      });
    } else if (!wifiBandAvailable) {
      // iOS: không có API đọc băng tần → nói thật, đừng giả vờ đã kiểm.
      issues.push({
        code: 'band_unknown',
        severity: 'warn',
        message: 'This phone can’t report the Wi-Fi band. Make sure it is on the 2.4GHz network, not 5GHz.',
      });
    }
  }

  logPairing('preflight', {
    mode: input.mode,
    platform,
    blocked: hasBlocker(issues),
    issues: issues.map((i) => i.code),
  });
  return issues;
}
