'use client';

import { useLinkStatus } from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';

/**
 * Phản hồi "đang tải" cho ĐIỀU HƯỚNG.
 *
 * Vì sao cần, trong khi mỗi route đã có `loading.tsx`: skeleton của `loading.tsx` chỉ chạy khi đổi
 * **segment**, và chỉ hiện sau khi server trả về nhịp đầu tiên. Hai khoảng trống còn lại:
 *
 * 1. Từ lúc bấm tới lúc server trả nhịp đầu - vẫn là trang CŨ đứng im, không dấu hiệu gì.
 * 2. Điều hướng cùng segment (bấm sang trang 2 của `/users`, đổi số dòng/trang): chỉ khác
 *    `searchParams` nên Next KHÔNG chạy `loading.tsx` - bảng đứng im tới khi dữ liệu mới về.
 *
 * Ba mảnh dưới đây lấp đúng hai khoảng đó: một thanh chạy toàn cục ở mép trên màn hình, một vòng
 * xoay trên chính mục sidebar vừa bấm, và một thanh cục bộ cho bảng đang phân trang.
 */

/* ---------------------------------------------------------------------------
 * Store đếm số lượt điều hướng đang chạy.
 *
 * Cần store riêng vì nguồn "đang chuyển trang" nằm rải rác: mỗi `<Link>` tự biết trạng thái của
 * mình qua `useLinkStatus` (hook chỉ đọc được link tổ tiên gần nhất), còn `router.push()` thì biết
 * qua `useTransition` ở component gọi nó. Thanh tiến trình chỉ có MỘT, nên gom tất cả về một chỗ.
 * Đếm chứ không dùng boolean: hai lượt chồng nhau thì lượt kết thúc trước không được tắt thanh.
 * ------------------------------------------------------------------------- */
let pendingCount = 0;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function isPendingSnapshot(): boolean {
  return pendingCount > 0;
}

/** Server render luôn coi như "không tải" - nếu không sẽ lệch hydrate. */
function serverSnapshot(): boolean {
  return false;
}

/**
 * Đăng ký một lượt điều hướng đang chạy vào thanh tiến trình toàn cục.
 * Gọi từ bất kỳ đâu biết trạng thái pending (link, `useTransition`, ...).
 */
export function useReportNavPending(pending: boolean): void {
  useEffect(() => {
    if (!pending) return;
    pendingCount += 1;
    for (const l of listeners) l();
    return () => {
      pendingCount -= 1;
      for (const l of listeners) l();
    };
  }, [pending]);
}

/**
 * Thanh chạy ở mép trên màn hình, bật khi CÓ BẤT KỲ lượt điều hướng nào đang chạy.
 * Gắn một lần trong shell (`AdminShell`).
 *
 * Cố ý KHÔNG đếm phần trăm: không biết trước server mất bao lâu, mà thanh giả vờ bò tới 90% rồi
 * đứng hình thì còn mất tin tưởng hơn là không có gì.
 */
export function NavProgress() {
  const active = useSyncExternalStore(subscribe, isPendingSnapshot, serverSnapshot);
  return (
    <div
      className={`route-progress${active ? ' on' : ''}`}
      role={active ? 'progressbar' : undefined}
      aria-label={active ? 'Loading page' : undefined}
      aria-hidden={!active}
    />
  );
}

/**
 * Đặt BÊN TRONG một `<Link>` để lượt bấm link đó bật thanh toàn cục. Không render ra DOM.
 * BẮT BUỘC nằm trong `<Link>` - `useLinkStatus` đọc link tổ tiên gần nhất, để ngoài thì luôn
 * `pending: false`. Dùng qua `components/AppLink.tsx` cho tiện.
 */
export function LinkProgress() {
  const { pending } = useLinkStatus();
  useReportNavPending(pending);
  return null;
}

/**
 * Như `LinkProgress` nhưng còn hiện vòng xoay tại chỗ - dùng cho mục sidebar, để biết mình đã bấm
 * trúng mục nào khi route mới tải chậm. Cũng phải nằm trong `<Link>`.
 */
export function LinkSpinner() {
  const { pending } = useLinkStatus();
  useReportNavPending(pending);
  return pending ? <span className="link-spinner" aria-label="Loading" /> : null;
}

/**
 * Thanh mảnh ở mép trên của khối chứa nó (khối cha phải `position: relative`) - dùng cho bảng đang
 * đổi trang, nơi `loading.tsx` không chạy vì vẫn cùng segment.
 */
export function ProgressBar({ active }: { active: boolean }) {
  return (
    <div
      className={`progress-bar${active ? ' on' : ''}`}
      role={active ? 'progressbar' : undefined}
      aria-label={active ? 'Loading' : undefined}
      aria-hidden={!active}
    />
  );
}
