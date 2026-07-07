---
name: plan
description: Create or open the implementation plan for a feature/task of the Tuya Smart Ice Bath project. Writes dev-workflow/<feature>/plan.md (+ initializes context.md, progress.md, and registers the feature in INDEX.md). Use when the user asks to "plan/lập kế hoạch" a feature, start a new task, or break work into steps before coding. Step 1 of the dev-loop.
---

# plan - make/refresh a feature plan

Step ① of the workflow. Full contract: [../dev-loop/SKILL.md](../dev-loop/SKILL.md).
Artifacts in **Vietnamese**.

## Inputs
- The feature/task the user wants. If vague, ask 1-2 sharp questions (scope,
  which milestone, which part: mobile/backend/admin).
- Read `docs/` (project overview + milestones) and `dev-workflow/INDEX.md`.

## Steps
1. **Slugify** the feature → `<feature-slug>` (e.g. `m1-wifi-pairing`). If a
   folder already exists, you are *refreshing* - read existing files, don't
   clobber `context.md` history.
2. **Investigate before planning.** Glob the repo for the relevant code
   (`package.json`, existing modules) so steps map to real files, not guesses.
   If the feature touches the Tuya SDK and there's no research note yet, tell
   the user to run `/tuya-research <topic>` first and link it once it exists.
3. **Create the folder** `dev-workflow/<feature-slug>/` and write the three
   files from templates:
   - `plan.md` ← [../dev-loop/templates/plan.md](../dev-loop/templates/plan.md)
   - `context.md` ← [../dev-loop/templates/context.md](../dev-loop/templates/context.md)
   - `progress.md` ← [../dev-loop/templates/progress.md](../dev-loop/templates/progress.md)
     (phase = PLAN, copy the step list + acceptance criteria into its checklists,
     set "Hành động kế tiếp" = run `/dev` on B1).
4. **Register** the feature as a row in `dev-workflow/INDEX.md` (Đang làm).
5. **Quality bar for the plan:**
   - Acceptance criteria are *verifiable* (a human/test can check yes/no).
   - Steps are small enough to finish in one dev+test pass; each names the files
     it will touch and how it'll be tested.
   - Risks/open questions are explicit. Project ràng buộc are captured (Tuya Data
     Center == Cloud Project region; Home Owner permission; RN CLI not Expo;
     service_role key server-only; EU data residency).

## Output / Gate ①
Present a short summary (goal, # steps, key risks) and ask the user to confirm
before any code is written. Do not start DEV in the same turn unless told to.
