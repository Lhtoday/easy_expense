---
name: expenseflow-audit-log
description: ExpenseFlow audit logging workflow for login, approval, finance review, payment, voucher draft/confirmation, budget adjustment, permission or role changes, report status transitions, attachment preview/download, and any other auditable business action. Use when implementing, reviewing, or debugging audit behavior, state logs, operator attribution, or compliance traceability in ExpenseFlow.
---

# ExpenseFlow Audit Log

Auditability is a product requirement, not a logging nicety. Every financial or workflow action must explain who did what, when, to which business object, and how the state or amount changed.

## Core Workflow

1. Identify the auditable action and the business entity it affects.
2. Confirm the actor comes from the authenticated user context, not from request body input.
3. Capture action name, timestamp, entity id/type, previous state, next state, and comment/reason when available.
4. For amount or budget changes, capture before/after values or link to a domain-specific operation log.
5. Enforce dedicated permission checks before writing high-risk audit records.
6. Keep the business write and audit write in the same transaction when the action changes state, money, payment, voucher, or budget data.
7. Surface audit records in the relevant detail view when users need to verify the chain of custody.

## Required Audit Areas

- Authentication: login and current-user validation failures when meaningful.
- Expense reports: create, update, submit, withdraw, reject, void, and status transitions.
- Approval: task creation, approval, rejection, withdrawal.
- Finance review: approve, return, reject, adjust.
- Payment: successful payment registration and failed payment registration.
- Voucher: draft generation and finance confirmation.
- Budget: occupation, release, approval confirmation, actual transfer, adjustment, reconciliation.
- Identity and security: permission changes, role changes, user role assignment.
- Attachments: preview and download authorization-sensitive access.

## Guardrails

### Must Do

- Record actor id, action, timestamp, business entity id, and business entity type.
- Record from-status and to-status whenever state changes.
- Record amount deltas or before/after buckets for budget and payment movements.
- Treat missing audit behavior for core actions as a functional defect.
- Keep audit terminology aligned with Prisma enums and UI labels.

### Must Not Do

- Do not trust an operator id supplied by the client.
- Do not write state-changing business data without the matching audit record.
- Do not collapse approval, finance review, and payment logs into one generic log type when domain-specific logs exist.
- Do not expose permanent public attachment links as a substitute for audited access.

## Review Checklist

- Is the action high risk enough to require a dedicated permission?
- Is the audit record written inside the same transaction as the business mutation?
- Can a finance or audit user reconstruct the full lifecycle from logs?
- Are rejection, withdrawal, void, failed payment, and adjustment paths audited as carefully as happy paths?
