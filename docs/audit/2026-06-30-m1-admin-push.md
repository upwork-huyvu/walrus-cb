# Báo cáo Audit — feature `m1-admin-push` — 2026-06-30

- **Phạm vi:** feature `m1-admin-push` (track backend + admin). File trong scope:
  - Backend: `src/notifications/*` (dto, types, service, spec, controller, module), `src/app.module.ts`, `src/config/env.validation.ts`
  - Admin: `lib/api.ts`, `lib/auth.ts`, `app/notifications/**` (page/actions/layout + templates/*), `components/SendPushForm.tsx`, `components/CreateTemplateForm.tsx`, `proxy.ts`, `app/users/layout.tsx`
- **Stack phát hiện:** NestJS (REST, Vercel) + Tuya Cloud OpenAPI client · Next.js admin (App Router, Server Actions) · Supabase Auth (qua backend)
- **Checklist áp dụng:** `nestjs`, `admin-web`, `security-secrets` (luôn áp dụng)
- **Người/agent audit:** Claude (skill /audit) · **Ngày:** 2026-06-30
- **Lưu ý:** read-only — không sửa code. `npm audit`/build chưa chạy được (E503 Nexus) → một số mục để "xác minh thủ công".

## Tóm tắt
| Mức | Số lượng |
|---|---|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 3 |
| 🔵 Low/Nit | 6 |

**3 vấn đề ưu tiên xử lý:** M-1 (gọi Tuya cloud không có timeout) · M-3 (session hết hạn → trang hiện lỗi thay vì về /login) · M-2 (lỗi business Tuya trả HTTP 500 sai mã)

> Ghi nhận tích cực: mọi endpoint `notifications` đều bọc `AdminAuthGuard` (class-level); secret (`TUYA_ACCESS_SECRET`, `service_role`) KHÔNG xuất hiện trong scope; admin gọi backend chứ không gọi thẳng Tuya; `template_param` serialize đúng + KHÔNG log nội dung biến (tránh lộ mã/PII); cookie `admin_token` httpOnly + secure(prod) + sameSite. Không có XSS (`dangerouslySetInnerHTML` không dùng; React tự escape preview template).

## Phát hiện chi tiết

### [🟡 M-1] Gọi Tuya Cloud không có timeout → có thể treo request trên serverless
- **Vị trí:** `apps/backend/src/tuya/tuya-cloud.service.ts:60` (dùng bởi `notifications.service.ts` cả 4 call)
- **Checklist:** nestjs (Errors & resilience / Serverless)
- **Bằng chứng:**
  ```ts
  const res = await fetch(`${endpoint}${signUrl}`, { method, headers, body: bodyStr });
  ```
- **Vì sao sai / rủi ro:** không có `AbortController`/timeout. Nếu Tuya chậm/treo, function Vercel giữ kết nối tới hết giới hạn → tốn thời gian thực thi, có thể cạn slot. Cross-cutting (ảnh hưởng cả UsersService), nhưng push/template kế thừa.
- **Cách sửa đề xuất:** thêm `AbortController` + `setTimeout(..., ~8–10s)` trong `TuyaCloudService.request`, hủy và ném lỗi rõ ràng khi quá hạn. (Sửa 1 chỗ, lợi cho toàn backend.)

### [🟡 M-2] Lỗi business Tuya → HTTP 500 (sai mã), không có global exception filter
- **Vị trí:** `apps/backend/src/notifications/notifications.service.ts` (mọi method để lỗi `TuyaCloudService` nổi lên) · không có exception filter trong `app.module.ts`/`main.ts`
- **Checklist:** nestjs (Errors & resilience)
- **Bằng chứng:** `TuyaCloudService.request` ném `new Error('Tuya API lỗi ...')`; NestJS mặc định map `Error` thường → `500 Internal Server Error`.
- **Vì sao sai / rủi ro:** lỗi do dữ liệu (template chưa duyệt, sai `biz_type`, uid không tồn tại) là lỗi phía client-request nhưng trả 500 → admin khó phân biệt "lỗi hệ thống" với "nhập sai". (May mắn: NestJS ẩn message của non-HttpException ở prod nên KHÔNG lộ chi tiết.)
- **Cách sửa đề xuất:** thêm global exception filter map lỗi Tuya → `502 Bad Gateway` (lỗi upstream) hoặc `400/409` cho lỗi nghiệp vụ; hoặc trong service bắt lỗi và ném `HttpException` phù hợp. Áp dụng chung toàn backend.

### [🟡 M-3] Session hết hạn ở trang đọc (Server Component) hiện lỗi thay vì về /login
- **Vị trí:** `apps/admin/app/notifications/page.tsx:13` và `apps/admin/app/notifications/templates/page.tsx:23` (qua `apiGet` → `lib/api.ts:apiGet`)
- **Checklist:** admin-web (Access control / UX), nestjs
- **Bằng chứng:**
  ```ts
  // lib/api.ts
  export async function apiGet<T>(path: string) {
    const res = await apiFetch(path, { method: 'GET' });
    if (!res.ok) throw new Error(`API ${path} lỗi: ${res.status}`); // 401 cũng vào đây
    ...
  }
  // page.tsx
  } catch (e) { loadError = ... } // → hiện "Lỗi tải template: API ... lỗi: 401"
  ```
- **Vì sao sai / rủi ro:** cookie `admin_token` còn (qua được `proxy`) nhưng đã hết hạn → backend trả 401 → trang hiện thông báo lỗi khó hiểu thay vì điều hướng đăng nhập lại. Không phải lỗ hổng bảo mật (backend vẫn chặn), nhưng UX sai + KHÔNG nhất quán với Server Action (`sendPushAction`/`createTemplateAction` đã `redirect('/login')` khi 401/403). Pattern này kế thừa từ `users/page.tsx`.
- **Cách sửa đề xuất:** trong `apiGet`, nếu `res.status === 401 || 403` → `redirect('/login')` (import `next/navigation`); hoặc throw 1 lỗi đặc thù để page bắt và redirect. Sửa ở `lib/api.ts` cho cả users + notifications.

### [🔵 L-1] `ValidationPipe` thiếu `forbidNonWhitelisted`
- **Vị trí:** `apps/backend/src/main.ts:7` (cross-cutting, ngoài file feature nhưng ảnh hưởng DTO mới)
- **Checklist:** nestjs (Validation)
- **Bằng chứng:** `new ValidationPipe({ whitelist: true, transform: true })` — checklist khuyến nghị thêm `forbidNonWhitelisted: true`.
- **Vì sao sai / rủi ro:** field lạ bị **âm thầm loại** thay vì trả 400 → client gửi sai key (vd `template_id` thay vì `templateId`) sẽ không được báo. Rủi ro thấp.
- **Cách sửa đề xuất:** thêm `forbidNonWhitelisted: true` (1 dòng, lợi toàn backend).

### [🔵 L-2] `SendPushDto.params` không ràng buộc value là string
- **Vị trí:** `apps/backend/src/notifications/dto/send-push.dto.ts:14`
- **Checklist:** nestjs (Validation)
- **Bằng chứng:** `@IsObject() @IsOptional() params?: Record<string, string>` — chỉ kiểm "là object", không kiểm value đều là string.
- **Vì sao sai / rủi ro:** nếu value là số/null, `JSON.stringify` ra `template_param` không phải toàn string → Tuya có thể từ chối. Hiện form admin chỉ gửi string nên rủi ro thấp.
- **Cách sửa đề xuất:** validate sâu (vd `@IsString({ each: true })` trên `Object.values`, hoặc custom validator), hoặc ép `String(v)` khi build payload trong service.

### [🔵 L-3] Log `uid` end-user ở mức log()
- **Vị trí:** `apps/backend/src/notifications/notifications.service.ts:38`
- **Checklist:** security-secrets (No PII in logs)
- **Bằng chứng:** `this.logger.log(\`Gửi push uid=${dto.uid} ...\`)`.
- **Vì sao sai / rủi ro:** `uid` là định danh người dùng (PII nhẹ). Không phải secret, nhưng nên hạn chế ở log mặc định.
- **Cách sửa đề xuất:** hạ xuống `logger.debug`, hoặc log dạng rút gọn/hash. (Đã làm đúng phần quan trọng: KHÔNG log `template_param`.)

### [🔵 L-4] `listTemplates` không phân trang
- **Vị trí:** `apps/backend/src/notifications/notifications.service.ts:49` + admin `templates/page.tsx`
- **Checklist:** nestjs/admin-web (Pagination)
- **Bằng chứng:** gọi `GET /msg-templates/app-notifications` không kèm offset/limit; admin render toàn bộ.
- **Vì sao sai / rủi ro:** số template thường ít → rủi ro thấp; nhưng không kiểm soát nếu Tuya trả nhiều.
- **Cách sửa đề xuất:** hỗ trợ phân trang khi xác minh được tham số phân trang của endpoint (❓doc chưa rõ).

### [🔵 L-5] `TUYA_APP_BIZ_TYPE` không nằm trong `PROD_REQUIRED`
- **Vị trí:** `apps/backend/src/config/env.validation.ts:39` (`PROD_REQUIRED`)
- **Checklist:** nestjs (Config)
- **Bằng chứng:** `TUYA_APP_BIZ_TYPE` khai optional, không thêm vào `PROD_REQUIRED`; `sendPush` dùng `config.require(...)` → ném runtime nếu thiếu.
- **Vì sao sai / rủi ro:** thiếu env ở prod chỉ phát hiện **khi gọi push** (fail-late) thay vì fail-fast lúc boot. Chấp nhận được nếu push là tính năng tùy chọn.
- **Cách sửa đề xuất:** hoặc thêm vào `PROD_REQUIRED`, hoặc ghi rõ trong `.env.example`/README rằng cần set trước khi bật push.

### [🔵 L-6] Response template trả thẳng raw Tuya cho admin
- **Vị trí:** `apps/backend/src/notifications/notifications.types.ts` (index signature `[key: string]: unknown`) → `listTemplates/getTemplate`
- **Checklist:** nestjs (Response shapes / không leak entity)
- **Bằng chứng:** type để mềm + service trả nguyên `result` từ Tuya.
- **Vì sao sai / rủi ro:** có thể lộ field nội bộ của Tuya ra admin. Chỉ admin xem nên rủi ro thấp; nhưng nên map field cần dùng khi đã biết schema thật.
- **Cách sửa đề xuất:** sau khi xác minh response thật, map sang DTO output gọn (id/name/title/type/status).

## Mục đã kiểm nhưng cần xác minh thủ công
- **`npm audit`** (backend + admin) — chưa chạy được do **E503 Nexus**; kiểm khi có registry.
- **`tsc`/`jest`/`next build`** — defer (E503). Đã review tay; cần chạy thật để chốt AC1–AC5.
- **`API_BASE_URL` phải là HTTPS ở prod** (server-only env; `lib/api.ts`/`lib/auth.ts` dùng) — xác minh cấu hình Vercel.
- **Trạng thái duyệt template** (`status` enum) — `templates/page.tsx` hiển thị thô; xác minh giá trị thật từ Tuya.
- **AC6 (gửi live)** — chặn bởi subscribe product + duyệt template + token-registration M3; xác minh khi đủ điều kiện.
- **Region:** Cloud Project EU (`openapi.tuyaeu.com`) phải khớp gói push đã authorize — xác minh trên Tuya console.

## Việc cần làm tiếp (feed vào /fix-plan hoặc /dev)
- [ ] M-1 — thêm timeout (AbortController) cho `TuyaCloudService.request` (lợi toàn backend)
- [ ] M-3 — `apiGet` xử lý 401/403 → `redirect('/login')` (sửa `lib/api.ts`, lợi cả users)
- [ ] M-2 — global exception filter map lỗi Tuya → mã HTTP đúng (502/4xx)
- [ ] L-1 — bật `forbidNonWhitelisted` trong `ValidationPipe`
- [ ] L-2 — ép/validate value `params` là string
- [ ] L-3 — hạ log `uid` xuống debug
- [ ] L-4/L-6 — phân trang + map output template khi biết schema thật
- [ ] L-5 — đưa `TUYA_APP_BIZ_TYPE` vào prod-required hoặc document
</content>
