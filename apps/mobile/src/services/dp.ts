// DP-id của bồn tắm đá. ⚠️ PLACEHOLDER — cần DP schema THẬT từ client để chốt id chính xác
// (chỉ targetTemp='104' đã dùng ở README/example; current/light đặt tạm). Đổi tại 1 chỗ này khi có schema.
export const DP = {
  currentTemp: '105', // ⚠️ placeholder — nhiệt độ hiện tại (đọc-only)
  targetTemp: '104', //  ⚠️ placeholder — nhiệt độ mục tiêu (set)
  light: '101', //       ⚠️ placeholder — đèn on/off
} as const;

export type DeviceDps = {
  currentTemp: number | null;
  targetTemp: number | null;
  lightOn: boolean | null;
};

function toNum(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return null;
}

// dpsJson (vd '{"104":6,"105":12,"101":false}') → field thiết bị.
export function parseDeviceDps(dpsJson: string): DeviceDps {
  let dps: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(dpsJson || '{}');
    if (parsed && typeof parsed === 'object') dps = parsed as Record<string, unknown>;
  } catch {
    dps = {};
  }
  const light = dps[DP.light];
  return {
    currentTemp: toNum(dps[DP.currentTemp]),
    targetTemp: toNum(dps[DP.targetTemp]),
    lightOn: typeof light === 'boolean' ? light : null,
  };
}

// DP value-type là SỐ/bool (theo lib): build JSON để publish.
export const buildTempDps = (temp: number): string => JSON.stringify({ [DP.targetTemp]: temp });
export const buildLightDps = (on: boolean): string => JSON.stringify({ [DP.light]: on });
