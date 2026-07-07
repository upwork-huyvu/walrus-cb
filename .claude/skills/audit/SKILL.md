---
name: audit
description: Audit code of the Tuya Smart Ice Bath project against per-technology best practices (React Native CLI, Tuya Smart Life SDK, NestJS, Supabase, FCM, admin web, secrets/security) and produce a severity-ranked Vietnamese report in docs/audit/. Use when the user asks to "audit/review/kiểm tra chất lượng/check best practice" a feature, a part (mobile/backend/admin), a diff, or the whole codebase. Read-only - never edits product code.
---

# audit - best-practice review per technology

Read-only. You **find and report**; you do not fix product code (offer to, or
feed findings into `/fix-plan` / `/dev`). Report is written in **Vietnamese**.

## 1. Establish scope
From the user's request, resolve ONE scope:
- a **part**: `mobile` | `backend` | `admin`
- a **feature**: a `dev-workflow/<slug>/` (audit the files it touched - see its
  `context.md` file map)
- a **diff/range**: if git exists, `git diff <range>`; else an explicit file list
- **whole repo** (broadest)

If ambiguous, ask. Note the scope at the top of the report.

## 2. Detect the stack in scope
Don't assume - confirm what's actually there: glob `package.json` and read deps
(`react-native`, `@react-native`, `expo`?, `@nestjs/*`, `@supabase/*`, Tuya
native modules, `@react-native-firebase/*`), check `ios/`, `android/`,
`nest-cli.json`, `supabase/`. Pick the matching checklists from
[checklists/](checklists/):

| In scope | Checklists to apply |
|---|---|
| RN mobile app | `react-native.md`, `tuya-sdk.md` (if SDK present), `security-secrets.md` |
| NestJS backend | `nestjs.md`, `supabase.md`, `security-secrets.md` |
| Admin web | `admin-web.md`, `security-secrets.md` |
| Push notifications | (FCM section in `react-native.md` + `nestjs.md`) |
| Any | `security-secrets.md` always applies |

`security-secrets.md` runs on **every** audit.

## 3. Audit method - verify, don't pattern-match
Walk each applicable checklist item against the **real code**:
1. Search for where the concern lives (Grep/Glob), open the file, read the actual
   logic.
2. A finding requires **evidence**: `file:line` + the offending snippet + why
   it's wrong + the concrete fix. No evidence → not a finding (or mark it
   "cần xác minh thủ công").
3. Skip checklist items that don't apply to this scope; don't pad the report.
4. For broad scopes you may delegate heavy fan-out reading to the `code-auditor`
   subagent **only if the user asks** - otherwise do it inline.

## 4. Severity ranking
- 🔴 **Critical** - security hole, secret leak, data loss/corruption, broken core
  flow (e.g. AppSecret/`service_role` in client, missing RLS, region mismatch
  that breaks pairing).
- 🟠 **High** - real bug, missing validation/error handling, listener/memory
  leak, missing auth check.
- 🟡 **Medium** - correctness edge cases, perf, fragile patterns.
- 🔵 **Low / Nit** - style, naming, minor cleanup.

## 5. Write the report
Save to `docs/audit/<YYYY-MM-DD>-<scope>.md` using the structure in
[report-template.md](report-template.md). Then:
- Give the user the headline counts by severity + the top 3 issues.
- If the audited code belongs to an active feature, add a Decision-log/finding
  link in that feature's `context.md` and note follow-ups so `/fix-plan` can pick
  them up.
