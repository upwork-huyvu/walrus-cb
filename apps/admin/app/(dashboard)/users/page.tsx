import { apiGet } from '@/lib/api';
import UsersBrowser, { type UserRow } from '@/components/UsersBrowser';

export const dynamic = 'force-dynamic';

type ListResponse = {
  list: UserRow[];
  total: number;
  has_more: boolean;
  page_no: number;
  page_size: number;
};

const DEFAULT_SIZE = 10;

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

  return (
    <main className="page-wide">
      {/* Header + bảng nằm trong UsersBrowser: ô tìm kiếm và cột sắp xếp phải chung state với
          bảng mà chúng tác động. */}
      <UsersBrowser
        rows={data.list ?? []}
        page={page}
        size={size}
        total={data.total ?? (data.list ?? []).length}
        hasMore={Boolean(data.has_more)}
      />
    </main>
  );
}
