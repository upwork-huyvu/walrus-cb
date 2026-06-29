import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cool Bath — Admin',
  description: 'Quản trị người dùng ice-bath',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
