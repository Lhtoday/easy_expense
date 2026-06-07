---
name: expenseflow-audit-log
description: ExpenseFlow audit logging workflow. Use when implementing or reviewing login, approval, payment, voucher, budget adjustment, permission changes, status transitions, attachment access, or other auditable business actions.
---

# ExpenseFlow Audit Log

For each auditable action, verify:

- Actor is recorded.
- Action name is explicit.
- Timestamp is recorded.
- Previous state and next state are recorded when status changes.
- Comment or reason is recorded when supplied.
- Business entity id and type are recorded.
- High-risk operation permission is checked separately.

Required audit areas:

- Login
- Approval and rejection
- Finance review
- Payment
- Voucher draft and confirmation
- Budget adjustment
- Permission and role changes
- Attachment download

Missing audit behavior should be treated as a functional defect.

