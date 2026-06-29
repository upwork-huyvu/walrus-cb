# Tuya Smart Ice Bath App — project guide

Mobile app to control a Tuya-based ice bath, replacing the Smart Life/Tuya app
with a custom UI. See [docs/](docs/) for the client overview + milestones (VN).

## Stack
- **Mobile:** React Native **CLI** (NOT Expo — native modules needed) + **Tuya
  Smart Life App SDK** (Wi-Fi + Bluetooth) + Firebase Cloud Messaging.
- **Backend:** **NestJS** REST API on **Vercel** + **Supabase** (Postgres + Auth).
- **Admin:** web dashboard (users, linked devices, usage).
- `replit_generate/` is an **Expo Snack UI prototype** — design reference only,
  to be migrated to RN CLI. Don't ship it.

## Hard constraints (violating these breaks the project)
- Tuya **Data Center/region** of the SDK must match the Tuya **Cloud Project**
  Data Center (EU intent) — else devices won't be found.
- The Tuya account used for SDK linking must be the **Owner** of the Home.
- Secrets: Tuya **AppSecret**, Supabase **service_role**, FCM server key, signing
  keys are **server/native-only, never in the app bundle or repo**. Clients hold
  only public keys (Supabase anon, Tuya AppKey).

## Skills (slash commands) — `.claude/skills/`
**Dev loop (plan → dev → test → fix-plan), state in `dev-workflow/`:**
- `/dev-loop` — orchestrate the whole loop; **canonical workflow spec lives here**.
- `/plan` — make/refresh a feature plan → `dev-workflow/<slug>/plan.md`.
- `/dev` — implement the next plan step; update `context.md` + `progress.md`.
- `/test` — run the right checks (or emit a device test checklist); record results.
- `/fix-plan` — revise the plan when tests fail / reality diverges.

**Quality & knowledge:**
- `/audit` — best-practice review per technology → report in `docs/audit/`
  (read-only; checklists in `.claude/skills/audit/checklists/`).
- `/tuya-research <topic>` — deep-research official Tuya docs → cited note in
  `docs/research/` (run this before coding anything that touches the SDK).

## Workflow state — `dev-workflow/`
- `INDEX.md` — global process board ("where is the project?"). Keep it current.
- `<feature-slug>/plan.md` (what to do) · `context.md` (memory: decisions,
  findings, file map) · `progress.md` (process: phase, checklists, run log,
  next action).
- **Two rules:** read `progress.md`+`context.md` before acting; write them after
  every step. Artifacts are in **Vietnamese**; code/skills in English.
- Active feature now: `m1-scaffold-and-tuya-init` (PLAN). Start there.

## Conventions
- Detect app locations by globbing `package.json` + reading deps; don't hardcode.
- Recommended layout: `apps/mobile` (RN CLI), `apps/backend` (NestJS), `apps/admin`.
- Confirm before irreversible/outward actions (deploy, shared DB migration).
