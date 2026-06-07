---
name: expenseflow-backend-module
description: ExpenseFlow backend NestJS module workflow. Use when creating or changing backend modules, controllers, services, DTOs, guards, permissions, audit behavior, Prisma access, or API behavior in the backend workspace.
---

# ExpenseFlow Backend Module

1. Read `AGENTS.md`, `backend/AGENTS.md`, and relevant files under `docs/domain/`.
2. Keep business rules out of controllers; prefer services and domain helpers.
3. Preserve explicit status transitions and audit logs for core business actions.
4. Check role permission, data permission, and amount permission for protected operations.
5. When using Prisma, keep amount fields separate: reimbursement amount, invoice amount, tax amount, deductible tax, and paid amount.
6. If schema or migration changes, use the `expenseflow-prisma-migration` skill.
7. Validate with focused backend commands from `docs/testing-guide.md`.

For approval, payment, budget, voucher, invoice, or permission modules, update the matching domain documentation when behavior changes.

