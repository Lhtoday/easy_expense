---
name: expenseflow-review
description: ExpenseFlow code and product review workflow for review, risk check, compliance check, PR review, implementation audit, status-flow verification, finance-control verification, security review, or validation of ExpenseFlow changes. Use when the user asks to review code, product behavior, task completion, or business correctness.
---

# ExpenseFlow Review

Review like a finance-system maintainer. Findings come first, ordered by severity, with file/line references when reviewing code.

## Review Workflow

1. Read `docs/acceptance-checklist.md` and relevant domain docs.
2. Identify the changed business surface: report, approval, finance review, payment, voucher, budget, invoice, attachment, identity, or master data.
3. Check state transitions, permissions, audit logs, amount handling, budget movement, and tests.
4. Prioritize bugs and compliance gaps over style preferences.
5. Report findings first. If no issues are found, state that clearly and mention residual test gaps.

## High-Risk Checks

- Invalid, missing, or UI/backend-mismatched status transitions.
- Missing audit logs for core business actions.
- Permission checks that ignore role, data scope, or amount limits.
- Payment before finance approval.
- Voucher posting or confirmation without dedicated finance permission.
- Voucher generation implying posting rather than draft creation.
- Budget occupation not released on reject, withdraw, finance reject, or void.
- Budget approved/actual buckets moved at the wrong lifecycle point.
- Invoice duplicate, invoice coverage, tax, buyer/seller, or currency check gaps.
- Amount fields collapsed into one total or calculated with floating point numbers.
- Attachment preview/download bypassing authorization.
- Missing tests for changed business behavior.

## Output Shape

Use this structure:

1. Findings, ordered by severity.
2. Open questions or assumptions.
3. Brief change summary only after findings.
4. Validation gaps or recommended focused tests.

Do not bury a blocking finance or audit issue under a general summary.
