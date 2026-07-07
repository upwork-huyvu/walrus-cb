// Helper hiển thị chung cho trang quản trị (user Tuya trả field thưa - ưu tiên cái nào có).

type NamedUser = {
  nick_name?: string;
  username?: string;
  email?: string;
  mobile?: string;
};

/** Tên hiển thị: nickname → username → email → mobile → placeholder. */
export function displayName(u: NamedUser): string {
  return u.nick_name || u.username || u.email || u.mobile || 'No name';
}

/** Chữ cái đầu cho avatar (bỏ qua placeholder thì trả '?'). */
export function initialOf(name: string): string {
  const c = name.trim().charAt(0);
  return c && name !== 'No name' ? c.toUpperCase() : '?';
}

/**
 * `country_code` của Tuya là MÃ GỌI ĐIỆN (calling code, vd "84"), không phải ISO.
 * Map các mã hay gặp → cờ + tên nước; mã lạ thì trả nguyên dạng `+code`.
 */
const COUNTRY_BY_CALLING_CODE: Record<string, string> = {
  '1': '🇺🇸 US/Canada',
  '7': '🇷🇺 Russia/Kazakhstan',
  '20': '🇪🇬 Egypt',
  '27': '🇿🇦 South Africa',
  '31': '🇳🇱 Netherlands',
  '32': '🇧🇪 Belgium',
  '33': '🇫🇷 France',
  '34': '🇪🇸 Spain',
  '39': '🇮🇹 Italy',
  '40': '🇷🇴 Romania',
  '41': '🇨🇭 Switzerland',
  '43': '🇦🇹 Austria',
  '44': '🇬🇧 United Kingdom',
  '45': '🇩🇰 Denmark',
  '46': '🇸🇪 Sweden',
  '47': '🇳🇴 Norway',
  '48': '🇵🇱 Poland',
  '49': '🇩🇪 Germany',
  '52': '🇲🇽 Mexico',
  '55': '🇧🇷 Brazil',
  '60': '🇲🇾 Malaysia',
  '61': '🇦🇺 Australia',
  '62': '🇮🇩 Indonesia',
  '63': '🇵🇭 Philippines',
  '64': '🇳🇿 New Zealand',
  '65': '🇸🇬 Singapore',
  '66': '🇹🇭 Thailand',
  '81': '🇯🇵 Japan',
  '82': '🇰🇷 South Korea',
  '84': '🇻🇳 Vietnam',
  '86': '🇨🇳 China',
  '90': '🇹🇷 Turkey',
  '91': '🇮🇳 India',
  '351': '🇵🇹 Portugal',
  '353': '🇮🇪 Ireland',
  '358': '🇫🇮 Finland',
  '380': '🇺🇦 Ukraine',
  '420': '🇨🇿 Czechia',
  '852': '🇭🇰 Hong Kong',
  '886': '🇹🇼 Taiwan',
  '966': '🇸🇦 Saudi Arabia',
  '971': '🇦🇪 UAE',
  '972': '🇮🇱 Israel',
};

/** "84" → "🇻🇳 Vietnam"; mã không biết → "+84"; thiếu → null. */
export function countryLabel(code?: string): string | null {
  if (!code) return null;
  const clean = String(code).replace(/^\+/, '');
  return COUNTRY_BY_CALLING_CODE[clean] ?? `+${clean}`;
}

/**
 * Epoch Tuya → chuỗi ngày (giờ VN). Tuya lúc trả giây (10 chữ số), lúc mili-giây -
 * phân biệt theo độ lớn.
 */
export function fmtEpoch(t?: number, withTime = false): string {
  if (!t) return '-';
  const ms = t > 1e12 ? t : t * 1000;
  const opts: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  };
  return new Intl.DateTimeFormat('en-GB', opts).format(new Date(ms));
}
