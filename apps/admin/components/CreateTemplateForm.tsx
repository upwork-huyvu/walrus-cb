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
        Tên (≤30, nội bộ)
        <input name="name" maxLength={30} required />
      </label>
      <label>
        {`Tiêu đề (≤40, cho phép biến \${var})`}
        <input name="title" maxLength={40} required />
      </label>
      <label>
        {`Nội dung (≤100, cho phép biến \${var})`}
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
        Loại
        <select name="type" defaultValue="0">
          <option value="0">0 — operations message</option>
          <option value="1">1 — system message</option>
        </select>
      </label>
      <label>
        Ghi chú duyệt (≤100)
        <input name="remark" maxLength={100} required />
      </label>

      {state.error ? <p className="error">{state.error}</p> : null}
      {state.ok ? (
        <p style={{ color: '#16a34a', fontSize: 13, margin: 0 }}>
          ✅ Đã tạo {state.templateId ?? ''} — chờ Tuya duyệt (≤2 ngày làm việc)
        </p>
      ) : null}

      <button className="primary" type="submit" disabled={pending}>
        {pending ? 'Đang tạo…' : 'Tạo template'}
      </button>
    </form>
  );
}
