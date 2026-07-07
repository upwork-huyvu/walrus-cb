# Context: Scaffold monorepo + RN CLI app + init Tuya SDK

> File "trí nhớ" - giữ context xuyên suốt các phiên. Mọi quyết định, phát hiện,
> cạm bẫy ghi vào đây. Append theo thời gian, đừng xoá lịch sử.

> ⛔ **SUPERSEDED (2026-06-28)** - tách thành `m1-tuya-sdk-library` (gói SDK) +
> `m1-mobile-scaffold` (app RN CLI). Lý do: M1 mở rộng scope + chốt hướng "wrap
> Tuya SDK thành thư viện npm riêng (TurboModule)" thay vì nhúng native vào app.
> Các Decision log bên dưới vẫn còn giá trị và được kế thừa.

- **Slug:** `m1-scaffold-and-tuya-init`

## Quyết định kỹ thuật (Decision log)
- **2026-06-28** - Backend = **NestJS + Supabase (hybrid)**: NestJS REST API trên Vercel + Supabase (Postgres+Auth). Lý do: chốt với chủ dự án; dung hoà tài liệu (Supabase+Vercel) và yêu cầu NestJS. Đã loại: Supabase-only serverless; NestJS+Postgres tự quản (bỏ Supabase).
- **2026-06-28** - Mobile = **RN CLI**, KHÔNG Expo. Lý do: cần native module cho Tuya SDK. `replit_generate/` (Expo Snack) chỉ là tham chiếu thiết kế.

## Bản đồ file/module
| File / Module | Vai trò |
|---|---|
| `replit_generate/` | UI prototype (Expo) - nguồn tham chiếu thiết kế, sẽ migrate |
| `apps/mobile/` | (sẽ tạo) RN CLI app |
| `apps/backend/` | (sẽ tạo) NestJS + Supabase |
| `apps/admin/` | (sẽ tạo) admin web |
| `docs/` | Tài liệu dự án (overview + milestones) |

## Phát hiện & cạm bẫy (Findings / Gotchas)
- Tuya doc xác nhận: Data Center của SDK phải trùng Cloud Project; account link SDK phải là **Owner** của Home (xem docs/TÀI-LIỆU-2 + tuya-research).
- `replit_generate/package.json` dùng expo ~54, react 19.1, RN 0.81.5, react-native-paper 4.9.2, react-native-svg 15.12.1 → khi migrate cần map sang bản RN CLI tương thích.

## Liên kết
- Plan: [plan.md](plan.md)
- Progress: [progress.md](progress.md)
- Research liên quan: _chưa có_ → cần `docs/research/tuya-sdk-init-*.md`
- Báo cáo audit liên quan: _chưa có_

## Tóm tắt khi hoàn thành (điền lúc FINISH)
_(chưa hoàn thành)_
