# ADR 0001：维护 AI 协作资产

## 状态

已接受

## 背景

ExpenseFlow 使用 AI 辅助开发。项目已有通用规则，但 AI 助手还需要可执行上下文：任务卡、领域状态文档、验证清单和可复用技能。

## 决策

维护面向 AI 协作的项目资产：

- `docs/ai-collaboration-guide.md`
- `docs/tasks/`
- `docs/domain/`
- `docs/acceptance-checklist.md`
- `.codex/skills/`
- `scripts/verify-*.ps1`

## 影响

- 新增核心模块时，应同步更新任务文档和领域文档。
- AI 助手可以减少重复提示，直接基于项目资产工作。
- 项目决策在不同对话之间更容易追溯。
