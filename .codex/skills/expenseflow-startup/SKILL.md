---
name: expenseflow-startup
description: ExpenseFlow local startup and runtime status workflow for starting services, checking local processes, inspecting Docker dependencies, Prisma client generation, migration status, backend health checks, frontend availability, localhost troubleshooting, and default login details. Use whenever the user asks to start, restart, inspect, or troubleshoot the local ExpenseFlow app.
---

# ExpenseFlow Startup

Startup commands are defined by `docs/startup-guide.md`. Do not infer them from package scripts without reading the guide first.

## Core Workflow

1. Read `docs/startup-guide.md`.
2. Inspect local status with `scripts/check-local.ps1` when appropriate.
3. Start Docker dependencies only when they are not already healthy.
4. Generate Prisma Client and check migration status before running the backend when database state matters.
5. Start backend first and verify `http://localhost:3000/api/health`.
6. Start frontend second and verify `http://localhost:5173`.
7. Use `npm.cmd`, not bare `npm`, on Windows PowerShell.

## Long-Running Process Rules

- In Codex Desktop automation, do not request backend and frontend long-running process permissions in parallel.
- Use hidden external PowerShell processes when the service must keep running after the command returns.
- If Docker dependencies are already healthy, do not restart them just to restart frontend/backend.
- Before stopping dev processes, inspect matching process ids and only stop project-related processes.

## Guardrails

- Do not run `prisma migrate dev` unless the task is explicitly about creating or changing a migration.
- Do not assume an occupied port belongs to this project; inspect the command line.
- Do not report the app as started until backend health and frontend availability are checked or the failure is explained.

## Key Endpoints

- Backend health: `http://localhost:3000/api/health`
- Frontend: `http://localhost:5173`
- MinIO console: `http://localhost:9001`
- Default admin: `admin@expenseflow.local` / `Admin123!`
