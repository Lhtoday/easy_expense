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
- Since Phase 7 starts separating business approval and finance review, business approval keeps occupations in transit and finance approval confirms them into approved occupation.
- `BudgetsService.transferActual` is reserved for Phase 8 payment integration, where approved occupation will move to actual amount.
- Missing matching budget records create a warning trace and do not block submission.
- Existing matching budgets can either warn or block when available budget is insufficient, according to `control_mode`.
- Budget dimension matching treats empty budget dimensions as wildcards. For example, an active `2026-06` budget with empty department, cost center, project, expense type, and account subject can match any reimbursement item in that period and currency. When multiple budgets match, the most specific budget wins.

## Phase 8 Implementation Notes

- Payment success calls `BudgetsService.transferActual` inside the same transaction as the payment record and report status update.
- The transfer moves approved occupation into actual amount only after cashier payment is registered successfully.
- Failed payment records do not move budget buckets and keep the approved occupation available for a later retry.
- Phase 8 MVP blocks partial successful payment; this avoids splitting one approved occupation between `APPROVED` and `ACTUAL` before a dedicated partial-payment occupation model is introduced.
- If a report was paid before a matching budget existed, use `POST /budgets/reconcile-paid-report/:reportId` after creating the budget. The repair action is restricted to `exp:budget:write`, is idempotent per report item, creates `ACTUAL` occupations for matched budgets, writes `ADJUST` budget operation logs, and reports unmatched items without changing report payment status.
