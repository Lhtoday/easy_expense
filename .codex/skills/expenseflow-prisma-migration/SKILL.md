---
name: expenseflow-prisma-migration
description: ExpenseFlow Prisma schema and migration workflow for database models, migrations, seed data, generated Prisma Client behavior, accounting dimensions, budget fields, invoice uniqueness, audit tables, payment/voucher tables, and financial constraints. Use whenever backend/prisma/schema.prisma or backend/prisma/migrations changes.
---

# ExpenseFlow Prisma Migration

Prisma changes are finance-domain contract changes. Treat schema, migration, and generated client updates as business-sensitive work.

## Core Workflow

1. Read `AGENTS.md`, `backend/AGENTS.md`, `docs/project-status.md`, and relevant domain docs before editing schema.
2. Identify data model impact: status flow, audit tables, permissions, budget buckets, accounting dimensions, invoice uniqueness, payment/voucher lifecycle.
3. Preserve financial field separation. Do not replace amount/tax/deductible/paid fields with a single total.
4. Add indexes and constraints for lookup, duplicate invoice detection, and idempotency where applicable.
5. Treat destructive changes as high risk; explain data impact before applying.
6. Use the local database URL from `docs/startup-guide.md`.
7. Run `npm.cmd run db:generate` after schema changes.
8. Check migration status with `npm.cmd --workspace backend exec prisma migrate status`.

## Migration Guardrails

### Must Do

- Keep audit tables append-oriented unless a domain doc explicitly allows otherwise.
- Keep money as integer cents or other fixed-unit representation.
- Include foreign keys and indexes that support report detail, workbench lists, audit lookup, and budget reconciliation.
- Update domain docs and task/status docs when core business models change.

### Must Not Do

- Do not run `prisma migrate dev` just to start the project.
- Do not drop columns or tables without an explicit data migration and user approval.
- Do not create enum values without checking frontend status labels and domain docs.
- Do not use migration SQL that silently bypasses existing financial invariants.

## Common Commands

```powershell
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
npm.cmd run db:generate
npm.cmd --workspace backend exec prisma migrate status
npm.cmd --workspace backend exec prisma migrate deploy
```

Use `prisma migrate dev` only when intentionally creating or adjusting a development migration.
