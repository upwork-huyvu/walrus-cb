'use client';

import Link from 'next/link';
import { type ComponentProps } from 'react';
import { LinkProgress } from './Pending';

/**
 * `<Link>` của Next + phản hồi "đang tải": bấm là thanh tiến trình ở mép trên màn hình bật ngay,
 * tắt khi trang mới đã commit. Dùng thay `next/link` ở MỌI link điều hướng trong khu admin.
 *
 * Phải là component riêng chứ không phải hook gọi ở nơi khác: `useLinkStatus` chỉ đọc được link tổ
 * tiên gần nhất, nên phần theo dõi buộc phải render BÊN TRONG `<Link>` (`LinkProgress` trả về
 * `null`, không thêm gì vào DOM và không đụng tới bố cục).
 */
export default function AppLink({ children, ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link {...rest}>
      {children}
      <LinkProgress />
    </Link>
  );
}
