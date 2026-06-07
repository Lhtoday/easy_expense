---
name: expenseflow-prisma-migration
description: ExpenseFlow Prisma schema and migration workflow. Use when changing database models, Prisma schema, migrations, seed data, accounting dimensions, budget fields, invoice uniqueness, audit tables, or generated Prisma client behavior.
---

# ExpenseFlow Prisma Migration

1. Read `AGENTS.md`, `backend/AGENTS.md`, and relevant domain docs before editing schema.
2. Preserve auditability and financial field separation.
3. Add indexes and unique constraints for duplicate invoice detection where applicable.
4. Treat destructive migration changes as high risk; explain data impact before applying.
5. Use the local database URL from `docs/startup-guide.md`.
6. Run `npm.cmd run db:generate` after schema changes.
7. Check migration status with `npm.cmd --workspace backend exec prisma migrate status`.

Use `prisma migrate dev` only when intentionally creating or updating a development migration.

