---
name: test
description: Verify the latest change for a feature of the Tuya Smart Ice Bath project — run the right checks (typecheck, lint, unit/e2e tests, build) or produce a manual device/native test checklist — and record pass/fail in progress.md. Use when the user asks to "test/kiểm thử/verify" the current work. Step 3 of the dev-loop.
---

# test — verify the latest step

Step ③ of the workflow. Full contract: [../dev-loop/SKILL.md](../dev-loop/SKILL.md).
Reports in **Vietnamese**.

## Pick the right checks for what changed
Read `plan.md` ("Cách kiểm thử bước này") + `progress.md` to know the step, then:

- **Backend (NestJS):** `npm run lint` · `npm run test` (unit) · `npm run test:e2e`
  if present · `npm run build`. Prefer adding/adjusting a test for the new
  behaviour over manual checks.
- **Mobile JS logic (RN, non-native):** typecheck (`tsc --noEmit`) · `npm test`
  (Jest) · lint. For pure logic, write a unit test.
- **Mobile native / Tuya SDK / pairing / BLE / FCM push:** these usually can't
  run in this environment. Instead **emit a manual test checklist** the human
  runs on a real device, derived from the acceptance criteria — e.g. region
  matches Cloud Project, account is Home Owner, WiFi EZ + AP fallback, BLE
  pairing, target-temp command round-trips, status listener updates UI, reconnect
  after backgrounding. Mark these `⏳ chờ test thiết bị` in the log.
- **Admin web:** typecheck · lint · component/e2e tests if present · build.

Always run typecheck + lint when a toolchain exists. Run the **narrowest** suite
that covers the change first; widen only if it passes.

## Record results — required
- Update `progress.md` Run log: time · `TEST B#` · ✅/❌/⏳ · the exact command(s)
  run and key output (paste failing assertion / error, or link a saved log).
- Tick acceptance-criteria checkboxes that now pass.
- Set "Hành động kế tiếp":
  - **All green + all AC met** → suggest FINISH (mark `done` in `INDEX.md`,
    write the `context.md` summary, recommend `/audit <scope>`).
  - **More steps remain** → next step via `/dev`.
  - **❌ failed or behaviour diverged from plan** → `/fix-plan`.

## Honesty rule
Report results faithfully. If a suite was skipped (e.g. needs a device), say so
and mark it ⏳ — never report green for checks you didn't actually run.
