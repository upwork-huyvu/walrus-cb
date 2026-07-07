# Progress: <TÊN FEATURE>

> File quản lý tiến trình (state machine của feature). `/dev`, `/test`, `/fix-plan`
> đọc đầu vào và cập nhật cuối mỗi lượt. Luôn giữ phần "Hành động kế tiếp" chính xác.

- **Slug:** `<feature-slug>`
- **Phase hiện tại:** `PLAN | DEV | TEST | FIX-PLAN | DONE | BLOCKED`
- **Trạng thái:** `in_progress | blocked | done`
- **Cập nhật lần cuối:** <YYYY-MM-DD HH:mm>

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
<1-3 câu: bước tiếp theo cần làm chính xác là gì. Nếu BLOCKED: đang chờ gì/ai.>

## Checklist các bước (đồng bộ với plan.md mục 4)
- [ ] B1 - <tên bước>  · <pending|doing|done|blocked>
- [ ] B2 - <tên bước>  · <...>

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [ ] AC1 - <...>
- [ ] AC2 - <...>

## Nhật ký chạy (Run log) - mới nhất ở trên
> Mỗi lần DEV/TEST/FIX-PLAN ghi 1 dòng: thời gian · bước · kết quả · ghi chú.

| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| <YYYY-MM-DD HH:mm> | <DEV B1> | <✅/❌> | <lệnh test đã chạy, lỗi gặp, link log> |

## Vấn đề đang chặn (Blockers)
- <Trống nếu không có. Nếu có: mô tả + cần gì để gỡ.>
