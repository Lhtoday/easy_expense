# Approval, Payment, And Voucher Flow

This document separates business approval, finance review, cashier payment, and voucher confirmation.

## Responsibilities

- Submitter: create, edit, submit, withdraw where allowed.
- Business approver: approve or reject business legitimacy and budget fit.
- Finance reviewer: verify invoice compliance, accounting mapping, tax fields, and policy fit.
- Cashier: execute payment after finance approval.
- Finance voucher confirmer: confirm voucher draft posting.

## Guardrails

- Do not merge business approval and finance review into one node.
- Do not allow payment before finance approval.
- Do not auto-post vouchers without finance confirmation.
- Do not allow high-risk actions through generic admin permission alone.

## Audit Requirements

Record audit logs for:

- Submit
- Withdraw
- Business approve/reject
- Finance approve/reject
- Payment
- Voucher draft generation
- Voucher confirmation
- Budget adjustment
- Permission or role changes

## Phase 7 Implementation Notes

- Business approval now moves an expense report from `SUBMITTED` to `BUSINESS_APPROVED`.
- Finance review uses `/finance-reviews/reports` for the workbench list and `/finance-reviews/reports/:id/approve`, `/return`, and `/reject` for audited actions.
- Finance approval moves `BUSINESS_APPROVED` to `FINANCE_APPROVED` and confirms budget occupation.
- Finance return moves `BUSINESS_APPROVED` to `FINANCE_REJECTED`, releases budget occupation, and allows the submitter to supplement and resubmit.
- Finance rejection moves `BUSINESS_APPROVED` to `REJECTED` and releases budget occupation.
- Finance review actions are recorded in `exp_finance_reviews` and mirrored into report status logs.
- Finance approval must run finance review checks first. BLOCK issues such as missing account subjects, missing cost centers, inconsistent tax totals, duplicate invoices, or invalid invoice tax totals prevent approval.
- Finance reviewers may adjust report item account subject, cost center, project, tax amount, and deductible tax amount while the report is `BUSINESS_APPROVED`. The adjustment keeps the report status unchanged, recalculates report totals, records `ADJUST` in `exp_finance_reviews`, and mirrors `FINANCE_ADJUST` into report status logs.

## Phase 8 Implementation Notes

- Cashier payment uses `/payments/reports` for the payable workbench and `/payments/reports/:id/register` or `/fail` for audited actions.
- Only reports in `FINANCE_APPROVED` can be paid. Payment before finance approval is rejected.
- Successful payment records `exp_payments`, creates an `exp_payment_batches` row, writes `PAYMENT_REGISTER` into report status logs, moves the report to `PAID`, and updates `paidAmountCents`.
- Failed payment records `exp_payments`, creates a failed batch, writes `PAYMENT_FAIL` into report status logs, and keeps the report in `FINANCE_APPROVED` so the cashier can retry.
- Phase 8 MVP requires successful payment amount to equal the remaining payable amount. The payment tables keep amount/status fields for future partial payment support, but partial successful payment is intentionally blocked until budget occupation splitting is implemented.
- Payment actions require `exp:payment:pay`; viewing the payment workbench requires `exp:payment:read`.
