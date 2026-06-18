---
name: expenseflow-submit-progress
description: ExpenseFlow commit, push, and progress-recording workflow for E:\codex\code\expense. Use when the user asks to submit, commit, push, save progress, record work status, wrap up before interruption, mark a feature/phase/task complete or paused, or update project progress after development.
---

# ExpenseFlow Submit Progress

Close a work session cleanly: verify the relevant work, stage only intended changes, commit, push to `origin/main` unless told otherwise, and record project progress.

## Core Workflow

1. Read `.codex/skills/expenseflow-git/SKILL.md` and follow its Git rules.
2. Inspect status:

```powershell
git -c safe.directory=E:/codex/code/expense status --short --branch
```

3. Identify intended files and leave unrelated user changes unstaged.
4. Run relevant validation before committing meaningful code changes:
   - Backend: `npm.cmd run test --workspace backend`, plus backend lint/build when appropriate.
   - Frontend: `npm.cmd run lint --workspace frontend` and `npm.cmd run build --workspace frontend`.
   - Cross-workspace: prefer focused commands; use root `npm.cmd run test`, `npm.cmd run lint`, or `npm.cmd run build` when blast radius is broad.
   - Docs-only: no app tests required, but run `git diff --check` for touched docs when useful.
5. Update progress docs before the main commit when work is complete or materially paused:
   - `docs/project-status.md` for phase/task completion, interruption notes, validation results, and known follow-ups.
   - `docs/current-priorities.md` when active focus or next phase changes.
   - `docs/domain/` when business behavior, status flow, permissions, budget, payment, approval, voucher, or accounting rules changed.
6. Stage only intended files, commit with a concise message, and push.
7. If the user explicitly asks to record after push, add a progress note with commit hash, branch, remote, and date; commit and push that docs-only note.

## Final Report

Report:

- Pushed commit hash or hashes.
- Branch and remote.
- Whether working tree is clean.
- Where progress was recorded.
- Validation commands run and any gaps.

## Guardrails

- Never use destructive Git commands unless the user explicitly asks.
- Never stage unrelated changes.
- If push fails because of GitHub connectivity, follow `expenseflow-git`.
- If validation cannot be run, state why and record the gap when it matters.
