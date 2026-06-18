---
name: expenseflow-submit-progress
description: ExpenseFlow commit, push, and progress-recording workflow. Use when the user asks to submit, commit, push, save current progress, record work status, wrap up before interruption, or mark a feature/phase/task complete or paused after development in E:\codex\code\expense.
---

# ExpenseFlow Submit Progress

Use this skill to close a work session cleanly: verify the relevant work, commit intended changes, push to `origin/main` unless the user specifies another branch, and update project progress docs.

## Workflow

1. Read `.codex/skills/expenseflow-git/SKILL.md` and follow its Git rules.
2. Inspect status with `git -c safe.directory=E:/codex/code/expense status --short --branch`.
3. Identify intended files. Do not stage unrelated user changes.
4. Run relevant validation before committing meaningful code changes:
   - Backend change: `npm.cmd run test --workspace backend`, plus backend lint/build when appropriate.
   - Frontend change: `npm.cmd run lint --workspace frontend` and `npm.cmd run build --workspace frontend`.
   - Cross-workspace change: prefer the focused commands above; use root `npm.cmd run test`, `npm.cmd run lint`, or `npm.cmd run build` when the blast radius is broad.
5. Update progress docs before the main commit when the work is complete or materially paused:
   - `docs/project-status.md` for phase/task completion, interruption notes, validation results, and known follow-ups.
   - `docs/current-priorities.md` when the active focus or next phase changes.
   - Domain docs under `docs/domain/` when business behavior, status flow, permissions, budget, payment, approval, or accounting rules changed.
6. Stage only intended files, commit with a concise conventional message, and push.
7. After a successful push, add a small progress note to `docs/project-status.md` if the user explicitly asked to record after push. Include the pushed commit hash, branch, remote, and date. Commit and push that docs-only note.
8. Finish by reporting:
   - pushed commit hash(es)
   - branch and remote
   - whether the working tree is clean
   - where progress was recorded

## Safety

- Never use destructive Git commands unless the user explicitly asks.
- If the working tree contains unrelated changes, leave them unstaged and mention them.
- If push fails because of GitHub connectivity, follow the troubleshooting guidance in `expenseflow-git`.
- If validation cannot be run, say why in the final answer and record the gap when it matters.
