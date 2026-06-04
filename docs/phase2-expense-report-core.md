# Phase 2 Expense Report Core

## Scope

Phase 2 introduces the first closed loop for expense report drafting and submission.

- Expense report header with business number, applicant, organization dimensions, status, currency, and separated amount fields.
- Expense report line items with occurrence date, expense type code, accounting subject code, cost dimensions, amount, tax amount, deductible tax, and reimbursable amount.
- Status log for every core action.
- Frontend workspace for creating drafts, editing line items, saving drafts, submitting drafts, and voiding drafts.

## Data Model

- `exp_reports`: report header. Amount fields are stored in cents: `amount_cents`, `tax_amount_cents`, `deductible_tax_cents`, `reimbursable_cents`, and `paid_amount_cents`.
- `exp_report_items`: report line items. Each line stores its own accounting and cost dimensions.
- `exp_report_logs`: state transition and operation log. It records operator, action, timestamp, previous status, next status, and comment.

## Status Flow

Current MVP status flow:

- `DRAFT`: initial state after creating a report.
- `SUBMITTED`: employee submits a valid draft.
- `VOIDED`: employee voids a draft.

Allowed transitions:

- `DRAFT -> DRAFT`: save or update draft.
- `DRAFT -> SUBMITTED`: submit.
- `DRAFT -> VOIDED`: void.

Editing, submitting, and voiding are blocked once the report leaves `DRAFT`.

## Permissions

New permissions:

- `exp:report:read`: view expense report list and details.
- `exp:report:write`: create, edit, submit, and void expense reports.

The Phase 2 migration inserts both permissions and grants them to the existing `ADMIN` role.

## Validation And Accounting Notes

- Amounts are stored and calculated in the smallest currency unit. Backend totals are calculated from integer cents.
- Submit requires at least one line item and a positive reimbursable total.
- Deductible tax cannot exceed tax amount.
- Reimbursable amount cannot exceed the original expense amount.
- Accounting subject is present as `account_subject_code`; detailed subject mapping remains for later accounting policy phases.

## Tests

Added backend service tests for:

- Draft creation with fixed-cent totals and status log.
- Permission enforcement.
- Invalid tax and reimbursable amount relationships.
- Submit validation for drafts with no positive reimbursable amount.

Verification run on 2026-06-04:

- `npm.cmd run test`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run db:generate`: passed.
- `npm.cmd run db:migrate -- --skip-generate`: blocked because local PostgreSQL/Docker daemon was not running.
