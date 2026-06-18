---
name: expenseflow-backend-module
description: ExpenseFlow backend NestJS module workflow for creating or changing modules, controllers, services, DTOs, guards, permissions, audit behavior, Prisma access, API contracts, status transitions, budget/payment/voucher logic, and backend tests. Use for any backend work under backend/src or backend/prisma in the ExpenseFlow repository.
---

# ExpenseFlow Backend Module

Senior backend workflow for ExpenseFlow's NestJS + Prisma financial domain. Prefer project conventions over generic NestJS examples.

## Core Workflow

1. Read `AGENTS.md`, `backend/AGENTS.md`, `docs/project-status.md`, the relevant task card, and related files under `docs/domain/`.
2. Identify the business resource, allowed states, permissions, amount fields, and audit records before editing code.
3. Keep controllers thin. Put business rules in services or small domain helpers.
4. Use explicit DTOs and validation for request bodies. Do not pass raw client payloads directly into Prisma writes.
5. Wrap state, amount, payment, voucher, approval, finance review, and budget mutations in transactions.
6. Preserve financial field separation: expense amount, invoice amount, tax amount, deductible tax, reimbursable amount, and paid amount.
7. If Prisma schema, migrations, seed data, or generated client behavior changes, use `expenseflow-prisma-migration`.
8. Validate with focused backend commands from `docs/testing-guide.md`.

## Domain Guardrails

### Must Do

- Enforce role permission, data scope, and amount limits where applicable.
- Validate status transitions before mutation and return clear business errors.
- Write audit records for core actions in the same transaction.
- Release or move budget occupation at the correct lifecycle point.
- Keep payment available only after finance approval.
- Generate voucher drafts only; do not auto-post without finance confirmation.
- Update domain documentation when behavior changes.

### Must Not Do

- Do not hardcode workflow routing where configuration or existing workflow tables should drive it.
- Do not use floating-point arithmetic for money.
- Do not merge business approval and finance review into one backend action.
- Do not use generic admin permission for high-risk actions such as payment, voucher confirmation, budget adjustment, or rule configuration.
- Do not bypass existing response, exception, auth, and Prisma module patterns.

## Validation Heuristic

- Narrow service change: run backend tests for that module, then backend build if contracts changed.
- Permission, guard, DTO, or shared service change: run backend test, lint, and build.
- Prisma change: generate client, check migration status, and run focused backend tests.
- Cross-contract change: also run frontend lint/build when frontend types or API assumptions change.
