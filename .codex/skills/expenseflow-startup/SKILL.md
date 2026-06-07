---
name: expenseflow-startup
description: ExpenseFlow local startup and runtime status workflow. Use when the user asks to start the project, inspect local services, check dev server status, troubleshoot localhost, Docker, database generation, migration status, health checks, or default login details.
---

# ExpenseFlow Startup

1. Read `docs/startup-guide.md` before running startup commands.
2. Prefer `scripts/check-local.ps1` for status inspection.
3. Prefer `scripts/start-dev.ps1` for dependency startup and Prisma client generation.
4. Use `npm.cmd`, not bare `npm`, on Windows PowerShell.
5. Do not run `prisma migrate dev` unless the task is explicitly about creating or changing a migration.
6. Backend health check is `http://localhost:3000/api/health`.
7. Frontend default URL is `http://localhost:5173`.

When starting long-running dev servers from automation, use hidden external PowerShell processes as described in `docs/startup-guide.md`.

