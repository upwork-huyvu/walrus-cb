import { type ReactNode } from 'react';
import LegalNav from '@/components/LegalNav';
import {
  APP_NAME,
  COMPANY,
  COMPANY_ADDRESS,
  COMPANY_NUMBER,
  SUPPORT_EMAIL,
  WEBSITE_URL,
} from '@/lib/legal';

/**
 * Layout cho các trang PUBLIC mà App Store / Google Play yêu cầu (privacy, terms, xoá tài khoản,
 * support). `(legal)` là route group → không có trong URL: trang nằm ở `/privacy`, `/terms`...
 * Nằm ngoài `(dashboard)` nên không có sidebar admin và không gọi backend; proxy.ts không chặn.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="legal">
      <a className="legal-skip" href="#legal-content">
        Skip to content
      </a>

      <header className="legal-header">
        <div className="legal-header-inner">
          <a className="legal-brand" href={WEBSITE_URL}>
            <span className="mark" aria-hidden>
              ❄
            </span>
            <span className="wordmark">
              {APP_NAME}
              <small>Legal &amp; support</small>
            </span>
          </a>
          <LegalNav />
        </div>
      </header>

      <main id="legal-content">{children}</main>

      <footer className="legal-footer">
        <div className="legal-footer-inner">
          <div>
            <p className="legal-footer-name">{COMPANY}</p>
            <address>
              {COMPANY_ADDRESS.join(', ')}
              <br />
              Registered in England and Wales · Company no. {COMPANY_NUMBER}
            </address>
          </div>
          <p className="legal-footer-contact">
            Questions? <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
