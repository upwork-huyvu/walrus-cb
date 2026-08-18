/**
 * Khung xương dùng cho `loading.tsx` của từng route. Next.js App Router tự render file đó trong
 * lúc Server Component còn đang fetch, nên KHÔNG cần state loading thủ công ở đâu cả.
 *
 * Nguyên tắc: khung xương phải khớp bố cục thật (đúng số cột, đúng chiều cao hàng) - lệch thì
 * trang "nhảy" một nhịp khi dữ liệu về, khó chịu hơn là không có gì.
 */

export function SkeletonHeader() {
  return (
    <div className="page-head">
      <div style={{ width: '100%' }}>
        <div className="sk sk-title" />
        <div className="sk sk-sub" />
      </div>
    </div>
  );
}

/** Bảng đang tải: `rows` hàng, mỗi hàng có avatar + 2 dòng chữ. */
export function SkeletonTable({ rows = 6, withAvatar = true }: { rows?: number; withAvatar?: boolean }) {
  return (
    <section className="table-card">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="sk-row" key={i}>
          {withAvatar ? <div className="sk sk-avatar" /> : null}
          <div style={{ flex: 1 }}>
            <div className="sk sk-line" style={{ width: `${55 - (i % 3) * 8}%` }} />
            <div className="sk sk-line" style={{ width: '28%', marginTop: 7, height: 10 }} />
          </div>
          <div className="sk sk-line" style={{ width: 88, height: 26, borderRadius: 8 }} />
        </div>
      ))}
    </section>
  );
}

/** Dải thẻ số liệu (Dashboard). */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <section className="stat-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div className="sk sk-card" key={i} />
      ))}
    </section>
  );
}

/** Trang chi tiết user: hero + 2 cột. */
export function SkeletonDetail() {
  return (
    <>
      <div className="detail-hero">
        <div className="sk sk-avatar" style={{ width: 62, height: 62 }} />
        <div style={{ flex: 1 }}>
          <div className="sk sk-title" style={{ width: 260 }} />
          <div className="sk sk-sub" style={{ width: 300 }} />
        </div>
      </div>
      <div className="detail-grid">
        <div className="panel-card">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="sk sk-line"
              style={{ width: `${70 - (i % 4) * 10}%`, marginBottom: 18 }}
            />
          ))}
        </div>
        <div className="detail-side">
          <div className="sk sk-card" style={{ height: 190 }} />
          <div className="sk sk-card" style={{ height: 140 }} />
        </div>
      </div>
    </>
  );
}
