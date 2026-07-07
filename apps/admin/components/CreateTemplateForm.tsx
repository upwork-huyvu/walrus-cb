'use client';

import { useActionState } from 'react';
import {
  createTemplateAction,
  type CreateTemplateState,
} from '@/app/notifications/templates/actions';

const initialState: CreateTemplateState = {};

/** Form tạo template thông báo (submit để Tuya duyệt ≤2 ngày). */
export default function CreateTemplateForm() {
  const [state, formAction, pending] = useActionState(
    createTemplateAction,
    initialState,
  );

  return (
    <form action={formAction} className="card" style={{ width: '100%', maxWidth: 520 }}>
      <label>
        Name (≤30, internal)
        <input name="name" maxLength={30} required />
      </label>
      <label>
        {`Title (≤40, variables \${var} allowed)`}
        <input name="title" maxLength={40} required />
      </label>
      <label>
        {`Content (≤100, variables \${var} allowed)`}
        <textarea
          name="content"
          maxLength={100}
          required
          rows={3}
          style={{
            font: 'inherit',
            padding: '9px 11px',
            border: '1px solid var(--border)',
            borderRadius: 6,
          }}
        />
      </label>
      <label>
        Type
        <select name="type" defaultValue="0">
          <option value="0">0 - operations message</option>
          <option value="1">1 - system message</option>
        </select>
      </label>
      <label>
        Review note (≤100)
        <input name="remark" maxLength={100} required />
      </label>

      {state.error ? <p className="error">{state.error}</p> : null}
      {state.ok ? (
        <p style={{ color: 'var(--success)', fontSize: 13, margin: 0 }}>
          ✅ Created {state.templateId ?? ''} - awaiting Tuya review (≤2 business days)
        </p>
      ) : null}

      <button className="primary" type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create template'}
      </button>
    </form>
  );
}
