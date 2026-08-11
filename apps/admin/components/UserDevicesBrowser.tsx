'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { fmtEpoch } from '@/lib/format';
import CopyButton from './CopyButton';
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconDevice,
  IconSearch,
  IconSort,
} from './Icons';

const SIZES = [10, 20, 50];

/** Khớp `AdminUserDeviceItem` của backend (devices.service.ts). */
export type UserDevice = {
  id: string;
  name: string;
  online: boolean;
  productId?: string;
  productName?: string;
  currentTemp: number | null;
  targetTemp: number | null;
  timeZone?: string;
  createTime?: number;
  updateTime?: number;
  activeTime?: number;
};

type SortKey = 'name' | 'product' | 'status';

/**
 * Bảng "All devices" của một user. Toàn bộ lọc/sắp xếp/phân trang làm ở CLIENT: backend trả về
 * trọn danh sách thiết bị của user (thường vài cái), nên chia trang phía server chỉ tổ thêm
 * round-trip mà không tiết kiệm gì.
 */
export default function UserDevicesBrowser({
  uid,
  ownerName,
  devices,
  unit,
}: {
  uid: string;
  ownerName: string;
  devices: UserDevice[] | null;
  unit: string;
}) {
  const [q, setQ] = useState('');
  const [size, setSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'name',
    desc: false,
  });

  // useMemo để `rows` giữ nguyên tham chiếu giữa các lần render - nếu viết `devices ?? []` trực
  // tiếp thì mỗi render tạo mảng mới, làm useMemo bên dưới tính lại vô ích.
  const rows = useMemo(() => devices ?? [], [devices]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle
      ? rows.filter((d) =>
          [d.name, d.id, d.productName, d.productId]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(needle)),
        )
      : rows;
    const dir = sort.desc ? -1 : 1;
    return [...base].sort((a, b) => {
      if (sort.key === 'status') return (Number(b.online) - Number(a.online)) * dir;
      const av = (sort.key === 'name' ? a.name : (a.productName ?? '')) || '';
      const bv = (sort.key === 'name' ? b.name : (b.productName ?? '')) || '';
      return av.localeCompare(bv) * dir;
    });
  }, [rows, q, sort]);

  const lastPage = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, lastPage);
  const slice = filtered.slice((safePage - 1) * size, safePage * size);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * size + 1;
  const to = (safePage - 1) * size + slice.length;

  const toggle = (key: SortKey) =>
    setSort((s) => ({ key, desc: s.key === key ? !s.desc : false }));

  return (
    <>
      <Link href={`/users/${uid}`} className="back-link">
        <IconArrowLeft />
        Back to user detail
      </Link>

      <div className="page-head">
        <div>
          <h1 className="page-title">All Devices</h1>
          <p className="page-sub">
            All devices of {ownerName} ({uid})
          </p>
        </div>
        <div className="toolbar">
          <div className="search">
            <IconSearch size={17} />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search by device name, ID or product..."
              aria-label="Search devices"
            />
          </div>
          <span className="count-chip">
            {rows.length} device{rows.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <section className="table-card">
        <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <button type="button" className="th-sort" onClick={() => toggle('name')}>
                  Device Name <IconSort size={13} />
                </button>
              </th>
              <th>Device ID</th>
              <th>
                <button type="button" className="th-sort" onClick={() => toggle('product')}>
                  Product <IconSort size={13} />
                </button>
              </th>
              <th>
                <button type="button" className="th-sort" onClick={() => toggle('status')}>
                  Status <IconSort size={13} />
                </button>
              </th>
              <th className="num">Current Temp.</th>
              <th className="num">Target Temp.</th>
              <th>Time Zone</th>
              <th>Created At</th>
              <th>Updated At</th>
            </tr>
          </thead>
          <tbody>
            {devices === null ? (
              <tr>
                <td colSpan={9} className="empty-cell">
                  Couldn’t load devices from Tuya — try again in a moment.
                </td>
              </tr>
            ) : slice.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-cell">
                  {q ? `No device matches “${q}”.` : 'This user has no paired device yet.'}
                </td>
              </tr>
            ) : (
              slice.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="user-cell">
                      <span className="device-thumb sm">
                        <IconDevice size={17} />
                      </span>
                      <Link href={`/devices/${d.id}`} className="cell-main">
                        {d.name || 'Device'}
                      </Link>
                    </div>
                  </td>
                  <td>
                    <span className="kv-copy mono-id">
                      {d.id}
                      <CopyButton value={d.id} label="device ID" />
                    </span>
                  </td>
                  <td>{d.productName ?? <span className="muted">—</span>}</td>
                  <td>
                    <span className="status-inline">
                      <i className={`dot ${d.online ? 'online' : 'offline'}`} />
                      {d.online ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className="num">
                    <span className="temp-cell">
                      {d.currentTemp == null ? '—' : d.currentTemp} <em>{unit}</em>
                    </span>
                  </td>
                  <td className="num">
                    <span className="temp-cell gold">
                      {d.targetTemp == null ? '—' : d.targetTemp} <em>{unit}</em>
                    </span>
                  </td>
                  <td>{d.timeZone ?? <span className="muted">—</span>}</td>
                  <td>{d.createTime ? fmtEpoch(d.createTime, true) : <span className="muted">—</span>}</td>
                  <td>{d.updateTime ? fmtEpoch(d.updateTime, true) : <span className="muted">—</span>}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>

        <div className="table-foot">
          <span className="muted">
            {filtered.length === 0
              ? 'No devices to show'
              : `Showing ${from} to ${to} of ${filtered.length} devices`}
          </span>
          <div className="pager-right">
            <button
              type="button"
              className="icon-btn"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              aria-label="Previous page"
            >
              <IconChevronLeft />
            </button>
            <span className="page-num on">{safePage}</span>
            <button
              type="button"
              className="icon-btn"
              disabled={safePage >= lastPage}
              onClick={() => setPage(safePage + 1)}
              aria-label="Next page"
            >
              <IconChevronRight />
            </button>
            <label className="page-size">
              <select
                value={size}
                onChange={(e) => {
                  setSize(Number(e.target.value));
                  setPage(1);
                }}
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
