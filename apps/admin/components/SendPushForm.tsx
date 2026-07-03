'use client';

import { useActionState, useMemo, useState } from 'react';
import { sendPushAction, type SendPushState } from '@/app/notifications/actions';

export type Recipient = { uid: string; label: string };

const initialState: SendPushState = {};

/**
 * Free-form notification form: title + description + recipients. Sends via Tuya App Push —
 * title/description map to the approved template's ${title}/${content}. No template picker.
 */
export default function SendPushForm({ recipients }: { recipients: Recipient[] }) {
  const [state, formAction, pending] = useActionState(sendPushAction, initialState);
  const [mode, setMode] = useState<'select' | 'all'>('select');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState('');

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

      {/* Free-form content (mapped to template ${title}/${content}) */}
      <label>
        Title
        <input name="title" required maxLength={40} placeholder="e.g. Time to clean your tub" />
      </label>
      <label>
        Description (body)
        <textarea name="body" required rows={3} maxLength={100} placeholder="Notification text shown to the user…" />
      </label>

      {/* Recipients */}
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
            ⚠️ Sends to <strong>ALL</strong> Tuya users — the backend walks the full list and sends one by one.
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
                  Select all in list ({recipients.length})
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
                No users in the list — enter UIDs manually below.
              </p>
            )}
            <label>
              Enter UIDs manually (comma / newline separated)
              <textarea value={manual} onChange={(e) => setManual(e.target.value)} rows={2} placeholder="ay15..., ay16..." />
            </label>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Selected: <strong>{effectiveUids.length}</strong> recipients
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
