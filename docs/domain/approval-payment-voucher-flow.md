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

