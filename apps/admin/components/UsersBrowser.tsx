'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { countryLabel, fmtEpoch, initialOf } from '@/lib/format';
import CopyButton from './CopyButton';
import DeleteUserRowButton from './DeleteUserRowButton';
import {
  IconCalendar,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDevice,
  IconEye,
  IconFilter,
  IconGlobe,
  IconSearch,
  IconUsers,
} from './Icons';

const SIZES = [10, 20, 50, 100]; // Tuya chặn page_size ≤ 100 (ListUsersQueryDto)

/** Component không serialize được qua ranh giới server→client, nên server gửi KHOÁ rồi tra ở đây. */
const STAT_ICONS = {
  users: IconUsers,
  device: IconDevice,
  calendar: IconCalendar,
  globe: IconGlobe,
} as const;

export type Stat = {
  key: string;
  label: string;
  value: number | string;
  hint: string;
  icon: keyof typeof STAT_ICONS;
  tone: 'gold' | 'green' | 'violet' | 'blue';
};

export type UserRow = {
  uid: string;
  username?: string;
  email?: string;
  mobile?: string;
  country_code?: string;
  create_time?: number;
  nick_name?: string;
  avatar?: string;
  business?: { deviceCount?: number };
};

/**
 * Toolbar + bảng user. Là Client Component vì ô tìm kiếm phải lọc CHÍNH các dòng đang hiển thị -
 * hai thứ đó buộc phải chung một cây state.
 *
 * ⚠️ Vì sao lọc ở CLIENT chứ không gọi backend:
 * Tuya có tham số `username` nhưng nó là TRA KHỚP CHÍNH XÁC, và khi không khớp thì trả LỖI
 * `code=2006 msg=user not exist` → backend hoá 500. Gõ dở chừng là mỗi ký tự một cú 500. Tuya cũng
 * không tra được email/uid. Nên lọc tại chỗ trên trang đang tải: khớp cả username, nick name, email,
 * mobile lẫn uid, không round-trip, và không bao giờ dựng lên một cú 500.
 * Đổi lại: chỉ lọc trong phạm vi trang hiện tại → tăng "rows per page" nếu cần quét rộng hơn.
 */
export default function UsersBrowser({
  rows,
  page,
  size,
  total,
  hasMore,
  stats,
}: {
  rows: UserRow[];
  page: number;
  size: number;
  total: number;
  hasMore: boolean;
  stats: Stat[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [openFilter, setOpenFilter] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((u) =>
      [u.username, u.nick_name, u.email, u.mobile, u.uid]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [rows, q]);

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    router.push(`/users?${next.toString()}`);
  };

  const from = filtered.length === 0 ? 0 : (page - 1) * size + 1;
  const to = (page - 1) * size + filtered.length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Tuya users</h1>
          <p className="page-sub">
            Source: Tuya Cloud (end users registered via the app) · merged with business data from
            Supabase
          </p>
        </div>
        <div className="toolbar">
          <div className="search">
          <IconSearch size={17} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users, email, user ID..."
            aria-label="Search users"
          />
        </div>
        <div className="filter-wrap">
          <button
            type="button"
            className={`icon-btn lg${openFilter ? ' on' : ''}`}
            onClick={() => setOpenFilter((v) => !v)}
            aria-expanded={openFilter}
            aria-label="Filters"
            title="Filters"
          >
            <IconFilter size={17} />
          </button>
          {openFilter ? (
            <div className="filter-pop">
              <div className="filter-row">
                <span className="muted">Rows per page</span>
                <div className="seg">
                  {SIZES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`seg-btn${size === s ? ' on' : ''}`}
                      onClick={() => go({ size: String(s), page: null })}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <p className="filter-note">
                Search filters the {rows.length} user{rows.length === 1 ? '' : 's'} on this page —
                Tuya cannot search by email or user ID, so raise the rows per page to widen the net.
              </p>
            </div>
          ) : null}
          </div>
        </div>
      </div>

      <section className="stat-grid">
        {stats.map(({ key, label, value, hint, icon, tone }) => {
          const Icon = STAT_ICONS[icon];
          return (
            <div key={key} className="stat-card">
              <span className={`stat-ico ${tone}`}>
                <Icon size={19} />
              </span>
              <div className="stat-body">
                <div className="stat-label">{label}</div>
                <div className="stat-value">{value}</div>
                <div className="stat-hint">{hint}</div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <span className="th-sort">
                  User <IconChevronDown size={13} />
                </span>
              </th>
              <th>Contact</th>
              <th>Country</th>
              <th>Registered</th>
              <th className="num">Devices</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-cell">
                  {q
                    ? `No user on this page matches “${q}”.`
                    : 'No Tuya users yet — check that the backend is running and TUYA_APP_SCHEMA / Tuya Cloud creds are set.'}
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const account = u.username ?? u.email ?? u.mobile ?? 'No name';
                const contact = u.email ?? u.mobile;
                const deviceCount = u.business?.deviceCount ?? 0;
                const time = u.create_time ? fmtEpoch(u.create_time, true).split(', ')[1] : '';
                return (
                  <tr key={u.uid}>
                    <td>
                      <div className="user-cell">
                        <span className="avatar">
                          {u.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.avatar} alt="" />
                          ) : (
                            initialOf(u.nick_name || account)
                          )}
                        </span>
                        <div className="user-text">
                          <div className="cell-main" title={account}>
                            <Link href={`/users/${u.uid}`}>{account}</Link>
                          </div>
                          <div className="cell-sub">{u.uid}</div>
                        </div>
                        <CopyButton value={u.uid} label="user ID" />
                      </div>
                    </td>
                    <td className="break">{contact ?? <span className="muted">—</span>}</td>
                    <td title={u.country_code ? `+${u.country_code}` : undefined}>
                      {countryLabel(u.country_code) ?? <span className="muted">—</span>}
                    </td>
                    <td>
                      <div className="cell-main">{fmtEpoch(u.create_time)}</div>
                      <div className="cell-sub">{time}</div>
                    </td>
                    <td className="num">
                      {deviceCount > 0 ? (
                        <span className="badge gold">{deviceCount}</span>
                      ) : (
                        <span className="muted">0</span>
                      )}
                    </td>
                    <td className="right">
                      <div className="row-actions">
                        <Link href={`/users/${u.uid}`} className="btn btn-sm view-btn">
                          <IconEye />
                          View details
                        </Link>
                        <DeleteUserRowButton uid={u.uid} name={account} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="table-foot">
          <span className="muted">
            {filtered.length === 0
              ? 'No users to show'
              : q
                ? `Showing ${filtered.length} of ${rows.length} on this page`
                : `Showing ${from} to ${to} of ${total} users`}
          </span>
          <div className="pager-right">
            <button
              type="button"
              className="icon-btn"
              disabled={page <= 1}
              onClick={() => go({ page: String(page - 1) })}
              aria-label="Previous page"
              title="Previous page"
            >
              <IconChevronLeft />
            </button>
            <span className="page-num">{page}</span>
            <button
              type="button"
              className="icon-btn"
              disabled={!hasMore}
              onClick={() => go({ page: String(page + 1) })}
              aria-label="Next page"
              title="Next page"
            >
              <IconChevronRight />
            </button>
            <label className="page-size">
              <select
                value={SIZES.includes(size) ? size : 10}
                onChange={(e) => go({ size: e.target.value, page: null })}
                aria-label="Rows per page"
              >
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s} / page
                  </option>
                ))}
              </select>
              <IconChevronDown />
            </label>
          </div>
        </div>
      </section>
    </>
  );
}
