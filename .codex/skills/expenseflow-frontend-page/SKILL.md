---
name: expenseflow-frontend-page
description: ExpenseFlow frontend React workflow for creating or changing pages, forms, Ant Design components, TanStack Query data flows, Zustand state, routing, role-based menus, report/detail modals, approval, finance review, payment, voucher, budget, invoice, and user-facing workflow behavior. Use for frontend work under frontend/src in ExpenseFlow.
---

# ExpenseFlow Frontend Page

Build operational finance software, not marketing pages. Screens should help users complete reimbursement, approval, finance review, payment, voucher, budget, and master-data workflows efficiently.

## Core Workflow

1. Read `AGENTS.md`, `frontend/AGENTS.md`, the relevant task card, and related domain docs.
2. Identify the target role, permission, status conditions, primary action, and exception states.
3. Follow existing Ant Design, TanStack Query, modal, table, form, and API patterns in `frontend/src/App.tsx`.
4. Reflect backend state transitions accurately in labels, action visibility, disabled states, error messages, and detail panels.
5. Keep high-frequency workflows efficient: submit reimbursement, handle approval task, finance-review a report, register payment, inspect voucher/budget/audit records.
6. Preserve amount clarity: show expense amount, tax, deductible tax, reimbursable amount, invoice total, paid amount, and budget impact separately where relevant.
7. Validate with focused frontend commands from `docs/testing-guide.md`.

## UX Guardrails

### Must Do

- Gate actions by both permission and report/task/payment status.
- Show finance blockers and audit-relevant details where the role makes a decision.
- Keep forms explicit for money, tax, invoice, budget, and accounting dimensions.
- Use existing selection patterns for departments, cost centers, projects, roles, and master data.
- Surface backend business errors directly enough for users to correct data.

### Must Not Do

- Do not hide compliance failures behind generic "operation failed" messages.
- Do not make payment available before finance approval.
- Do not let UI labels imply vouchers are posted when they are only drafts.
- Do not collapse budget, invoice, policy, and finance-review checks into an unreadable blob.
- Do not introduce broad visual redesigns while implementing a workflow task.

## Validation Heuristic

- UI-only copy/layout change: run frontend lint/build if TypeScript or JSX changed.
- API contract, route, query, or form behavior change: run frontend lint/build and consider backend tests.
- Critical workflow change: verify the user flow manually or with browser smoke checks when the app is running.
