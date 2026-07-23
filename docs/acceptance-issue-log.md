# Acceptance Issue Log

This file records user-reported testing issues before code changes are made.

## Rules

- Do not change product code when recording an issue.
- For each issue, record the observed behavior, expected behavior, impact, suspected cause, and proposed change idea.
- Mark implementation status separately after the user approves a fix.

## Issue Template

```md
### ISSUE-YYYYMMDD-NN - Short Title

- Date:
- Area:
- Status: recorded | planned | fixed | deferred
- User report:
- Observed behavior:
- Expected behavior:
- Impact:
- Suspected cause:
- Change idea:
- Notes:
```

## Issues

### ISSUE-20260722-01 - Backend Startup Fails Because ReportsModule Cannot Resolve AuthService

- Date: 2026-07-22
- Area: Backend / Reports module / Authentication guard wiring
- Status: fixed and verified
- User report: During project startup, backend does not become healthy at `http://localhost:3000/api/health`.
- Observed behavior: Docker dependencies are healthy, Prisma Client generation succeeds, and migrations are up to date. Backend compilation succeeds with 0 TypeScript errors, but Nest application startup fails before listening on port 3000.
- Expected behavior: Backend should start successfully after dependencies are healthy, and `/api/health` should return OK before frontend startup is considered complete.
- Impact: High. The project cannot complete local startup because the backend API never binds to port 3000.
- Suspected cause: `ReportsModule` uses `CurrentUserGuard`, which depends on `AuthService`, but `ReportsModule` currently imports only `PrismaModule`. `AuthService` and `CurrentUserGuard` are exported by `IdentityModule`, so the reports module likely needs to import `IdentityModule` or use a shared auth module pattern.
- Change idea: Add the module that exports `AuthService`/`CurrentUserGuard` to `ReportsModule` imports, likely `IdentityModule`, and verify there is no circular dependency. If a circular dependency appears, split guards/auth providers into a smaller shared authentication module and import that from feature modules.
- Notes: Captured backend startup error: `Nest can't resolve dependencies of the CurrentUserGuard (?). Please make sure that the argument AuthService at index [0] is available in the ReportsModule context.`
- Resolution: `ReportsModule` now imports `IdentityModule`, making `AuthService` and `CurrentUserGuard` available in the reports module context.
- Verification: On 2026-07-23, `/api/health`, `/api/reports/dashboard`, `/api/reports/audit-chain`, and browser checks for `经营看板` / `审计日志` passed.

### ISSUE-20260618-01 - Expense Draft Form Has Repeated Dimension Fields

- Date: 2026-06-18
- Area: Frontend / Expense report draft form
- Status: fixed
- User report: "很多字段重复了。" Screenshot shows `新增报销单草稿` where department, cost center, and project appear both in the report header and again inside each expense item.
- Observed behavior: The draft modal has header-level fields for department, cost center, and project. Each expense detail row also shows department, cost center, and project fields. This makes the form feel repetitive and unclear.
- Expected behavior: The form should make the relationship between header dimensions and line-item dimensions clear. Users should not need to enter the same department, cost center, or project twice unless the item intentionally overrides the report-level default.
- Impact: Medium. It increases data entry effort, makes the modal visually dense, and may cause inconsistent dimensions between the report header and item rows.
- Suspected cause: The data model supports both report-level dimensions and item-level dimensions for accounting allocation, but the frontend exposes both levels equally without explaining inheritance/default behavior.
- Change idea: Keep department, cost center, and project at the report header as defaults. In each detail row, hide the repeated dimensions by default and inherit the header values. Provide an "override dimensions" action or collapsed advanced section per item for cases where a specific line needs a different department, cost center, or project.
- Notes: Also consider auto-filling item dimensions from the header when adding a new detail row, and only submitting item-level dimensions when they differ from the header or when explicit override is enabled.
- Fix summary: Detail line department, cost center, and project fields now live behind a `覆盖单据维度` checkbox. By default, item dimensions are omitted so the backend inherits report-level dimensions.

### ISSUE-20260618-02 - Clarify Policy Limit vs Over-Invoicing Behavior

- Date: 2026-06-18
- Area: Expense policy / Invoice validation / Finance review
- Status: fixed
- User report: If an expense reimbursement amount is 80, the expense policy limit is 80, and two invoices are registered for 30 and 70, can the report succeed?
- Observed behavior: Based on current backend rules, policy limit checks `item.amountCents > maxAmountCents`, so an amount equal to the limit passes. If invoices are required, policy checks only whether linked invoice total is less than the expense amount; invoice total 100 for expense amount 80 therefore passes submission policy validation. Finance review later detects linked invoice total greater than expense amount as `ITEM_INVOICE_AMOUNT_OVER`, but this is currently a WARNING, not a BLOCK.
- Expected behavior: Business rule should be explicit. A common finance expectation is that over-invoicing should at least require confirmation, and may need to block finance approval depending on company policy.
- Impact: Medium. Users may think "发票金额大于报销金额" is acceptable because only 80 is reimbursed, while finance may consider 100 of invoices for 80 of expense to be suspicious or requiring explanation.
- Suspected cause: Expense policy and finance review use different validation purposes. Policy validation focuses on reimbursement limit and minimum invoice coverage; finance review flags over-invoicing only as a warning.
- Change idea: Keep equality with the limit as pass. Add a configurable rule for invoice total greater than expense amount: warning by default, optional block in finance review or expense policy. UI should show a clearer message such as "发票合计 100 元大于费用金额 80 元，可继续但需财务确认/说明原因" or require a remark when over-invoiced.
- Notes: Current answer for this exact scenario: submission can succeed, and finance approval can also succeed if there are no BLOCK checks, but finance review should display a warning for invoice total greater than expense amount. From a finance-control perspective, over-invoicing can be acceptable only when the reimbursed amount is capped at the actual eligible expense and the reason is clear; it should not increase reimbursement, tax deduction, budget actual amount, or accounting expense above the approved expense amount.
- Fix summary: The warning behavior remains allowed, and finance approval now writes an automatic explanatory remark for over-invoicing so the cap is clear in the audit trail.

### ISSUE-20260618-03 - Auto-Generate Finance Remark for Over-Invoicing

- Date: 2026-06-18
- Area: Finance review / Invoice validation / Audit trail
- Status: fixed
- User report: For the case `发票合计 > 报销金额`, allow continuing with a finance WARNING, and have the code automatically generate the remark reason.
- Observed behavior: Current finance review can detect invoice total greater than expense amount and show a WARNING, but there is no structured auto-generated remark attached to the finance review decision.
- Expected behavior: When linked invoice total is greater than expense amount, the system should automatically generate a clear finance remark explaining the discrepancy and confirming that reimbursement, payment, budget actual amount, and accounting expense are capped at the approved expense amount.
- Impact: Medium. This improves audit traceability and reduces repetitive manual explanation by finance reviewers.
- Suspected cause: Finance review checks are currently display-oriented warnings and are not transformed into default review comments or structured exception remarks.
- Change idea: When finance approval is initiated and over-invoicing warnings exist, auto-fill or append a default comment such as: `系统提示：关联发票价税合计 100.00 元大于费用金额 80.00 元。本次仅按费用金额/可报销金额 80.00 元报销、付款、占用预算和入账，超出 20.00 元不作为本次报销依据。` Keep the reviewer able to edit or add additional comments before approval.
- Notes: The generated remark should be included in `exp_finance_reviews.comment` and mirrored to the report log comment when finance approval succeeds, so the audit trail contains the explanation.
- Fix summary: Finance approval appends generated over-invoice remarks to both `exp_finance_reviews.comment` and the mirrored report log comment.

### ISSUE-20260618-04 - Check Panels Do Not Explain Validation Timing

- Date: 2026-06-18
- Area: Frontend / Expense report detail / Validation panels
- Status: fixed
- User report: The report detail shows `发票检查通过`, `费用政策检查`, and `预算影响`, but it is unclear when these checks were performed and why they are displayed.
- Observed behavior: The detail page displays three green panels. Invoice check appears to be derived from current detail data on the frontend, while policy checks and budget checks are persisted backend results with check time. The UI presents them together without explaining their source or trigger timing.
- Expected behavior: Each panel should clearly communicate when and how the result was produced, for example: current realtime frontend summary, submit-time policy check, submit-time budget occupation/check, or finance-review-time recheck.
- Impact: Medium. Users may not know whether the checks are live, stale, submit-time snapshots, or finance-review validations. This weakens trust in the result and makes troubleshooting harder.
- Suspected cause: The system has multiple validation layers, but the UI uses generic panel titles and only exposes a timestamp in table rows for some backend checks. The invoice panel has no explicit timestamp because it is computed from current detail data.
- Change idea: Add a small `检查来源/检查时机` line to each panel title or description. Suggested wording: invoice panel `当前详情实时汇总`, policy panel `提交报销单时生成，重新提交后更新`, budget panel `提交时占用预算，审批/付款/补录后更新占用状态`. Also consider grouping panels under a single `合规与预算检查` section with consistent status chips and last updated time.
- Notes: Do not change validation logic for this issue; the first improvement is explanatory UI text and clearer grouping.
- Fix summary: Detail check panels now show source/timing text, and the new folder tabs surface status summaries for invoice, policy, and budget checks.

### ISSUE-20260618-05 - Expense Detail Modal Is Too Tall and Status Overview Is Not Visible

- Date: 2026-06-18
- Area: Frontend / Expense report detail modal / Layout
- Status: fixed
- User report: The detail display is too large. The right scrollbar shows the modal content is very tall, and the first screen should show the report details plus the status of the three check sections.
- Observed behavior: The report detail modal starts with a large descriptions table, followed by large green check panels for invoice check, policy check, and budget impact. The panels consume a lot of vertical space, so users must scroll to understand the full detail and downstream sections.
- Expected behavior: On first view, users should immediately see the core report summary and the three check statuses: invoice, expense policy, and budget impact. Detailed tables can be expanded or viewed below after the overview.
- Impact: Medium. The modal feels heavy and makes it harder to scan report status quickly, especially when checking many reports.
- Suspected cause: The UI renders all compliance/budget panels in full detail by default, using large success Alert blocks and embedded tables instead of a compact status summary.
- Change idea: Redesign the top of the detail modal into a compact summary area:
  - Keep a smaller report summary table or key-value grid.
  - Add a horizontal `检查状态` summary row with three compact status cards/chips: `发票`, `费用政策`, `预算`.
  - Show status, warning/block count, and last check time in each chip.
  - Put detailed check tables inside collapsible panels or tabs below the summary.
  - Consider modal body max height with internal scrolling so the page behind does not create a confusing scrollbar.
- Notes: This is a display/layout improvement only. It should not change validation, approval, payment, or budget logic.
- Fix summary: The detail modal now has a compact folder-tab status overview and an internal scrolling modal body.

### ISSUE-20260618-06 - Use Folder-Tab Style for Expense Detail Sections

- Date: 2026-06-18
- Area: Frontend / Expense report detail modal / Visual design
- Status: fixed
- User report: Use a folder-like style with raised tabs at the top. Apply it to the expense report detail page as four raised tabs. If a section has failed validation show red, if passed show green, and if not checked show yellow.
- Observed behavior: Current detail page stacks all sections vertically with large panels. It does not provide a compact section navigator or clear first-glance status for detail, invoice check, policy check, and budget check.
- Expected behavior: The top of the detail modal should visually resemble a folder with four raised tabs. Each tab represents one section and carries status color.
- Impact: Medium. This can make the modal more scannable, reduce vertical bulk, and give users a quick mental model of "one report file with several review tabs."
- Suspected cause: The current layout uses plain modal content and expanded alert panels instead of a sectioned document metaphor.
- Change idea: Create four top tabs: `报销详情`, `发票检查`, `费用政策`, `预算影响`. Use status color on each tab:
  - Green: checked and passed.
  - Red: has blocking/error validation.
  - Yellow: not checked yet or has warning/pending state.
  - Neutral or blue may be considered for the active detail tab if it has no validation status.
  The active tab should have the raised folder-tab shape, while inactive tabs remain slightly recessed. Content below the tabs shows only the active section, keeping the first screen compact.
- Notes: This is a good direction. Need keep it restrained and business-tool-like, not decorative. Also ensure color is not the only signal; include text/status icons for accessibility.
- Fix summary: Added four raised folder tabs: report detail, invoice check, expense policy, and budget impact. Tabs show text status and color: green for pass, red for block, yellow for warning/pending.

## Fix Batch 2026-06-18

- Implemented issues: ISSUE-20260618-01 through ISSUE-20260618-06.
- Validation completed: backend tests, backend lint, backend build, frontend lint, frontend build.
