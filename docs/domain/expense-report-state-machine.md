# Expense Report State Machine

This document is the AI-readable source of truth for reimbursement lifecycle behavior. Keep implementation and UI labels aligned with it.

## Core States

- `DRAFT`: employee is preparing the report.
- `SUBMITTED`: report is submitted and waiting for business approval.
- `BUSINESS_APPROVED`: business approval passed, waiting for finance review.
- `BUSINESS_REJECTED`: business approval rejected and returned to employee.
- `FINANCE_APPROVED`: finance review passed, waiting for payment.
- `FINANCE_REJECTED`: finance review rejected and returned to employee or void flow.
- `PAID`: cashier payment completed.
- `VOUCHER_DRAFTED`: accounting voucher draft generated.
- `VOUCHER_CONFIRMED`: finance role confirmed voucher posting.
- `WITHDRAWN`: submitter withdrew before final approval.
- `VOIDED`: report was voided.

## Required Principles

- Business approval and finance review are separate responsibilities.
- Payment is allowed only after finance approval.
- Voucher generation creates a draft first.
- Rejection, withdrawal, and void actions must release relevant budget occupation.
- Every transition must write an audit log with actor, action, time, previous state, next state, and comment when applicable.

## Transition Notes

- `DRAFT -> SUBMITTED`: validate lines, invoices, cost center, project, policy, and budget occupation.
- For expense types that require invoices, linked invoice tax-inclusive totals must be at least the expense amount on the related line; otherwise the report is over-claimed and must not submit when the rule action blocks submission.
- `SUBMITTED -> BUSINESS_APPROVED`: record approval action and move to finance review.
- `SUBMITTED -> BUSINESS_REJECTED`: record rejection and allow correction/resubmission where supported.
- A report with an existing approved business-approval instance must not be reopened by only changing the report status; corrections after mistaken approval require an explicit audited reversal, void, or future reopen workflow that also invalidates or supersedes the old approval instance.
- `BUSINESS_APPROVED -> FINANCE_APPROVED`: validate invoice compliance, accounting mapping, tax fields, and duplicate invoice checks.
- `FINANCE_APPROVED -> PAID`: require cashier/payment permission.
- `PAID -> VOUCHER_DRAFTED`: generate accounting voucher draft.
- `VOUCHER_DRAFTED -> VOUCHER_CONFIRMED`: require finance confirmation permission.
