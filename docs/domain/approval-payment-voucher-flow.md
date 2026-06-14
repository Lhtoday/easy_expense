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
