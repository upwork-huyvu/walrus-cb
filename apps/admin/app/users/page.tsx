import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { countryLabel, fmtEpoch, initialOf } from '@/lib/format';
import DeleteUserRowButton from '@/components/DeleteUserRowButton';

export const dynamic = 'force-dynamic';

type UserRow = {
  uid: string;
  username?: string;
  email?: string;
  mobile?: string;
  country_code?: string;
  create_time?: number;
  // backend enrich từ endpoint detail của Tuya (list gốc không có)
  nick_name?: string;
  avatar?: string;
  business?: { deviceCount?: number };
};

type ListResponse = {
  list: UserRow[];
  total: number;
  has_more: boolean;
  page_no: number;
  page_size: number;
};

const PAGE_SIZE = 20;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const data = await apiGet<ListResponse>(
    `/users?page_no=${page}&page_size=${PAGE_SIZE}`,
  );

  return (
    <main>
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Tuya users</h1>
        <p className="page-sub">
          Source: Tuya Cloud (end users registered via the app) · merged with business data from Supabase
        </p>
      </div>

      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Contact</th>
            <th>Country</th>
            <th>Registered</th>
            <th className="num">Devices</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.list.length === 0 ? (
            <tr>
              <td colSpan={6} className="muted">
                No Tuya users yet — check that the backend is running and TUYA_APP_SCHEMA / Tuya Cloud creds are set.
              </td>
            </tr>
          ) : (
            data.list.map((u) => {
              const account = u.username ?? u.email ?? u.mobile ?? 'No name';
              const contact = u.email ?? u.mobile;
              const deviceCount = u.business?.deviceCount ?? 0;
              return (
                <tr key={u.uid}>
                  <td>
                    <div className="user-cell">
                      <span className="avatar">
                        {u.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatar} alt="" />
                        ) : (
                          initialOf(account)
                        )}
                      </span>
                      <div>
                        <div className="cell-main">
                          <Link href={`/users/${u.uid}`}>{account}</Link>
                        </div>
                        <div className="cell-sub" title={u.uid}>
                          {u.uid}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{contact ?? <span className="muted">—</span>}</td>
                  <td title={u.country_code ? `+${u.country_code}` : undefined}>
                    {countryLabel(u.country_code) ?? (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>{fmtEpoch(u.create_time)}</td>
                  <td className="num">
                    {deviceCount > 0 ? (
                      <span className="badge gold">{deviceCount}</span>
                    ) : (
                      <span className="muted">0</span>
                    )}
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
                      <Link href={`/users/${u.uid}`}>Details</Link>
                      <DeleteUserRowButton uid={u.uid} name={account} />
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <div className="pager">
        {page > 1 ? (
          <Link href={`/users?page=${page - 1}`}>← Prev</Link>
        ) : (
          <span className="muted">← Prev</span>
        )}
        <span className="muted">Page {page}</span>
        {data.has_more ? (
          <Link href={`/users?page=${page + 1}`}>Next →</Link>
        ) : (
          <span className="muted">Next →</span>
        )}
        <span className="muted">· Total {data.total}</span>
      </div>
    </main>
  );
}
