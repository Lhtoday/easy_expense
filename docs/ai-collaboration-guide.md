# AI 协作指南

本文档定义 AI 助手在 ExpenseFlow 中的工作方式，并补充 `AGENTS.md`、`frontend/AGENTS.md`、`backend/AGENTS.md` 和 `docs/startup-guide.md`。

## 默认上下文顺序

修改文件前，只读取任务所需上下文：

1. `AGENTS.md`
2. `frontend/AGENTS.md` or `backend/AGENTS.md` when touching that area
3. `docs/project-status.md`
4. The relevant task file under `docs/tasks/`
5. Relevant domain documents under `docs/domain/`

启动服务或检查本地运行状态时，必须先阅读 `docs/startup-guide.md`。

## 工作方式

- 对范围明确的请求，优先实现而不是停留在建议。
- 变更应符合现有架构和项目规则。
- 即使是小的 UI 或 API 变更，也必须保持财务、审计、权限和工作流语义。
- 缺少审计日志、缺少状态流转或权限检查不清晰，应视为产品风险，不是细节优化。
- 不修改无关文件，不回滚用户变更。

## 交付要求

每个完成的任务都需要报告：

- 修改了哪些文件
- 改变了哪些业务行为
- 运行了哪些验证命令
- 已知缺口或后续工作

核心业务模块还需要同步更新相关文档：

- 数据模型
- 状态流转
- 权限规则
- 测试说明

## AI 资产地图

- `docs/tasks/`：可执行任务卡和模板。
- `docs/domain/`：业务状态、工作流和会计知识。
- `docs/adr/`：架构决策记录。
- `.codex/skills/`：本仓库可复用的 Codex 工作流。
- `scripts/`：稳定的本地命令入口。
