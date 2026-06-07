---
name: expenseflow-review
description: ExpenseFlow code and product review workflow. Use when the user asks for a review, risk check, compliance check, PR review, implementation audit, or verification of ExpenseFlow changes.
---

# ExpenseFlow Review

Review findings first, ordered by severity.

Check:

- Invalid or missing status transitions.
- Missing audit logs.
- Permission checks that ignore role, data scope, or amount limits.
- Payment before finance approval.
- Voucher auto-posting without finance confirmation.
- Budget occupation not released on reject, withdraw, or void.
- Invoice duplicate check gaps.
- Amount fields collapsed into one total.
- Missing tests for changed business behavior.

Use `docs/acceptance-checklist.md` and relevant domain docs as review references.

