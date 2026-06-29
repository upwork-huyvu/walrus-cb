# Progress: Scaffold monorepo + RN CLI app + init Tuya SDK

> File quản lý tiến trình. `/dev`, `/test`, `/fix-plan` đọc đầu vào & cập nhật cuối mỗi lượt.

> ⛔ **SUPERSEDED (2026-06-28)** — Feature này bị thay thế khi M1 mở rộng scope.
> Hướng kiến trúc đổi: Tuya SDK **không** nhúng native deps trực tiếp vào app nữa
> mà gói thành **thư viện npm riêng** (TurboModule+Codegen). Vì vậy:
> - Phần "tích hợp + init Tuya SDK" (B4–B5 cũ) → chuyển sang **`m1-tuya-sdk-library`**.
> - Phần "scaffold RN CLI app + port UI" (B1–B3 cũ) → chuyển sang **`m1-mobile-scaffold`**.
> Giữ file này làm lịch sử; **không chạy `/dev` ở đây nữa**.

- **Slug:** `m1-scaffold-and-tuya-init`
- **Phase hiện tại:** `SUPERSEDED`
- **Trạng thái:** `superseded` (→ `m1-tuya-sdk-library` + `m1-mobile-scaffold`)
- **Cập nhật lần cuối:** 2026-06-28 (đánh dấu superseded)

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
Plan đã có (Gate ① — chờ user duyệt). Khuyến nghị: chạy `/tuya-research SDK init & Data Center & integration` để neo B4–B5 vào doc thật, RỒI bắt đầu `/dev` từ B1. Trước khi tới B5 cần user cung cấp AppKey/AppSecret + Data Center.

## Checklist các bước (đồng bộ với plan.md mục 4)
- [ ] B1 — Khởi tạo monorepo + git · pending
- [ ] B2 — Init RN CLI app · pending
- [ ] B3 — Port design tokens từ replit UI · pending
- [ ] B4 — Thêm native deps Tuya SDK · pending (cần research trước)
- [ ] B5 — Init SDK đúng Data Center + AppKey từ config · pending (cần secret từ user)
- [ ] B6 — Quét secret + .env.example · pending

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [ ] AC1 — Monorepo + .gitignore + mobile build được
- [ ] AC2 — App RN CLI chạy, không còn expo-*
- [ ] AC3 — Tuya SDK init success, region đúng, AppSecret ngoài repo
- [ ] AC4 — Grep secret sạch, có .env.example

## Nhật ký chạy (Run log) — mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-06-28 | PLAN | ✅ | Tạo plan/context/progress; đăng ký INDEX. Chờ Gate ① + research. |

## Vấn đề đang chặn (Blockers)
- Cần user cung cấp: **AppKey/AppSecret Tuya**, **Data Center của Cloud Project**, xác nhận **account là Owner của Home** (chặn B5, không chặn B1–B3).
