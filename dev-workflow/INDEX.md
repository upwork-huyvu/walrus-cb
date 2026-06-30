# Bảng điều phối tiến trình — Tuya Smart Ice Bath App

> Nơi DUY NHẤT trả lời "dự án đang ở đâu?". Mọi feature đều phải có 1 dòng ở đây.
> `/plan` thêm dòng mới; `/dev` `/test` `/fix-plan` cập nhật cột Phase/Trạng thái.

- **Cập nhật lần cuối:** 2026-06-30

> ⚠️ **M1 đã MỞ RỘNG scope (2026-06-28).** Bản brief mới đưa thêm **Part A (thư
> viện npm Tuya SDK)**, **Part C (backend NestJS + quản lý user)** và **Part D
> (admin web)** vào M1 (trước đây C/D thuộc M2). Ngân sách $250 ban đầu **cần ET lại**.
> M1 nay được chia nhỏ thành các feature A/B/C/D bên dưới.

## Đang làm / Tồn đọng
| Feature (slug) | Milestone | Phần | Phase | Trạng thái | Cập nhật | Thư mục |
|---|---|---|---|---|---|---|
| m1-tuya-sdk-library | M1·A | mobile/lib | DEV | in_progress (audit ✅ API Android đúng; **build-ready wired** aar+gradle.properties+Maven repos, BLE pairing + iOS RCT_EXPORT_MODULE done; còn JDK17+Android SDK + console SHA-256/DC + iOS 17 method) | 2026-06-29 | [↗](m1-tuya-sdk-library/progress.md) |
| m1-tuya-sdk-expansion | M1·A+ | mobile/lib | DEV | in_progress — **15/15 bước code XONG** (12 TurboModule: +Scene/Timer/Message/Member/Matter/Mesh, Home weather/listener, Pairing combo/auto-token) + **2 review adversarial** (Đợt2 1 fix, Đợt3 0 finding) + README. Android wired phần lớn; Scene/Matter/Mesh/pairing-adv = skeleton+intended-call. **Chặn:** JDK17+SDK/Xcode + device cho AC6 | 2026-06-30 | [↗](m1-tuya-sdk-expansion/progress.md) |
| m1-backend-scaffold | M1·C1 | backend | DEV | in_progress (B1–B5 + **Tuya token LIVE ✅** Central EU; AC3 DB Supabase chờ) | 2026-06-29 | [↗](m1-backend-scaffold/progress.md) |
| m1-backend-user-mgmt | M1·C2 | backend | DEV | in_progress (B1–B3 code xong; env→verify live) | 2026-06-28 | [↗](m1-backend-user-mgmt/progress.md) |
| m1-backend-admin-auth | M1·C3 | backend | DEV | in_progress (B1–B3 code xong; env→verify live) | 2026-06-29 | [↗](m1-backend-admin-auth/progress.md) |
| m1-admin-web | M1·D | admin | DEV | in_progress (B1–B4 code xong; env→verify live) | 2026-06-29 | [↗](m1-admin-web/progress.md) |
| m1-mobile-scaffold | M1·B(clone UI) | mobile | DEV | in_progress — **B1–B6 code XONG** (clone UI 12 screens + **B6 nối lib Tuya**: adapter require+mock, DP-id, useAppState device→Tuya). `tsc`/`jest` deferred (no node_modules+503). Còn AC6 device round-trip (build+thiết bị+DP schema) → rồi feature mobile pairing/dashboard | 2026-06-30 | [↗](m1-mobile-scaffold/progress.md) |

## Backlog M1 — chia theo brief mở rộng (chạy `/plan <slug>` khi tới)
> Thứ tự phụ thuộc: **A → B**; **C → D** (track backend/admin chạy song song được).
| Feature (slug) | Milestone | Phần | Mô tả ngắn |
|---|---|---|---|
| m1-mobile-auth | M1·B2 | mobile | Màn đăng ký/đăng nhập: email + Google + Apple → lấy idToken → `thirdLogin` |
| m1-mobile-home-setup | M1·B3 | mobile | Setup Home đầu tiên cho user (1 nhà/user) |
| m1-mobile-pairing | M1·B4 | mobile | In-app pairing: Wi-Fi (EZ/AP) + Bluetooth, màn hướng dẫn, loading/lỗi |
| m1-mobile-dashboard | M1·B5 | mobile | Dashboard: hiển thị nhiệt độ thực tế + đặt nhiệt độ mục tiêu + status real-time |

## Backlog M2 / M3 (ngoài phạm vi M1)
| Feature (slug) | Milestone | Phần | Mô tả ngắn |
|---|---|---|---|
| m2-ui-completion | M2 | mobile | Hoàn thiện UI từ design (đèn, UV, defrost), tối ưu mobile |
| m2-backend-device-mapping | M2 | backend | User profile chi tiết + device mapping + RLS (phần backend còn lại) |
| m2-home-rooms-roles | M2 | mobile | Quản lý nhà nâng cao: gán phòng, phân quyền thiết bị, multi-home |
| m2-admin-device-usage | M2 | admin | Admin web: theo dõi trạng thái thiết bị + dữ liệu usage (phần admin còn lại) |
| m3-into-the-cold | M3 | mobile | Đồng hồ đếm ngược + daily summary |
| m3-push-fcm | M3 | mobile+backend | Push notification qua Firebase (nhắc dọn, cảnh báo) |
| m3-filter-reminder | M3 | mobile | Nhắc bộ lọc: trạng thái + reset + link mua |
| m3-testing-delivery | M3 | all | Kiểm thử toàn diện, tối ưu, bàn giao mã nguồn + tài liệu |

## Đã xong
| Feature (slug) | Milestone | Phần | Ngày xong | Đã audit? | Thư mục |
|---|---|---|---|---|---|
| — | | | | | |

## Đã thay thế (Superseded)
| Feature (slug) | Thay bằng | Ngày | Lý do |
|---|---|---|---|
| m1-scaffold-and-tuya-init | m1-tuya-sdk-library + m1-mobile-scaffold | 2026-06-28 | Đổi hướng: wrap Tuya SDK thành thư viện npm riêng (TurboModule) thay vì nhúng native vào app; M1 mở rộng scope |

## Bị chặn
| Feature (slug) | Đang chờ gì | Từ ngày |
|---|---|---|
| m1-tuya-sdk-library | Build-ready đã wire (2026-06-29). Chặn cứng: **JDK17 + Android SDK** (máy đang JDK8, chưa có SDK) → không assembleDebug được tại chỗ. Còn console: applicationId TRÙNG package + keystore SHA-256 + DC. iOS cần Mac. Xem progress.md. | 2026-06-29 |

---
### Quy ước
- **Phase:** PLAN → DEV → TEST → FIX-PLAN → DONE (xem `.claude/skills/dev-loop/SKILL.md`).
- **Milestone:** M1 Nền tảng, Kết nối lõi & Quản lý User (mở rộng — ngân sách cần ET lại) · M2 UI & Backend/Admin nâng cao · M3 Nâng cao & bàn giao.
- **Phần:** mobile (RN CLI) · lib (`packages/tuya-react-native`) · backend (NestJS+Supabase) · admin (Next.js web).
