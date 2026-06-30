'use client';

import { useActionState, useMemo, useState } from 'react';
import { sendPushAction, type SendPushState } from '@/app/notifications/actions';

export type Template = {
  template_id: string;
  name?: string;
  title?: string;
  content?: string;
};

const initialState: SendPushState = {};

/** Form gửi push: chọn template đã duyệt → render input theo biến `${var}` → gửi. */
export default function SendPushForm({ templates }: { templates: Template[] }) {
  const [state, formAction, pending] = useActionState(
    sendPushAction,
    initialState,
  );
  const [templateId, setTemplateId] = useState(
    templates[0]?.template_id ?? '',
  );

  const selected = useMemo(
    () => templates.find((t) => t.template_id === templateId),
    [templates, templateId],
  );
  const vars = useMemo(() => extractVars(selected), [selected]);

  return (
    <form action={formAction} className="card" style={{ width: '100%', maxWidth: 480 }}>
      <label>
        Template (đã duyệt)
        <select
          name="templateId"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          required
        >
          {templates.length === 0 ? (
            <option value="">— chưa có template —</option>
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

      <label>
        UID người nhận
        <input name="uid" required placeholder="vd ay1528287200853xxxxx" />
      </label>

      {vars.map((v) => (
        <label key={v}>
          {`Biến \${${v}}`}
          <input name={`param.${v}`} required />
        </label>
      ))}

      {state.error ? <p className="error">{state.error}</p> : null}
      {state.ok ? (
        <p
          style={{
            color: state.sendStatus ? '#16a34a' : 'var(--danger)',
            fontSize: 13,
            margin: 0,
          }}
        >
          {state.sendStatus
            ? '✅ Đã gửi (send_status = true)'
            : '⚠️ Tuya trả send_status = false'}
        </p>
      ) : null}

      <button className="primary" type="submit" disabled={pending || !templateId}>
        {pending ? 'Đang gửi…' : 'Gửi thông báo'}
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
