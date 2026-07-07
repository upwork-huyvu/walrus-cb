// DP-id của bồn tắm đá. ⚠️ PLACEHOLDER - cần DP schema THẬT từ client để chốt id chính xác
// (chỉ targetTemp='104' đã dùng ở README/example; current/light/purify/freeze đặt tạm).
// Đổi tại 1 chỗ này khi có schema.
export const DP = {
  currentTemp: '105', // ⚠️ placeholder - nhiệt độ hiện tại (đọc-only)
  targetTemp: '104', //  ⚠️ placeholder - nhiệt độ mục tiêu (set)
  light: '101', //       ⚠️ placeholder - đèn on/off
  purify: '102', //      ⚠️ placeholder - lọc/ozone (lá) on/off
  freeze: '106', //      ⚠️ placeholder - làm lạnh (chiller) on/off
} as const;

export type DeviceDps = {
  currentTemp: number | null;
  targetTemp: number | null;
  lightOn: boolean | null;
  purifyOn: boolean | null;
  freezeOn: boolean | null;
};

function toNum(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return null;
}

function toBool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
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
  return {
    currentTemp: toNum(dps[DP.currentTemp]),
    targetTemp: toNum(dps[DP.targetTemp]),
    lightOn: toBool(dps[DP.light]),
    purifyOn: toBool(dps[DP.purify]),
    freezeOn: toBool(dps[DP.freeze]),
  };
}

// DP value-type là SỐ/bool (theo lib): build JSON để publish.
export const buildTempDps = (temp: number): string => JSON.stringify({ [DP.targetTemp]: temp });
export const buildLightDps = (on: boolean): string => JSON.stringify({ [DP.light]: on });
export const buildPurifyDps = (on: boolean): string => JSON.stringify({ [DP.purify]: on });
export const buildFreezeDps = (on: boolean): string => JSON.stringify({ [DP.freeze]: on });
