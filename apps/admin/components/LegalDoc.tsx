import { type ReactNode } from 'react';
import { LEGAL_UPDATED } from '@/lib/legal';

export type LegalSection = { id: string; title: string; body: ReactNode };

type Props = {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  /** Khối tóm tắt nổi bật ngay dưới phần mở đầu (tuỳ chọn). */
  highlight?: { title: string; body: ReactNode };
  sections: LegalSection[];
};

/**
 * Khung chung của một trang pháp lý: tiêu đề + ngày cập nhật, mục lục, các mục đánh số.
 * Mục lục có 2 bản: cột dính bên trái trên màn rộng, `<details>` gập lại trên điện thoại - đều là
 * HTML thuần, không cần JS. `id` của mục là anchor ổn định (store reviewer / email support có thể
 * trỏ thẳng tới `/privacy#retention`), nên đừng đổi id khi chỉ sửa câu chữ.
 */
export default function LegalDoc({ eyebrow, title, intro, highlight, sections }: Props) {
  const toc = (
    <ol>
      {sections.map((s, i) => (
        <li key={s.id}>
          <a href={`#${s.id}`}>
            <span className="legal-toc-num">{i + 1}</span>
            {s.title}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="legal-main">
      <aside className="legal-toc">
        <nav aria-label="On this page">
          <p className="legal-toc-title">On this page</p>
          {toc}
        </nav>
      </aside>

      <article className="legal-article">
        <header className="legal-hero">
          <p className="legal-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="legal-meta">Last updated {LEGAL_UPDATED}</p>
          <div className="legal-intro">{intro}</div>
        </header>

        <details className="legal-toc-mobile">
          <summary>On this page</summary>
          <nav aria-label="On this page">{toc}</nav>
        </details>

        {highlight ? (
          <aside className="legal-callout" aria-label={highlight.title}>
            <p className="legal-callout-title">{highlight.title}</p>
            {highlight.body}
          </aside>
        ) : null}

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="legal-section" aria-labelledby={`${s.id}-h`}>
            <h2 id={`${s.id}-h`}>
              <span className="legal-num" aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </span>
              {s.title}
            </h2>
            {s.body}
          </section>
        ))}
      </article>
    </div>
  );
}
