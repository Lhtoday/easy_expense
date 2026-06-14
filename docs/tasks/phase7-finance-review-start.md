# Phase 7 Finance Review Start

## Goal

Separate business approval from finance review and provide the first finance review workbench increment.

## Scope

- Add finance review report statuses and audit actions.
- Add `exp_finance_reviews` for finance review audit records.
- Add finance review permissions, backend module, list endpoint, and approve/return/reject endpoints.
- Move budget confirmation from business approval to finance approval.
- Add a frontend finance review workbench with filtering, detail viewing, approve, return, and reject actions.

## Out Of Scope

- Detailed accounting dimension adjustment UI.
- Voucher draft generation.
- Payment registration.
- External invoice verification or OCR.

## Validation Commands

- `npm.cmd run db:generate`
- `npm.cmd run test --workspace backend`
- `npm.cmd run lint --workspace backend`
- `npm.cmd run lint --workspace frontend`
- `npm.cmd run build --workspace backend`
- `npm.cmd run build --workspace frontend`

## Notes

`prisma migrate status` requires Docker/PostgreSQL to be running with `DATABASE_URL=postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public`.

## Current Progress (2026-06-11)

- Status: in progress.
- Completed: Prisma schema and migration for finance review states/actions and `exp_finance_reviews`.
- Completed: backend `finance-reviews` module with list, approve, return, and reject endpoints.
- Completed: workflow split where business approval moves reports to `BUSINESS_APPROVED`, while finance approval moves reports to `FINANCE_APPROVED` and confirms budget occupation.
- Completed: finance return/reject release budget occupation and write finance review plus report status audit records.
- Completed: frontend finance review workbench with filtering, detail viewing, approve, return, and reject actions.
- Completed: finance review checks for accounting dimensions, tax consistency, duplicate invoices, invoice linkage, and blocking approval when BLOCK issues exist.
- Verified: `npm.cmd run db:generate`, `npm.cmd run test --workspace backend`, backend/frontend lint, and backend/frontend build.
- Blocked verification: local `prisma migrate status` could not complete because Docker Desktop/PostgreSQL was not running.
- Remaining: apply/check migration on a running local database, run browser smoke checks, then continue Phase 7 accounting dimension adjustment and editable tax correction workflows.
