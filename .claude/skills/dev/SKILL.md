---
name: dev
description: Implement the next step of a feature's plan for the Tuya Smart Ice Bath project, then update its context.md and progress.md state files. Use when the user asks to "code/dev/implement/làm tiếp" the current task, or to execute a specific step from the plan. Step 2 of the dev-loop.
---

# dev - implement the next plan step

Step ② of the workflow. Full contract: [../dev-loop/SKILL.md](../dev-loop/SKILL.md).
Code in English (comments matching surrounding code); state files in **Vietnamese**.

## Before coding (load state)
1. Resolve the active feature (user said which, or the `in_progress` one in
   `dev-workflow/INDEX.md`).
2. **Read `progress.md` then `context.md`** for that feature. Start from
   "Hành động kế tiếp". Read `plan.md` for the step's intent + acceptance.
3. Re-read the actual files you're about to change. Match existing style,
   naming, and patterns - don't invent a new convention.

## Implement
4. Do **one** plan step (the next unchecked one), end to end. Resist scope
   creep - extra ideas go to `plan.md` as new steps, not into this change.
5. Respect the project's hard rules while coding:
   - **Secrets never in client/repo:** Tuya AppSecret, Supabase `service_role`
     key, FCM server key, signing keys → env/native secure config + `.gitignore`.
     The RN app may only hold public keys (Supabase anon key, Tuya AppKey).
   - **Tuya SDK:** init region must match the Cloud Project Data Center; handle
     callbacks/listeners with proper register/unregister lifecycle; surface SDK
     error codes, don't swallow them.
   - **Backend:** validate DTOs; `service_role` only server-side; assume
     Supabase RLS is on.
6. If you hit something the plan didn't foresee (API differs, step is wrong
   size, a blocker), **stop coding** and route to `/fix-plan` - don't silently
   improvise around a broken plan.

## After coding (save state) - required
7. Update `context.md`: any decision (+ why), files touched (file map), new
   gotchas.
8. Update `progress.md`: tick the step, add a Run log row (time · `DEV B#` ·
   result · note), set phase = TEST and "Hành động kế tiếp" = run `/test`.
9. Tell the user what changed in 2-3 lines and what `/test` should verify.

A `dev` turn that edited code but left `progress.md`/`context.md` stale is **not
done**.
