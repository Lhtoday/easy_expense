# Budget Occupation Flow

ExpenseFlow budgets distinguish in-transit occupation, approved occupation, and actual amount.

## Amount Buckets

- In-transit occupation: submitted or in-review reimbursement amount.
- Approved occupation: approved but not yet paid or recognized amount.
- Actual amount: paid or accounted amount.

## Lifecycle

- On submit: create or update in-transit occupation.
- On business approval: keep occupation in transit unless policy requires approved occupation at this point.
- On finance approval: move occupation to approved occupation.
- On payment/accounting confirmation: move approved occupation to actual amount.
- On reject, withdraw, or void: release occupation.

## AI Implementation Checks

- Never update only the reimbursement total and forget budget buckets.
- Budget release must be idempotent.
- Budget adjustments must create audit logs.
- Amount fields should preserve reimbursement amount, invoice amount, tax amount, deductible tax, and paid amount separately.

## Phase 6 Implementation Notes

- Budget master data is stored in `bud_budgets`.
- Budget occupations are stored in `bud_occupations`.
- Submit-time budget check traces are stored in `bud_checks`.
- Budget movement audit logs are stored in `bud_operation_logs`.
- The current approval workflow is still the MVP business-approval workflow, so `APPROVED` confirms budget occupation.
- `BudgetsService.transferActual` is reserved for Phase 8 payment integration, where approved occupation will move to actual amount.
- Missing matching budget records create a warning trace and do not block submission.
- Existing matching budgets can either warn or block when available budget is insufficient, according to `control_mode`.
