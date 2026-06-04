# Phase 2 Expense Report Core

## Scope

Phase 2 introduces the first closed loop for expense report drafting and submission.

- Expense report header with business number, applicant, organization dimensions, status, currency, and separated amount fields.
- Expense report line items with occurrence date, expense type code, accounting subject code, cost dimensions, amount, tax amount, deductible tax, and reimbursable amount.
- Status log for every core action.
- Frontend workspace for creating drafts, editing line items, saving drafts, submitting drafts, and voiding drafts.
- Frontend list filtering by keyword and status with server-side pagination.
- Frontend detail view for report header, line items, and operation logs.

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
- `SUBMITTED -> DRAFT`: applicant withdraws a submitted report before it enters approval processing.
- `DRAFT -> VOIDED`: void.

Editing, submitting, and voiding are blocked once the report leaves `DRAFT`. Withdraw is a separate applicant action and is only available while the report is `SUBMITTED`.

Phase 2 only implements employee/applicant operations. Approval, finance review, and payment actions are intentionally left for later workflow, finance, and payment phases.

## Permissions

New permissions:

- `exp:report:read`: view expense report list and details.
- `exp:report:write`: create, edit, submit, and void expense reports.
- `exp:report:withdraw`: withdraw own submitted report before approval processing starts.

The Phase 2 migrations insert these permissions and grant them to the existing `ADMIN` role.

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
- `npm.cmd run db:migrate -- --skip-generate`: initially blocked because local PostgreSQL/Docker daemon was not running.

Additional verification after list/detail enhancements on 2026-06-04:

- `npm.cmd run test`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd run lint`: passed.

Final Phase 2 verification on 2026-06-04:

- PostgreSQL became available and `prisma migrate dev --skip-generate` reported the database was in sync.
- API smoke passed: login, create draft, submit report, amount totals, item count, and log count verified.
- Browser smoke passed: report list rendered the submitted smoke report and the detail modal rendered report details and status logs without application console errors.

Withdraw enhancement verification on 2026-06-04:

- `prisma migrate dev --skip-generate`: applied `20260604120000_phase2_expense_report_withdraw`.
- `npm.cmd run test`: passed with 9 backend tests.
- `npm.cmd run build`: passed.
- `npm.cmd run lint`: passed.
- API smoke passed: report `EXP202606040002` was created, submitted, withdrawn to `DRAFT`, and logs contained `CREATE,SUBMIT,WITHDRAW`.
