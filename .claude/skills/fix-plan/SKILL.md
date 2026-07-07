---
name: fix-plan
description: Revise a feature's plan for the Tuya Smart Ice Bath project when a test failed or reality diverged from the plan - update plan.md, record why in context.md, and reset the next action. Use when the user says the "plan is wrong/sửa plan/điều chỉnh kế hoạch", or after a failed test in the dev-loop. Step 4 of the dev-loop.
---

# fix-plan - revise the plan from what you learned

Step ④ of the workflow. Full contract: [../dev-loop/SKILL.md](../dev-loop/SKILL.md).
Artifacts in **Vietnamese**.

## When you get here
A `/test` failed, or `/dev` discovered the plan doesn't match reality (an SDK
API differs, a step is too big, an assumption was wrong, a new dependency
surfaced). The point of this step is to change the *plan*, not to hack around it.

## Steps
1. **Read** `progress.md` (latest Run log / blocker), `context.md`, `plan.md` for
   the active feature, and look at the actual failure (error output, the code).
2. **Diagnose** the root cause in one or two sentences. Distinguish:
   - plan was wrong/incomplete → change the steps or acceptance criteria;
   - plan was fine, implementation was buggy → this is *not* a plan fix; route
     back to `/dev` to fix the code instead;
   - missing knowledge → recommend `/tuya-research <topic>` and link the result.
3. **Edit `plan.md`:** add/split/reorder/remove steps, adjust acceptance
   criteria, update risks. Bump "Cập nhật lần cuối". Keep step numbering stable
   where possible (append B5, B6… rather than renumbering everything).
4. **Record in `context.md`** a Decision-log entry: what changed in the plan and
   **why** (the failure that triggered it). This is the audit trail.
5. **Update `progress.md`:** re-sync the step checklist with the new plan, add a
   Run log row (`FIX-PLAN` · what changed), set phase = DEV and "Hành động kế
   tiếp" to the next concrete step.

## Gate ②
If the change is material (scope, acceptance criteria, or architecture shifts),
present a short before/after of the plan and get the user's go before resuming
DEV. Minor step tweaks can proceed without a gate.
