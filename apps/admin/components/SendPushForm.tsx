'use client';

import { useActionState, useMemo, useState } from 'react';
import { sendPushAction, type SendPushState } from '@/app/notifications/actions';
import { initialOf } from '@/lib/format';

export type Recipient = {
  uid: string;
  email?: string;
  username?: string; // username / nick_name (fallback khi không có email)
  avatar?: string;
};

const initialState: SendPushState = {};

/**
 * Gửi thông báo free-form. Người nhận chọn từ BẢNG user (avatar + email/username + Tuya ID) có search.
 * provider=fcm → thêm Image URL + Deeplink (format chuẩn FCM). Router backend chọn Tuya | FCM theo ENV.
 */
export default function SendPushForm({
  recipients,
  provider,
}: {
  recipients: Recipient[];
  provider?: string;
}) {
  const isFcm = provider === 'fcm';
  const [state, formAction, pending] = useActionState(sendPushAction, initialState);
  const [mode, setMode] = useState<'select' | 'all'>('select');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const nameOf = (r: Recipient) => r.email || r.username || r.uid;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter(
      (r) =>
        r.uid.toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.username ?? '').toLowerCase().includes(q),
    );
  }, [recipients, query]);

  const effectiveUids = useMemo(() => Array.from(checked), [checked]);

  const toggle = (uid: string) =>
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });

  const allFilteredChecked = filtered.length > 0 && filtered.every((r) => checked.has(r.uid));
  const toggleAllFiltered = () =>
    setChecked((prev) => {
      const n = new Set(prev);
      if (allFilteredChecked) filtered.forEach((r) => n.delete(r.uid));
      else filtered.forEach((r) => n.add(r.uid));
      return n;
    });

  const canSend = mode === 'all' || effectiveUids.length > 0;
  const rowLabel = { flexDirection: 'row' as const, gap: 8, alignItems: 'center' };

  return (
    <form action={formAction} className="card" style={{ width: '100%' }}>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="uids" value={JSON.stringify(effectiveUids)} />

      {/* Nội dung free-form. TUYA: map vào template ${title}/${content} (giới hạn ngắn).
          FCM: title/body + ảnh + deeplink (format chuẩn FCM). */}
      <label>
        Title
        <input name="title" required maxLength={isFcm ? 100 : 40} placeholder="e.g. Time to clean your tub" />
      </label>
      <label>
        Description (body)
        <textarea name="body" required rows={3} maxLength={isFcm ? 500 : 100} placeholder="Notification text shown to the user…" />
      </label>

      {isFcm ? (
        <>
          <label>
            Image URL (optional)
            <input name="imageUrl" type="url" maxLength={2048} placeholder="https://…/banner.png" />
          </label>
          <label>
            Deeplink - screen to open on tap (optional)
            <select name="screen" defaultValue="">
              <option value="">Default (Notifications)</option>
              <option value="notifications">Notifications</option>
              <option value="device-detail">Device detail</option>
              <option value="progress">Tracking / Progress</option>
              <option value="shop">Shop</option>
            </select>
          </label>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            FCM: title + body là text thuần (không HTML); dùng <strong>image</strong> cho ảnh lớn và{' '}
            <strong>deeplink</strong> để mở màn khi tap. Nội dung HTML/rich hiển thị trong app qua data payload.
          </p>
        </>
      ) : null}

      {/* Người nhận */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 18 }}>
          <label style={rowLabel}>
            <input type="radio" checked={mode === 'select'} onChange={() => setMode('select')} />
            Choose recipients
          </label>
          <label style={rowLabel}>
            <input type="radio" checked={mode === 'all'} onChange={() => setMode('all')} />
            Send to all
          </label>
        </div>

        {mode === 'all' ? (
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            ⚠️ Sends to <strong>ALL</strong>{' '}
            {isFcm ? 'users with a registered device (FCM token)' : 'Tuya users'} - one by one.
          </p>
        ) : (
          <>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by email, username or Tuya ID…"
            />
            <div className="panel" style={{ maxHeight: 380, overflow: 'auto', padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>
                      <input
                        type="checkbox"
                        checked={allFilteredChecked}
                        onChange={toggleAllFiltered}
                        aria-label="Select all shown"
                      />
                    </th>
                    <th>User</th>
                    <th>Tuya ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="muted">
                        {recipients.length === 0
                          ? 'No users found - check the backend / Tuya Cloud creds.'
                          : `No users match “${query}”.`}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => {
                      const name = nameOf(r);
                      const sub = r.email && r.username && r.email !== r.username ? r.username : null;
                      return (
                        <tr key={r.uid} onClick={() => toggle(r.uid)} style={{ cursor: 'pointer' }}>
                          <td>
                            <input type="checkbox" checked={checked.has(r.uid)} readOnly />
                          </td>
                          <td>
                            <div className="user-cell">
                              <span className="avatar">
                                {r.avatar ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={r.avatar} alt="" />
                                ) : (
                                  initialOf(name)
                                )}
                              </span>
                              <div>
                                <div className="cell-main">{name}</div>
                                {sub ? <div className="cell-sub">{sub}</div> : null}
                              </div>
                            </div>
                          </td>
                          <td className="cell-sub" title={r.uid}>
                            {r.uid}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Selected: <strong>{checked.size}</strong> · Showing {filtered.length} of {recipients.length}
            </p>
          </>
        )}
      </div>

      {state.error ? <p className="error">{state.error}</p> : null}
      {state.ok ? (
        <p style={{ color: state.failed ? 'var(--warning)' : 'var(--success)', fontSize: 13, margin: 0 }}>
          {state.failed
            ? `Sent ${state.success}/${state.total} · ${state.failed} not delivered`
            : `✅ Sent ${state.success}/${state.total} successfully`}
        </p>
      ) : null}

      <button className="primary" type="submit" disabled={pending || !canSend}>
        {pending ? 'Sending…' : 'Send notification'}
      </button>
    </form>
  );
}
