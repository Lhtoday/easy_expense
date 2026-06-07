# ADR 0001: Maintain AI Collaboration Assets

## Status

Accepted

## Context

ExpenseFlow is built with AI assistance. General project rules exist, but AI agents need executable context: task cards, domain state documents, validation checklists, and reusable skills.

## Decision

Maintain AI-focused project assets:

- `docs/ai-collaboration-guide.md`
- `docs/tasks/`
- `docs/domain/`
- `docs/acceptance-checklist.md`
- `.codex/skills/`
- `scripts/verify-*.ps1`

## Consequences

- New core modules should include task and domain documentation updates.
- AI agents can work with less repeated prompting.
- Project decisions become more traceable across conversations.

