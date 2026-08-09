'use client';

import { useEffect, useState } from 'react';
import { IconCheck, IconCopy } from './Icons';

/**
 * Copy một chuỗi (uid, device id...) vào clipboard, đổi icon sang dấu tick 1.5s để báo đã copy.
 * `navigator.clipboard` chỉ tồn tại trên secure context (https / localhost) → có nhánh dự phòng,
 * lỗi thì im lặng chứ không ném ra làm vỡ bảng.
 */
export default function CopyButton({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1500);
    return () => clearTimeout(t);
  }, [done]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
    } catch {
      /* clipboard bị chặn (http, quyền) - bỏ qua, không làm gãy UI */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="icon-btn"
      title={done ? 'Copied' : `Copy ${label ?? 'value'}`}
      aria-label={done ? 'Copied' : `Copy ${label ?? 'value'}`}
    >
      {done ? <IconCheck /> : <IconCopy />}
    </button>
  );
}
