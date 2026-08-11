// Bộ icon line-style dùng chung cho admin. SVG inline thay vì thêm dependency: chỉ cần ~15 icon,
// kéo cả thư viện vào là thừa. Tất cả nhận `stroke="currentColor"` → đổi màu theo context (nav
// active, stat card, nút) mà không cần prop màu riêng.
type P = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function IconHome({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-5.5h5V20" />
    </svg>
  );
}

export function IconUsers({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19.5c0-3 2.7-5 6-5s6 2 6 5" />
      <path d="M16 5.6a3 3 0 0 1 0 5.3" />
      <path d="M17.6 14.8c2 .7 3.4 2.3 3.4 4.7" />
    </svg>
  );
}

export function IconDevice({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.6" />
      <path d="M10.5 5.6h3" />
      <path d="M11 18.4h2" />
    </svg>
  );
}

export function IconShield({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M12 2.8 4.8 5.8v5.4c0 4.4 3 8.4 7.2 9.9 4.2-1.5 7.2-5.5 7.2-9.9V5.8Z" />
      <path d="m9.2 11.9 2 2 3.6-3.8" />
    </svg>
  );
}

export function IconGear({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V20a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H10a1.6 1.6 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V10a1.6 1.6 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </svg>
  );
}

export function IconSend({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M21 3 10.5 13.5" />
      <path d="M21 3l-6.8 18-3.7-7.5L3 9.8Z" />
    </svg>
  );
}

export function IconTemplate({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <rect x="3.5" y="4" width="17" height="16" rx="2.4" />
      <path d="M3.5 9h17" />
      <path d="M9 9v11" />
    </svg>
  );
}

export function IconLogout({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M14.5 3.5h3a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-3" />
      <path d="M10 16.5 14.5 12 10 7.5" />
      <path d="M14.5 12H3.5" />
    </svg>
  );
}

export function IconSearch({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="11" cy="11" r="6.4" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  );
}

export function IconFilter({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M3.5 5.5h17l-6.6 7.6V19l-3.8 2v-7.9Z" />
    </svg>
  );
}

export function IconCopy({ size = 15, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <rect x="9" y="9" width="11.5" height="11.5" rx="2.2" />
      <path d="M5.5 15H4.6A1.6 1.6 0 0 1 3 13.4V4.6A1.6 1.6 0 0 1 4.6 3h8.8A1.6 1.6 0 0 1 15 4.6v.9" />
    </svg>
  );
}

export function IconCheck({ size = 15, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function IconEye({ size = 15, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

export function IconCalendar({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.4" />
      <path d="M3.5 9.8h17" />
      <path d="M8 3.5v3M16 3.5v3" />
    </svg>
  );
}

export function IconGlobe({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M3.4 12h17.2" />
      <path d="M12 3.2c2.2 2.4 3.4 5.5 3.4 8.8s-1.2 6.4-3.4 8.8c-2.2-2.4-3.4-5.5-3.4-8.8S9.8 5.6 12 3.2Z" />
    </svg>
  );
}

export function IconChevronLeft({ size = 16, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </svg>
  );
}

export function IconChevronRight({ size = 16, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </svg>
  );
}

export function IconMenu({ size = 20, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function IconClose({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Mũi tên hai chiều cho tiêu đề cột sắp xếp được. */
export function IconSort({ size = 13, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M8 9.5 12 5.5l4 4" />
      <path d="M8 14.5 12 18.5l4-4" />
    </svg>
  );
}

export function IconTrash({ size = 15, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M4 6.5h16" />
      <path d="M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" />
      <path d="M6.5 6.5 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-12.5" />
      <path d="M10.5 10.5v6M13.5 10.5v6" />
    </svg>
  );
}

export function IconMail({ size = 15, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <rect x="2.8" y="5" width="18.4" height="14" rx="2.2" />
      <path d="m3.4 6.6 8.6 6 8.6-6" />
    </svg>
  );
}

export function IconClock({ size = 15, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 6.8V12l3.4 2" />
    </svg>
  );
}

export function IconBox({ size = 16, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M12 2.8 20.5 7v10L12 21.2 3.5 17V7Z" />
      <path d="M3.5 7 12 11.4 20.5 7" />
      <path d="M12 11.4v9.8" />
    </svg>
  );
}

export function IconChart({ size = 16, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

export function IconArrowLeft({ size = 15, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M20 12H4" />
      <path d="m10 6-6 6 6 6" />
    </svg>
  );
}

export function IconArrowRight({ size = 15, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M4 12h16" />
      <path d="m14 6 6 6-6 6" />
    </svg>
  );
}

export function IconChevronDown({ size = 14, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="m5.5 9 6.5 6.5L18.5 9" />
    </svg>
  );
}
