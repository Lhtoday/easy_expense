---
name: expenseflow-frontend-page
description: ExpenseFlow frontend React page workflow. Use when creating or changing frontend pages, forms, Ant Design components, TanStack Query data flows, Zustand state, routing, or user-facing workflows.
---

# ExpenseFlow Frontend Page

1. Read `AGENTS.md`, `frontend/AGENTS.md`, and the relevant task card.
2. Build the operational screen first; do not replace app workflows with marketing-style pages.
3. Use Ant Design controls and existing frontend patterns.
4. Keep high-frequency workflows efficient: submit reimbursement, approve, finance review, payment, voucher viewing.
5. Reflect backend state transitions accurately in labels, buttons, disabled states, and error handling.
6. Use React Hook Form and Zod for non-trivial forms when consistent with existing code.
7. Validate with focused frontend commands from `docs/testing-guide.md`.

When status, permission, or amount behavior changes, coordinate with backend contracts and domain documents.

