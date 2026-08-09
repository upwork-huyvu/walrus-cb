import { apiGet } from '@/lib/api';
import { countryLabel } from '@/lib/format';
import UsersBrowser, { type Stat, type UserRow } from '@/components/UsersBrowser';

export const dynamic = 'force-dynamic';

type ListResponse = {
  list: UserRow[];
  total: number;
  has_more: boolean;
  page_no: number;
  page_size: number;
};

const DEFAULT_SIZE = 10;
const THIRTY_DAYS = 30 * 24 * 3600;

/** Epoch Tuya lúc giây lúc mili-giây → luôn quy về giây để so sánh khoảng thời gian. */
function toSeconds(t?: number): number | null {
  if (!t) return null;
  return t > 1e12 ? Math.floor(t / 1000) : t;
}

/**
 * Đếm user đăng ký trong 30 ngày gần nhất. Tách khỏi thân component vì `Date.now()` không thuần -
 * gọi thẳng trong render bị rule react-hooks/purity chặn, dù ở Server Component `force-dynamic`
 * thì đọc giờ hiện tại là hợp lệ.
 */
function countRecent(rows: { create_time?: number }[]): number {
  const nowSec = Math.floor(Date.now() / 1000);
  return rows.filter((u) => {
    const t = toSeconds(u.create_time);
    return t != null && nowSec - t <= THIRTY_DAYS;
  }).length;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const size = Math.min(100, Math.max(1, Number(sp.size ?? DEFAULT_SIZE) || DEFAULT_SIZE));

  // KHÔNG truyền `username` sang backend: tham số đó của Tuya là tra khớp CHÍNH XÁC và trả
  // `code=2006 user not exist` khi trượt → backend hoá 500. Lọc làm ở client (xem UsersBrowser).
  const data = await apiGet<ListResponse>(`/users?page_no=${page}&page_size=${size}`);
  const rows = data.list ?? [];

  // ⚠️ Thẻ thống kê tính trên TRANG HIỆN TẠI, trừ "Total users" lấy từ `total` của API. Tuya không
  // có endpoint tổng hợp; cộng hết mọi trang thì mỗi lần mở trang phải quét toàn bộ user.
  const totalDevices = rows.reduce((n, u) => n + (u.business?.deviceCount ?? 0), 0);
  const countries = new Set(
    rows.map((u) => u.country_code).filter((c): c is string => Boolean(c)),
  );
  // Đúng 1 nước → hiện tên nước thay cho dòng phụ chung chung (bỏ emoji cờ, giữ phần chữ).
  const onlyCountry =
    countries.size === 1 ? countryLabel([...countries][0])?.replace(/^\S+\s/, '') : null;

  const stats: Stat[] = [
    {
      key: 'users',
      label: 'Total users',
      value: data.total ?? rows.length,
      hint: 'All Tuya users',
      icon: 'users',
      tone: 'gold',
    },
    {
      key: 'devices',
      label: 'Total devices',
      value: totalDevices,
      hint: 'Connected devices',
      icon: 'device',
      tone: 'green',
    },
    {
      key: 'recent',
      label: 'Recently registered',
      value: countRecent(rows),
      hint: 'In the last 30 days',
      icon: 'calendar',
      tone: 'violet',
    },
    {
      key: 'countries',
      label: 'Countries',
      value: countries.size,
      hint: onlyCountry ?? 'Across all users',
      icon: 'globe',
      tone: 'blue',
    },
  ];

  return (
    <main className="page-wide">
      {/* Header + stats + bảng đều nằm trong UsersBrowser: ô tìm kiếm ở header phải chung state
          với bảng mà nó lọc, nên cả cụm buộc phải ở cùng một cây Client Component. */}
      <UsersBrowser
        rows={rows}
        page={page}
        size={size}
        total={data.total ?? rows.length}
        hasMore={Boolean(data.has_more)}
        stats={stats}
      />
    </main>
  );
}
