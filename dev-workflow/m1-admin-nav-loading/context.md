# Context: m1-admin-nav-loading

## Quyết định & lý do
1. **Route group `app/(dashboard)/` thay vì vá từng layout.**
   Cách vá nhỏ hơn (giữ 6 layout, bọc `getActiveProvider()` trong `<Suspense>`) cũng làm skeleton
   hiện sớm, nhưng **vẫn** tốn một lượt gọi backend mỗi lần đổi mục và vẫn dựng lại sidebar.
   Gom layout thì đổi mục **không gọi lại gì cả** - vừa nhanh hơn vừa bớt 6 file trùng nhau.
2. **`hideTemplates` giờ tính một lần mỗi lần tải trang thật**, không phải mỗi lần đổi mục.
   Chấp nhận được: `NOTIFICATION_PROVIDER` là **biến môi trường của backend**, không có UI nào đổi
   được (trang Settings chỉ *hiển thị*) ⇒ không có kịch bản nó đổi giữa chừng phiên làm việc.
3. **Thanh tiến trình chạy vô định, không đếm phần trăm.** Không biết trước server mất bao lâu;
   thanh giả vờ bò tới 90% rồi đứng hình mất tin tưởng hơn là không có.
4. **`AppLink` thay `next/link` ở mọi link điều hướng.** `useLinkStatus` chỉ đọc được link **tổ
   tiên gần nhất** ⇒ phần theo dõi buộc phải render *bên trong* `<Link>`; gói sẵn một lần cho khỏi
   phải nhớ. `AppLink` render thêm `LinkProgress` (trả `null`) ⇒ không đụng DOM/bố cục.
5. **Đếm số lượt pending, không dùng boolean.** Hai lượt điều hướng chồng nhau thì lượt xong trước
   không được phép tắt thanh.

## Bản đồ file
| File | Vai trò |
|---|---|
| `apps/admin/app/(dashboard)/layout.tsx` | **mới** - layout dùng chung cả khu admin (thay 6 layout cũ) |
| `apps/admin/app/(dashboard)/{admins,dashboard,devices,notifications,settings,users}/` | chuyển vào group; URL **không đổi** |
| `apps/admin/components/Pending.tsx` | store pending + `NavProgress` · `LinkProgress` · `LinkSpinner` · `ProgressBar` |
| `apps/admin/components/AppLink.tsx` | **mới** - `<Link>` + báo pending; dùng thay `next/link` |
| `apps/admin/components/AdminShell.tsx` | gắn `<NavProgress />` + `<LinkSpinner />` trong từng mục nav |
| `apps/admin/components/UsersBrowser.tsx` | `useTransition` cho phân trang + báo lên thanh toàn cục |
| `apps/admin/app/globals.css` | `.route-progress` · `.progress-bar` · `.table-card.is-pending` · `.link-spinner` |
| `apps/admin/app/(dashboard)/devices/[id]/loading.tsx`, `.../notifications/templates/loading.tsx` | **mới** - bù skeleton còn thiếu |

## Phát hiện cần nhớ
- **`loading.tsx` nằm TRONG `layout.tsx` cùng segment.** Layout `async` ⇒ skeleton bị chặn.
  Muốn `loading.tsx` có tác dụng thì layout của segment đó phải rẻ, hoặc đừng render lại nó.
- Layout đọc `cookies()` ⇒ route dynamic ⇒ `<Link>` prefetch **không** lấy được shell tĩnh.
- Sau khi đổi cây `app/`, `.next/types/validator.ts` còn trỏ đường dẫn cũ ⇒ `tsc` báo `TS2307` ma.
  `rm -rf .next && npm run build` là hết, không phải lỗi code.
- `next build` phải liệt kê **đúng các route cũ** - route group `(dashboard)` không vào URL.

## Chưa kiểm chứng
- **Chưa chạy thử trên trình duyệt**: backend `localhost:3006` không bật và không có tài khoản admin
  để đăng nhập. Mới xác nhận ở mức `tsc` · `eslint` · `next build` + suy luận theo tài liệu Next.
