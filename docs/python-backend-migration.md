# Python Backend Migration

ExpenseFlow is migrating from `backend/` NestJS to `backend_py/` FastAPI while
retaining the React frontend and the existing PostgreSQL schema.

## Current Migration Slice

Implemented in FastAPI:

- `/api/health`
- `/api/auth/login`
- `/api/auth/me`
- identity reads and maintenance for users, roles, and permissions
- master-data/config CRUD for departments, cost centers, projects, expense types,
  expense policies, budgets, GL account subjects, and GL account mappings
- expense report, finance review, payment, voucher, dashboard, and audit-chain
  read models needed by the React shell
- system audit logging for login, user/role changes, policy, budget, and GL
  configuration actions

Guarded pending actions:

- expense report create/update/submit/withdraw/void
- attachment and invoice mutations or downloads
- approval task actions
- finance review actions and item adjustments
- payment registration/failure
- budget reconciliation after payment
- voucher preview/generation/confirmation/voiding

These return `501 PYTHON_MIGRATION_PENDING` until their state machines,
transactions, budget effects, and audit records are fully ported.

## Guardrails

- Keep `/api` response envelopes compatible with the React frontend.
- Keep money in integer cents.
- Write audit logs in the same SQL transaction as migrated state-changing
  actions.
- Do not mark guarded workflow actions as successful until budget, status, and
  audit behavior matches the old NestJS service.
- Retain `backend/` as a readable reference until parity is verified.

