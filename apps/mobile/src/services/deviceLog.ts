// Log chi tiết thiết bị (getDeviceSnapshot) để ĐỐI CHIẾU DP THẬT của bồn.
//
// Vì sao cần: app từng hardcode DP id (dp.ts placeholder). Muốn map đúng thì phải biết thiết bị thật
// khai báo dpId/code/kiểu gì - cái đó chỉ lộ ra khi đọc snapshot trên máy thật.
//
// Nội dung log là TIẾNG ANH (gửi cho khách/Tuya support được); comment vẫn tiếng Việt.
//
// ĐỌC LOG (không cần Metro):
//   iOS:     Xcode → Window → Devices → Console, lọc "[DEVICE]"
//   Android: adb logcat -s ReactNativeJS | grep DEVICE
//
// Chỉ chạy khi __DEV__ (không lọt bản release).
import { parseDpCodes, type DpMap } from './dp';

type SnapshotLike = {
  devId?: string;
  productId?: string;
  isOnline?: boolean;
  isLocalOnline?: boolean;
  dpsJson?: string;
  schemaJson?: string;
  dpCodesJson?: string;
  /** Toàn bộ device model SDK trả về (name/mac/verSw/homeId/dpsTime/...). */
  rawJson?: string;
};

const isDev = (): boolean => typeof __DEV__ !== 'undefined' && __DEV__;

/**
 * Log MỌI lần gọi readDevice - kể cả khi bail sang mock.
 * Vì sao cần: `logDeviceSnapshot` nằm SAU `shouldMock()`, nên nếu devId rỗng / native vắng thì
 * không có log nào chạy ⇒ tưởng "log hỏng", thực ra là chưa tới được thiết bị thật.
 */
export function logDeviceReadAttempt(devId: string, nativeAvailable: boolean, isMock: boolean): void {
  if (!isDev()) return;
  const usingMock = !nativeAvailable || !devId || isMock;
  const reason = !nativeAvailable
    ? 'native SDK MISSING (native not built / Metro-only run)'
    : !devId
      ? 'devId is EMPTY - no device selected yet (not paired, or not opened from Device List)'
      : isMock
        ? 'devId is a FAKE device (MOCK_DEVICES)'
        : 'reading a REAL device';
  console.log('[DEVICE] readDevice()', {
    devId: devId || '(empty)',
    nativeAvailable,
    isMockDevId: isMock,
    usingMock,
    reason,
  });
}

/** Log danh sách thiết bị của home - nơi thấy thiết bị đã pair (kể cả pair bằng app Smart Life). */
export function logHomeDevices(
  homeId: number,
  devices: Array<{ devId: string; name: string; productId: string; isOnline: boolean }>,
): void {
  if (!isDev()) return;
  console.log(`[DEVICE] home ${homeId} → ${devices.length} device(s)`);
  if (devices.length === 0) {
    console.log('[DEVICE]   (empty - this home has no device on the signed-in Tuya account)');
    return;
  }
  for (const d of devices) {
    console.log(`[DEVICE]   ${d.devId} · ${d.name} · pid=${d.productId} · online=${d.isOnline}`);
  }
}

/**
 * Log realtime mỗi khi thiết bị báo DP đổi (onDeviceStatus).
 * Đây là công cụ để CHỐT nghĩa các DP custom: thao tác trên app Smart Life rồi xem DP nào đổi.
 * Với DP raw (hex) in kèm các word 16-bit đã tách để thấy ngay slot nào thay đổi.
 */
export function logDpUpdate(devId: string, dpsJson: string, codeById: Record<string, string>): void {
  if (!isDev()) return;
  const dps = safeParse(dpsJson);
  if (!dps || typeof dps !== 'object') return;
  for (const [dpId, value] of Object.entries(dps as Record<string, unknown>)) {
    const code = codeById[dpId] ?? '(unknown)';
    let extra = '';
    // Hex chẵn word → tách 16-bit để đối chiếu slot (vd setting_temp "00280028ffff…").
    if (typeof value === 'string' && value.length >= 4 && value.length % 4 === 0 && /^[0-9a-fA-F]+$/.test(value)) {
      const words: string[] = [];
      for (let i = 0; i < value.length; i += 4) {
        const w = parseInt(value.slice(i, i + 4), 16);
        words.push(w === 0xffff ? '–' : String(w >= 0x8000 ? w - 0x10000 : w));
      }
      extra = `  → slots [${words.join(', ')}]`;
    }
    console.log(`[DEVICE] dp update ${devId} · ${dpId} · ${code} = ${JSON.stringify(value)}${extra}`);
  }
}

function safeParse(json: string | undefined): unknown {
  try {
    return JSON.parse(json || '');
  } catch {
    return null;
  }
}

/** {dpId: value} + map code → gộp thành bảng dễ đọc: dpId · code · value · typeof. */
function describeDps(dpsJson: string | undefined, codeById: Record<string, string>) {
  const dps = safeParse(dpsJson);
  if (!dps || typeof dps !== 'object') return [];
  return Object.entries(dps as Record<string, unknown>).map(([dpId, value]) => ({
    dpId,
    code: codeById[dpId] ?? '(unknown)',
    value,
    type: typeof value,
  }));
}

/**
 * In toàn bộ thông tin thiết bị + DP. Gọi sau mỗi lần đọc snapshot.
 * `map` = mapping app đang DÙNG (đã resolve) → so được với DP thật để biết có khớp không.
 */
export function logDeviceSnapshot(snap: SnapshotLike | null | undefined, map: DpMap): void {
  if (!isDev() || !snap) return;

  // dpCodes trả về dạng code→id; đảo lại thành id→code để tra khi in từng DP.
  const byCode = parseDpCodes(snap.dpCodesJson ?? '');
  const codeById: Record<string, string> = {};
  for (const [code, id] of Object.entries(byCode)) codeById[id] = code;

  const dpRows = describeDps(snap.dpsJson, codeById);
  const raw = safeParse(snap.rawJson);
  const name = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).name : undefined;

  console.log(`[DEVICE] ═════ snapshot: ${String(name ?? snap.devId ?? '?')} ═════`);
  console.log('[DEVICE] info', {
    devId: snap.devId,
    productId: snap.productId,
    isOnline: snap.isOnline,
    isLocalOnline: snap.isLocalOnline,
    dpCount: dpRows.length,
  });

  // Bảng DP hiện tại: đây là thứ cần để chốt mapping.
  if (dpRows.length > 0) {
    console.log('[DEVICE] data points (dpId · code · value · type):');
    for (const r of dpRows) {
      console.log(`[DEVICE]   ${r.dpId} · ${r.code} · ${JSON.stringify(r.value)} (${r.type})`);
    }
  } else {
    console.log('[DEVICE] data points: (empty - device has not reported any DP yet)');
  }

  // Schema từng DP: kiểu + biên (min/max/step/scale/unit) - cần để render đúng và biết DP nào ghi được.
  const schema = safeParse(snap.schemaJson);
  if (Array.isArray(schema) && schema.length > 0) {
    console.log('[DEVICE] schema (dpId · code · type · mode · constraints):');
    for (const e of schema as Array<Record<string, any>>) {
      const p = (e.property ?? {}) as Record<string, any>;
      const range =
        p.min != null || p.max != null
          ? `min=${p.min} max=${p.max} step=${p.step} scale=${p.scale}${p.unit ? ` ${p.unit}` : ''}`
          : Array.isArray(p.range) && p.range.length > 0
            ? `range=${JSON.stringify(p.range)}`
            : '';
      console.log(
        `[DEVICE]   ${e.dpId} · ${e.code} · ${p.type ?? e.type ?? '?'} · ${e.mode ?? '?'} ${range}`,
      );
    }
  } else {
    console.log('[DEVICE] schemaJson', snap.schemaJson || '(empty)');
  }

  // Mapping app đang dùng: nếu id nào KHÔNG có trong dps ⇒ đang map sai (còn dính placeholder).
  const known = new Set(dpRows.map((r) => r.dpId));
  console.log('[DEVICE] mapping currently used by the app:');
  for (const [fn, dpId] of Object.entries(map)) {
    console.log(
      `[DEVICE]   ${fn} → dp ${dpId} ${known.has(dpId) ? '✓ present in dps' : '✗ MISSING (wrong / placeholder)'}`,
    );
  }

  // Toàn bộ device model SDK trả về - name/mac/verSw/homeId/dpsTime/... để đối chiếu khi cần.
  if (raw && typeof raw === 'object') {
    console.log('[DEVICE] device model (raw from Tuya SDK):');
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      console.log(`[DEVICE]   ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
    }
  } else {
    console.log('[DEVICE] rawJson', snap.rawJson || '(empty - native did not return it)');
  }

  console.log('[DEVICE] dpCodesJson', snap.dpCodesJson || '(empty)');
  console.log('[DEVICE] ══════════════════════════════');
}
