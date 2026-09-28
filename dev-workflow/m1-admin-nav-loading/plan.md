# Plan: Admin web - phản hồi "đang tải" khi chuyển trang

- **Slug:** `m1-admin-nav-loading`
- **Phần:** admin (Next.js 16 App Router)
- **Ngày:** 2026-09-28

## 1. Vấn đề (nguyên văn người dùng)
"Bổ sung cái loading khi chuyển trang, chuyển page - giờ nó chả có mịa gì."

Đúng là *chả có gì*, dù trong `app/` đã có sẵn 9 file `loading.tsx` với skeleton.

## 2. Vì sao skeleton có sẵn mà không thấy
Thứ tự lồng nhau của App Router: `loading.tsx` của một segment nằm **bên trong** `layout.tsx`
của chính segment đó (`layout` → `error` → `loading` → `page`).

Trước fix, **mỗi mục menu có một `layout.tsx` riêng** (`users/`, `devices/`, `admins/`,
`settings/`, `notifications/`, `dashboard/`) và cả 6 đều render `AdminShellServer`, mà hàm này
`await getActiveProvider()` = **một lượt gọi backend**. Hệ quả khi bấm đổi mục:

1. Server phải chờ xong lượt gọi provider của layout mới → **rồi mới** được phép phát skeleton;
2. Page mới bắt đầu fetch dữ liệu **sau đó** (page là con của layout ⇒ nối tiếp, không song song);
3. Layout đọc `cookies()` ⇒ dynamic ⇒ `<Link>` **không prefetch** được gì hữu ích.

⇒ màn hình đứng im nguyên trang cũ qua ~2 vòng mạng nối tiếp. Đúng cảm giác "bấm mà không có gì".

Còn 2 khoảng trống nữa, kể cả khi skeleton chạy đúng:
- Từ lúc bấm đến lúc server trả nhịp đầu: vẫn chưa có gì nhúc nhích.
- Điều hướng **cùng segment** (trang 2 của `/users`, đổi số dòng/trang): Next **không** chạy
  `loading.tsx` vì chỉ khác `searchParams`.

## 3. Cách làm
- **B1 - Gom layout về một route group `app/(dashboard)/`.** Một `layout.tsx` duy nhất cho cả khu
  đã đăng nhập; `/login` vẫn nằm ngoài (không sidebar). Đổi mục ⇒ layout **không** render lại ⇒
  không gọi lại provider, sidebar không dựng lại, skeleton hiện ngay.
  Route group không xuất hiện trong URL ⇒ **mọi đường dẫn giữ nguyên**.
- **B2 - Thanh tiến trình toàn cục** ở mép trên màn hình, bật **ngay lúc bấm**: `useLinkStatus`
  cho link (`components/AppLink.tsx`) + `useTransition` cho `router.push`, gom về một store nhỏ
  trong `components/Pending.tsx`.
- **B3 - Vòng xoay trên mục sidebar vừa bấm** (`LinkSpinner`) - biết mình bấm trúng mục nào.
- **B4 - Thanh + làm mờ bảng khi đổi trang** (`/users`) - chỗ `loading.tsx` không với tới.
- **B5 - Bù 2 `loading.tsx` còn thiếu:** `devices/[id]`, `notifications/templates`.

## 4. Tiêu chí nghiệm thu (AC)
- AC1 - Bấm một mục sidebar: có phản hồi **tức thì** (thanh chạy + vòng xoay), không cần chờ mạng.
- AC2 - Đổi mục: skeleton của mục đích hiện ngay, không còn đứng im nguyên trang cũ.
- AC3 - Đổi trang trong `/users`: có thanh chạy + bảng mờ + khoá nút, không đứng câm.
- AC4 - URL không đổi (route group), `next build` liệt kê đúng 14 route như trước.
- AC5 - `tsc` 0 lỗi · `eslint` 0 lỗi · `next build` ✓.
- AC6 - Tôn trọng `prefers-reduced-motion`: chỉ báo **tĩnh** chứ không biến mất.
