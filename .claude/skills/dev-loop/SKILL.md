---
name: dev-loop
description: Orchestrate the full feature development loop (plan -> dev -> test -> fix-plan) for the Tuya Smart Ice Bath project, persisting context and progress to dev-workflow/<feature>/ state files so work survives across sessions. Use when starting a new feature/task, resuming unfinished work, or when the user asks to "build/làm a feature end-to-end", "chạy dev loop", "tiếp tục task". The discrete steps (plan, dev, test, fix-plan) can also be run on their own.
---

# dev-loop — feature development orchestrator

This is the **canonical spec** for the project's development workflow. The
discrete skills `plan`, `dev`, `test`, `fix-plan` all follow the state-file
contract defined here — when in doubt, this file wins.

**Project:** Tuya Smart Ice Bath App.
**Stack:** React Native CLI mobile app (Tuya Smart Life App SDK, native modules,
FCM) · NestJS backend (REST API on Vercel) + Supabase (Postgres + Auth) · Admin
web dashboard. See `docs/` for the project overview + milestones.

**Language rule:** all *artifacts you write into `dev-workflow/`* (plan, context,
progress, logs) are in **Vietnamese** — they are for the human. Skill
instructions stay in English.

## What this skill does

Runs the loop below, automatically chaining the discrete steps, and **pausing at
human gates** so the user can review/audit before risky work proceeds (this is
the "hybrid" model — you can also invoke any single step directly).

```
        ┌─────────────────────────────────────────────┐
        ▼                                             │
   ┌─────────┐    ┌───────┐    ┌────────┐    ┌──────────────┐
   │  PLAN   │──▶ │  DEV  │──▶ │  TEST  │──▶ │  done? ──yes─▶ FINISH
   └─────────┘    └───────┘    └────────┘    └──────┬───────┘
     gate ①                       │ fail/diverge     │ no
                                  ▼                  │
                            ┌────────────┐           │
                            │  FIX-PLAN  │───────────┘
                            └────────────┘
                              gate ②
```

- **Gate ①** — after PLAN, before writing code. Show the plan, get a "go".
- **Gate ②** — after FIX-PLAN when the plan changes materially. Show the diff.

## State files — the contract

All state lives under `dev-workflow/`. One global board + one folder per feature:

```
dev-workflow/
  INDEX.md                  ← global process board: every feature + its status/phase
  <feature-slug>/
    plan.md                 ← the plan: steps, acceptance criteria, milestone link
    context.md              ← the CONTEXT FILE: decisions, file map, findings, gotchas,
                              links to research/audit. The memory across sessions.
    progress.md             ← the PROCESS FILE: current phase, step checklist + status,
                              run log (dev/test results), "next action"
```

Templates live next to this file in `templates/`. Copy them verbatim, then fill in:

- [templates/plan.md](templates/plan.md)
- [templates/context.md](templates/context.md)
- [templates/progress.md](templates/progress.md)
- [templates/INDEX.md](templates/INDEX.md)

`<feature-slug>` = lowercase kebab, prefixed with milestone when relevant, e.g.
`m1-tuya-sdk-init`, `m1-wifi-pairing`, `m2-admin-user-list`.

### Two rules that keep the loop honest

1. **Read before you act.** At the start of every step, read `progress.md` and
   `context.md` for the active feature. Never assume state — load it.
2. **Write after every step.** Every step ends by updating `progress.md`
   (what happened, next action) and, if anything was decided/discovered,
   `context.md`. A step that changed code but left the files stale is incomplete.

## The loop (orchestrator algorithm)

1. **Resolve the active feature.**
   - User named a feature/task → slugify it.
   - Else read `dev-workflow/INDEX.md` and pick the one whose status is
     `in_progress`; if several, ask which.
   - New feature → run PLAN. Existing → read its `progress.md` and resume at
     `next action`.

2. **PLAN** — invoke the `plan` step (see [../plan/SKILL.md](../plan/SKILL.md)).
   Produce `plan.md`, init `context.md` + `progress.md`, register in `INDEX.md`.
   **Gate ①:** present the plan summary, wait for go. If the feature touches Tuya
   SDK and `context.md` has no research link yet, recommend running
   `tuya-research` first.

3. **DEV** — invoke the `dev` step (see [../dev/SKILL.md](../dev/SKILL.md)).
   Implement the next unchecked step in `plan.md`. Update `context.md`
   (decisions, files touched, new gotchas) and tick the step in `progress.md`.

4. **TEST** — invoke the `test` step (see [../test/SKILL.md](../test/SKILL.md)).
   Run the right checks for what changed (unit/e2e/build/typecheck/lint, or a
   manual checklist for device/native work). Record pass/fail + output in
   `progress.md`.

5. **Decide.**
   - All `plan.md` steps done **and** acceptance criteria met → **FINISH**:
     mark the feature `done` in `INDEX.md`, summarize in `context.md`, and
     suggest running `/audit` on the changed scope.
   - Test failed, or reality diverged from the plan → **FIX-PLAN**.
   - Otherwise → loop back to **DEV** (next step).

6. **FIX-PLAN** — invoke the `fix-plan` step (see
   [../fix-plan/SKILL.md](../fix-plan/SKILL.md)). Revise `plan.md`, record *why*
   in `context.md`. **Gate ②** if the change is material. Then back to DEV.

## When to stop and ask the user

- A plan step needs a real device, Tuya credentials, a Supabase project, or
  any secret/credential you don't have. Pause, write what's blocking into
  `progress.md` → `next action`, and ask.
- An irreversible / outward-facing action (deploy, db migration on a shared
  project, publishing). Confirm first.
- The plan would change materially (Gate ②).

## Notes

- This repo is not yet a git repo and the apps are not scaffolded. The very
  first feature is usually "scaffold the monorepo + RN CLI app". Detect app
  locations by globbing for `package.json` and reading deps — do not hardcode
  paths.
- Keep `INDEX.md` current: it is the single place to answer "where is the
  project right now?".
