---
name: tuya-research
description: Deep-research a Tuya Smart Life App SDK topic from the official developer.tuya.com docs (iOS + Android), follow links to detailed sub-pages, and write a synthesized, cited Vietnamese research note into docs/research/. Use when the user asks to "research/tìm hiểu/đọc tài liệu Tuya" about a capability (pairing/pairing token, device control DP, home management, OTA, login, error codes) or before implementing anything that touches the Tuya SDK.
---

# tuya-research - deep research from official Tuya docs

Produces a durable, **cited** research note (in **Vietnamese**) so the team
implements against the real SDK, not guesses. Uses `WebFetch` (and `WebSearch`
to discover deep links). Source map: [sources.md](sources.md).

## When to use
- Before any feature that touches the Tuya SDK (the `plan`/`dev-loop` skills will
  point here).
- When the user asks to understand a Tuya capability or debug an SDK error code.

## Inputs
A **topic** (e.g. "Wi-Fi EZ pairing token & timeout", "device control via DP",
"home management & owner permission", "BLE pairing", "OTA", "login/session").
If none given, ask which capability.

## Method
1. **Start from verified entry points** in [sources.md](sources.md) (both iOS and
   Android - this is an RN CLI app bridging *both* native SDKs, so cover both).
   `WebFetch` the relevant Home SDK section for the topic.
2. **Follow the links.** Tuya docs are a tree; the overview pages link to
   detailed pages (e.g. Home SDK → Device Pairing → EZ/AP/BLE). `WebFetch` each
   relevant child. Use `WebSearch` (site `developer.tuya.com`) to find the exact
   deep page for a sub-topic or an error code when you don't have the URL.
3. **Capture per platform.** For each key API/flow note: the method/class names,
   required params, callbacks/return, error codes, preconditions, and **iOS vs
   Android differences** (they matter for the RN bridge).
4. **Extract the gotchas the project already knows it cares about** and confirm
   against docs: Data Center/region must match the Cloud Project; the linking
   account must be the Home **Owner**; pairing token expiry; 2.4GHz Wi-Fi for EZ;
   BLE permissions; DP value types.
5. **Cite everything.** Every claim gets the source URL + (page title). If docs
   are ambiguous or you couldn't confirm, say so explicitly - do not invent API
   names or signatures.

## Output
Write `docs/research/tuya-<topic-slug>.md` with this shape (Vietnamese):

```
# Tuya Research: <Topic>
- Ngày: <YYYY-MM-DD> · Nguồn chính: <entry URLs>

## TL;DR (3-6 gạch đầu dòng cho người sắp code)
## Khái niệm & luồng
## API chính (bảng: Platform | Class/Method | Params | Callback/Return | Ghi chú)
   - iOS: ...
   - Android: ...
## Khác biệt iOS vs Android
## Điều kiện tiên quyết & cấu hình (region, quyền, manifest, gradle/pod)
## Mã lỗi thường gặp & cách xử lý
## Cạm bẫy / lưu ý cho dự án ice-bath
## Câu hỏi mở / cần xác minh trên thiết bị
## Nguồn (đầy đủ URL đã đọc)
```

Then:
- If a feature is active, link the note from its `context.md` ("Liên kết →
  Research").
- Append/refresh an entry in [sources.md](sources.md) if you discovered a useful
  deep link not yet listed.

## Honesty
WebFetch summarizes via a small model and can miss detail; for exact method
signatures, fetch the specific page (don't rely on an overview's paraphrase), and
flag anything you couldn't verify directly from an official page.
