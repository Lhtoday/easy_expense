# Acceptance Checklist

Use this checklist when reviewing AI-generated changes or closing a task.

## General

- The change matches the requested business outcome.
- The scope does not include unrelated refactors.
- Naming, structure, and validation follow the existing frontend or backend conventions.
- Documentation is updated when a core business concept changes.

## Finance And Workflow

- Status transitions are explicit and valid.
- Approval and finance review remain separate responsibilities.
- Payment happens only after finance review approval.
- Budget occupation is created, updated, released, or consumed at the correct lifecycle point.
- Voucher generation creates drafts only unless finance confirmation is explicitly implemented.

## Audit And Security

- Core actions record actor, action, time, previous state, next state, and comment when applicable.
- High-risk actions require dedicated permission checks.
- Data access considers role, data scope, and amount limits.
- Attachments are not exposed through permanent public links.

## Validation

- Run focused tests for the changed area.
- Run lint/build when shared contracts, types, or routing changed.
- Verify database migration status when Prisma schema or migrations changed.
- Mention any commands that could not be run.

