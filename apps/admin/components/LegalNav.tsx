'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { LEGAL_PAGES } from '@/lib/legal';

// Tab chuyển giữa các trang pháp lý public. Client để đánh dấu trang hiện tại (aria-current) và,
// trên điện thoại (nav cuộn ngang), kéo tab đang mở vào giữa tầm nhìn - không thì "Support" nằm
// khuất ngoài mép phải. Dùng `next/link` thường chứ không phải AppLink - thanh tiến trình của
// AppLink thuộc shell admin.
export default function LegalNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    // Chỉnh scrollLeft của riêng nav thay vì scrollIntoView (có thể kéo cả trang theo chiều dọc).
    nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
  }, [pathname]);

  return (
    <nav ref={navRef} className="legal-nav" aria-label="Legal and support">
      {LEGAL_PAGES.map((p) => (
        <Link key={p.href} href={p.href} aria-current={pathname === p.href ? 'page' : undefined}>
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
