'use client';

import { useActionState, useMemo, useState } from 'react';
import { sendPushAction, type SendPushState } from '@/app/notifications/actions';

export type Template = {
  template_id: string;
  name?: string;
  title?: string;
  content?: string;
};
export type Recipient = { uid: string; label: string };

const initialState: SendPushState = {};

/**
 * Form gửi push: chọn template → chọn người nhận (multi-select từ danh sách user Tuya /
 * nhập UID thủ công / gửi TẤT CẢ) → điền biến `${var}` → gửi.
 */
export default function SendPushForm({
  templates,
  recipients,
}: {
  templates: Template[];
  recipients: Recipient[];
}) {
  const [state, formAction, pending] = useActionState(
    sendPushAction,
    initialState,
  );
  const [templateId, setTemplateId] = useState(templates[0]?.template_id ?? '');
  const [mode, setMode] = useState<'select' | 'all'>('select');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState('');

  const selected = useMemo(
    () => templates.find((t) => t.template_id === templateId),
    [templates, templateId],
  );
  const vars = useMemo(() => extractVars(selected), [selected]);

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
  const allInList =
    recipients.length > 0 && recipients.every((r) => checked.has(r.uid));
  const toggleAllInList = () =>
    setChecked(() => (allInList ? new Set() : new Set(recipients.map((r) => r.uid))));

  const canSend = !!templateId && (mode === 'all' || effectiveUids.length > 0);
  const rowLabel = { flexDirection: 'row' as const, gap: 8, alignItems: 'center' };

  return (
    <form
      action={formAction}
      className="card"
      style={{ width: '100%', maxWidth: 560 }}
    >
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="uids" value={JSON.stringify(effectiveUids)} />

      <label>
        Template (approved)
        <select
          name="templateId"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          required
        >
          {templates.length === 0 ? (
            <option value="">— no templates yet —</option>
          ) : null}
          {templates.map((t) => (
            <option key={t.template_id} value={t.template_id}>
              {t.name ?? t.template_id}
            </option>
          ))}
        </select>
      </label>

      {selected ? (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          <strong>{selected.title}</strong>
          <br />
          {selected.content}
        </p>
      ) : null}

      {/* Người nhận */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 18 }}>
          <label style={rowLabel}>
            <input
              type="radio"
              checked={mode === 'select'}
              onChange={() => setMode('select')}
            />
            Choose recipients
          </label>
          <label style={rowLabel}>
            <input
              type="radio"
              checked={mode === 'all'}
              onChange={() => setMode('all')}
            />
            Send to all
          </label>
        </div>

        {mode === 'all' ? (
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            ⚠️ Sends to <strong>ALL</strong> Tuya users — the backend walks the full
            list and sends one by one (Tuya has no bulk send). This may take a while with many users.
          </p>
        ) : (
          <>
            {recipients.length > 0 ? (
              <div
                className="panel"
                style={{ maxHeight: 200, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                <label style={{ ...rowLabel, color: 'var(--gold)' }}>
                  <input
                    type="checkbox"
                    checked={allInList}
                    onChange={toggleAllInList}
                  />
                  Select all in list ({recipients.length})
                </label>
                {recipients.map((r) => (
                  <label key={r.uid} style={rowLabel}>
                    <input
                      type="checkbox"
                      checked={checked.has(r.uid)}
                      onChange={() => toggle(r.uid)}
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                No Tuya users in the list — enter UIDs manually below.
              </p>
            )}
            <label>
              Enter UIDs manually (comma / newline separated)
              <textarea
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                rows={2}
                placeholder="ay15..., ay16..."
              />
            </label>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Selected: <strong>{effectiveUids.length}</strong> recipients
            </p>
          </>
        )}
      </div>

      {vars.map((v) => (
        <label key={v}>
          {`Variable \${${v}}`}
          <input name={`param.${v}`} required />
        </label>
      ))}

      {state.error ? <p className="error">{state.error}</p> : null}
      {state.ok ? (
        <p
          style={{
            color: state.failed ? 'var(--warning)' : 'var(--success)',
            fontSize: 13,
            margin: 0,
          }}
        >
          {state.failed
            ? `Sent ${state.success}/${state.total} · ${state.failed} failed`
            : `✅ Sent ${state.success}/${state.total} successfully`}
        </p>
      ) : null}

      <button className="primary" type="submit" disabled={pending || !canSend}>
        {pending ? 'Sending…' : 'Send notification'}
      </button>
    </form>
  );
}

/** Trích các biến `${var}` (duy nhất) từ title + content của template. */
function extractVars(t?: { title?: string; content?: string }): string[] {
  if (!t) return [];
  const text = `${t.title ?? ''} ${t.content ?? ''}`;
  const set = new Set<string>();
  const re = /\$\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    set.add(m[1].trim());
  }
  return [...set];
}
