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
- `SUBMITTED -> BUSINESS_APPROVED`: record approval action and move to finance review.
- `SUBMITTED -> BUSINESS_REJECTED`: record rejection and allow correction/resubmission where supported.
- `BUSINESS_APPROVED -> FINANCE_APPROVED`: validate invoice compliance, accounting mapping, tax fields, and duplicate invoice checks.
- `FINANCE_APPROVED -> PAID`: require cashier/payment permission.
- `PAID -> VOUCHER_DRAFTED`: generate accounting voucher draft.
- `VOUCHER_DRAFTED -> VOUCHER_CONFIRMED`: require finance confirmation permission.

