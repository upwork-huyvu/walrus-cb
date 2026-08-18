'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { avatarTone, fmtEpoch, initialOf } from '@/lib/format';
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconFilter,
  IconSearch,
  IconSort,
  IconTrash,
} from './Icons';

const SIZES = [10, 20, 50, 100]; // Tuya chặn page_size ≤ 100 (ListUsersQueryDto)

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
 * Danh sách user + toolbar. Là Client Component vì ô tìm kiếm phải lọc CHÍNH các dòng đang hiển
 * thị, và cột Registered sắp xếp tại chỗ - cả hai buộc phải chung một cây state với bảng.
 *
 * ⚠️ Vì sao lọc ở CLIENT chứ không gọi backend: tham số `username` của Tuya là TRA KHỚP CHÍNH XÁC,
 * trượt thì trả `code=2006 user not exist` → backend hoá 500. Tuya cũng không tra được email/uid.
 * Lọc tại chỗ khớp được cả nickname, username, email, mobile lẫn uid và không bao giờ dựng 500.
 */
export default function UsersBrowser({
  rows,
  page,
  size,
  total,
  hasMore,
}: {
  rows: UserRow[];
  page: number;
  size: number;
  total: number;
  hasMore: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [openFilter, setOpenFilter] = useState(false);
  const [sortDesc, setSortDesc] = useState(true); // mới nhất trước

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle
      ? rows.filter((u) =>
          [u.nick_name, u.username, u.email, u.mobile, u.uid]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(needle)),
        )
      : rows;
    // Sắp xếp bản SAO: rows là prop, đụng vào mảng gốc là mutate props.
    return [...base].sort((a, b) => {
      const d = (a.create_time ?? 0) - (b.create_time ?? 0);
      return sortDesc ? -d : d;
    });
  }, [rows, q, sortDesc]);

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    router.push(`/users?${next.toString()}`);
  };

  const from = shown.length === 0 ? 0 : (page - 1) * size + 1;
  const to = (page - 1) * size + shown.length;
  const lastPage = Math.max(1, Math.ceil((total || 0) / size));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Tuya Users</h1>
          <p className="page-sub">Manage Tuya Cloud users</p>
        </div>
        <Link href="/users/deleted" className="btn btn-sm view-btn">
          <IconTrash />
          Deleted users
        </Link>
      </div>

      <div className="toolbar">
        <div className="search">
          <IconSearch size={17} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by nickname, email or UID..."
            aria-label="Search users"
          />
          {q ? (
            <button
              type="button"
              className="icon-btn clear-btn"
              onClick={() => setQ('')}
              aria-label="Clear search"
              title="Clear search"
            >
              <IconClose size={15} />
            </button>
          ) : null}
        </div>
        <div className="filter-wrap">
          <button
            type="button"
            className={`btn filter-btn${openFilter ? ' on' : ''}`}
            onClick={() => setOpenFilter((v) => !v)}
            aria-expanded={openFilter}
          >
            <IconFilter size={16} />
            Filter
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

      <section className="table-card">
        <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th className="num">Devices</th>
              <th>Status</th>
              <th>
                <button
                  type="button"
                  className="th-sort"
                  onClick={() => setSortDesc((v) => !v)}
                  title={sortDesc ? 'Newest first' : 'Oldest first'}
                >
                  Registered <IconSort size={13} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-cell">
                  {q
                    ? `No user on this page matches “${q}”.`
                    : 'No Tuya users yet — check that the backend is running and TUYA_APP_SCHEMA / Tuya Cloud creds are set.'}
                </td>
              </tr>
            ) : (
              shown.map((u) => {
                const name = u.nick_name || u.username || u.email || u.mobile || 'No name';
                const deviceCount = u.business?.deviceCount ?? 0;
                const active = deviceCount > 0;
                return (
                  <tr
                    key={u.uid}
                    className="row-link"
                    onClick={() => router.push(`/users/${u.uid}`)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') router.push(`/users/${u.uid}`);
                    }}
                  >
                    <td>
                      <div className="user-cell">
                        <span className={`avatar tone-${avatarTone(u.uid)}`}>
                          {u.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.avatar} alt="" />
                          ) : (
                            initialOf(name)
                          )}
                        </span>
                        <div className="user-text">
                          <div className="cell-main" title={name}>
                            {name}
                          </div>
                          <div className="cell-sub">{u.uid}</div>
                        </div>
                      </div>
                    </td>
                    <td className="break">{u.email ?? <span className="muted">—</span>}</td>
                    <td className="num">{deviceCount}</td>
                    <td>
                      {/* ⚠️ Tuya KHÔNG trả trạng thái tài khoản. Suy từ việc có thiết bị hay chưa -
                          nói rõ trong tooltip để người dùng không hiểu là trạng thái thật của Tuya. */}
                      <span
                        className={`badge ${active ? 'success' : ''}`}
                        title="Derived from paired devices — Tuya does not expose an account status"
                      >
                        {active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="cell-main">{fmtEpoch(u.create_time)}</div>
                      <div className="cell-sub">
                        {u.create_time ? fmtEpoch(u.create_time, true).split(', ')[1] : ''}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>

        <div className="table-foot">
          <span className="muted">
            {shown.length === 0
              ? 'No users to show'
              : q
                ? `Showing ${shown.length} of ${rows.length} on this page`
                : `Showing ${from} to ${to} of ${total} users`}
          </span>
          <div className="pager-right">
            <button
              type="button"
              className="icon-btn"
              disabled={page <= 1}
              onClick={() => go({ page: String(page - 1) })}
              aria-label="Previous page"
            >
              <IconChevronLeft />
            </button>
            <PageNumbers page={page} lastPage={lastPage} onGo={(p) => go({ page: String(p) })} />
            <button
              type="button"
              className="icon-btn"
              disabled={!hasMore}
              onClick={() => go({ page: String(page + 1) })}
              aria-label="Next page"
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
            </label>
          </div>
        </div>
      </section>
    </>
  );
}

/** Dãy số trang: 1 2 3 … N. Luôn hiện trang đầu, trang cuối và lân cận trang hiện tại. */
function PageNumbers({
  page,
  lastPage,
  onGo,
}: {
  page: number;
  lastPage: number;
  onGo: (p: number) => void;
}) {
  const nums: (number | '…')[] = [];
  const push = (n: number) => {
    if (n >= 1 && n <= lastPage && !nums.includes(n)) nums.push(n);
  };
  push(1);
  if (page > 3) nums.push('…');
  for (let p = page - 1; p <= page + 1; p++) push(p);
  if (page < lastPage - 2) nums.push('…');
  push(lastPage);

  return (
    <>
      {nums.map((n, i) =>
        n === '…' ? (
          <span key={`gap${i}`} className="page-gap">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            className={`page-num${n === page ? ' on' : ''}`}
            onClick={() => onGo(n)}
            aria-current={n === page ? 'page' : undefined}
          >
            {n}
          </button>
        ),
      )}
    </>
  );
}
