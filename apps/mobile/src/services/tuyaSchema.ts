// Parse `schemaJson` của Tuya - dùng chung cho dp.ts (suy kiểu DP) và deviceSchema.ts (biên nhiệt độ).
// Tách riêng để hai file kia không phải import lẫn nhau.
//
// Schema về từ native có thể là mảng `[{dpId|id, code, mode, property:{type,min,max,step,scale,unit}}]`
// hoặc object `{"<dpId>": {...}}`. Console Tuya thì dùng `typeSpec` thay cho `property` ⇒ đỡ cả hai.

export type SchemaEntry = { id: string; code: string; entry: Record<string, unknown> };

export function num(v: unknown): number | null {
  if (typeof v === 'number' && !isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return null;
}

/** '℃'/'C' → '°C' cho đồng nhất; còn lại giữ nguyên. */
export function normalizeUnit(unit: string): string {
  const u = unit.trim();
  if (u === '℃' || u === 'C' || u === '°C') return '°C';
  if (u === '℉' || u === 'F' || u === '°F') return '°F';
  return u;
}

function toEntry(id: unknown, o: Record<string, unknown>): SchemaEntry {
  return {
    id: String(id ?? o.dpId ?? o.id ?? o.abilityId ?? ''),
    code: String(o.code ?? ''),
    entry: o,
  };
}

export function schemaEntries(schemaJson: string): SchemaEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(schemaJson || '');
  } catch {
    return [];
  }
  const out: SchemaEntry[] = [];
  if (Array.isArray(parsed)) {
    for (const e of parsed) {
      if (e && typeof e === 'object') out.push(toEntry(null, e as Record<string, unknown>));
    }
    return out;
  }
  if (parsed && typeof parsed === 'object') {
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        out.push(toEntry(/^\d+$/.test(k) ? k : null, o));
      }
    }
  }
  return out;
}

/** Ràng buộc/kiểu có thể ở `property`, `typeSpec`, hoặc thẳng trên entry. */
export function propOf(hit: SchemaEntry | undefined): Record<string, unknown> {
  if (!hit) return {};
  const p = hit.entry.property ?? hit.entry.typeSpec;
  return p && typeof p === 'object' ? (p as Record<string, unknown>) : hit.entry;
}

export const entryFor = (entries: SchemaEntry[], dpId?: string): SchemaEntry | undefined =>
  dpId == null || dpId === '' ? undefined : entries.find((e) => e.id === dpId);

/**
 * dpId → kiểu DP ('raw' | 'value' | 'bool' | 'enum' | 'string' | 'bitmap').
 * Cần để biết DP nào phải decode hex: chuỗi raw có thể toàn chữ số (vd "00280028") nên
 * KHÔNG được đoán kiểu bằng hình dạng chuỗi.
 */
export function dpTypeById(schemaJson: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of schemaEntries(schemaJson)) {
    const p = propOf(e);
    const t = p.type ?? e.entry.type;
    if (e.id && typeof t === 'string' && t) out[e.id] = t.toLowerCase();
  }
  return out;
}
