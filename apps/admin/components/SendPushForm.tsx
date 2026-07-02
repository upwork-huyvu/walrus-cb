'use client';

import { useActionState, useMemo, useState } from 'react';
import { sendPushAction, type SendPushState } from '@/app/notifications/actions';

export type Recipient = { uid: string; label: string };

const initialState: SendPushState = {};

/**
 * Form gửi thông báo FCM TỰ DO (không template): tên (title) + mô tả (body) + cấu hình
 * (người nhận + data điều hướng khi tap). Người nhận: chọn từ danh sách / nhập UID / gửi tất cả.
 */
export default function SendPushForm({ recipients }: { recipients: Recipient[] }) {
  const [state, formAction, pending] = useActionState(sendPushAction, initialState);
  const [mode, setMode] = useState<'select' | 'all'>('select');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const manualUids = useMemo(
    () =>
      manual
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [manual],
  );
  const effectiveUids = useMemo(
    () => Array.from(new Set([...checked, ...manualUids])),
    [checked, manualUids],
  );

  const toggle = (uid: string) =>
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });
  const allInList = recipients.length > 0 && recipients.every((r) => checked.has(r.uid));
  const toggleAllInList = () =>
    setChecked(() => (allInList ? new Set() : new Set(recipients.map((r) => r.uid))));

  const canSend = mode === 'all' || effectiveUids.length > 0;
  const rowLabel = { flexDirection: 'row' as const, gap: 8, alignItems: 'center' };

  return (
    <form action={formAction} className="card" style={{ width: '100%', maxWidth: 560 }}>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="uids" value={JSON.stringify(effectiveUids)} />

      {/* Nội dung tự do */}
      <label>
        Tên thông báo (tiêu đề)
        <input name="title" required maxLength={100} placeholder="Ví dụ: Nhắc vệ sinh bồn" />
      </label>
      <label>
        Mô tả (nội dung)
        <textarea name="body" required rows={3} maxLength={500} placeholder="Nội dung hiển thị trong thông báo…" />
      </label>

      {/* Người nhận */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 18 }}>
          <label style={rowLabel}>
            <input type="radio" checked={mode === 'select'} onChange={() => setMode('select')} />
            Chọn người nhận
          </label>
          <label style={rowLabel}>
            <input type="radio" checked={mode === 'all'} onChange={() => setMode('all')} />
            Gửi tất cả
          </label>
        </div>

        {mode === 'all' ? (
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            ⚠️ Gửi tới <strong>TẤT CẢ</strong> user đã đăng ký nhận thông báo (có FCM token). Backend gửi từng người.
          </p>
        ) : (
          <>
            {recipients.length > 0 ? (
              <div
                className="panel"
                style={{ maxHeight: 200, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                <label style={{ ...rowLabel, color: 'var(--gold)' }}>
                  <input type="checkbox" checked={allInList} onChange={toggleAllInList} />
                  Chọn tất cả trong danh sách ({recipients.length})
                </label>
                {recipients.map((r) => (
                  <label key={r.uid} style={rowLabel}>
                    <input type="checkbox" checked={checked.has(r.uid)} onChange={() => toggle(r.uid)} />
                    {r.label}
                  </label>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                Chưa có user trong danh sách — nhập UID thủ công bên dưới.
              </p>
            )}
            <label>
              Nhập UID thủ công (phẩy / xuống dòng)
              <textarea value={manual} onChange={(e) => setManual(e.target.value)} rows={2} placeholder="ay15..., ay16..." />
            </label>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Đã chọn: <strong>{effectiveUids.length}</strong> người nhận
            </p>
          </>
        )}
      </div>

      {/* Cấu hình nâng cao: điều hướng khi tap noti */}
      <button
        type="button"
        className="ghost"
        onClick={() => setShowAdvanced((s) => !s)}
        style={{ alignSelf: 'flex-start', fontSize: 13 }}
      >
        {showAdvanced ? '▾' : '▸'} Cấu hình nâng cao (điều hướng khi mở)
      </button>
      {showAdvanced ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label>
            Mở màn hình (screen)
            <input name="screen" placeholder="ví dụ: device-detail (để trống = mở app)" />
          </label>
          <label>
            devId (nếu mở màn thiết bị)
            <input name="devId" placeholder="devId của thiết bị" />
          </label>
        </div>
      ) : null}

      {state.error ? <p className="error">{state.error}</p> : null}
      {state.ok ? (
        <p style={{ color: state.failed ? 'var(--warning)' : 'var(--success)', fontSize: 13, margin: 0 }}>
          {state.failed
            ? `Đã gửi ${state.success}/${state.total} · ${state.failed} không nhận được`
            : `✅ Đã gửi ${state.success}/${state.total} thành công`}
        </p>
      ) : null}

      <button className="primary" type="submit" disabled={pending || !canSend}>
        {pending ? 'Đang gửi…' : 'Gửi thông báo'}
      </button>
    </form>
  );
}
