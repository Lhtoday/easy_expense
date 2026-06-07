# AI Collaboration Guide

This guide defines how AI agents should work in ExpenseFlow. It complements `AGENTS.md`, `frontend/AGENTS.md`, `backend/AGENTS.md`, and `docs/startup-guide.md`.

## Default Context Order

Before changing files, read only the context needed for the task:

1. `AGENTS.md`
2. `frontend/AGENTS.md` or `backend/AGENTS.md` when touching that area
3. `docs/project-status.md`
4. The relevant task file under `docs/tasks/`
5. Relevant domain documents under `docs/domain/`

When starting services or checking local runtime state, read `docs/startup-guide.md` first.

## Working Style

- Prefer implementing a well-scoped request instead of stopping at a proposal.
- Keep changes aligned with the existing architecture and project rules.
- Preserve finance, audit, permission, and workflow semantics even for small UI or API changes.
- Treat missing audit logs, missing status transitions, and unclear permission checks as product risks, not polish items.
- Do not modify unrelated files or revert user changes.

## Delivery Requirements

For every completed task, report:

- Files changed
- Business behavior changed
- Validation commands run
- Known gaps or follow-up work

For core business modules, also update the relevant documentation:

- Data model
- State transition
- Permission rules
- Test notes

## AI Asset Map

- `docs/tasks/`: executable task cards and templates.
- `docs/domain/`: business state, workflow, and accounting knowledge.
- `docs/adr/`: architecture decision records.
- `.codex/skills/`: reusable Codex workflows for this repository.
- `scripts/`: stable local command entry points.

