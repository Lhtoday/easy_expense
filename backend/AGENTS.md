# ExpenseFlow Backend Schema Rules

当前 `backend/` 目录不再包含 NestJS/TypeScript 后端服务代码。

本目录只保留数据库模型工具链：

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/`
- `backend/package.json` 中的 Prisma 命令

实际后端服务代码位于 `backend_py/`，使用 FastAPI。

## Scope

- 修改数据库模型、枚举、索引、约束或 migration 时，遵守本文件。
- 修改 HTTP API、鉴权、业务状态机、审计写入或服务端业务逻辑时，前往 `backend_py/`。
- React 前端仍位于 `frontend/`，保持 TypeScript/Vite 技术栈。

## Prisma Rules

- 不要运行 `prisma migrate dev`，除非明确是在创建或调整开发迁移。
- 日常检查使用：

```powershell
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
npm.cmd run db:generate
npm.cmd --workspace schema exec prisma migrate status
```

- 金额、税额、预算、付款和凭证相关字段必须继续使用整数分单位或其他定点表示。
- 状态、权限和审计枚举属于前后端契约，变更时必须同步检查 `backend_py/` 与 `frontend/`。
- 不要删除表或字段，除非有明确数据迁移方案和用户确认。
- 新增核心业务模型时，同步更新领域文档、启动/测试文档和 FastAPI 访问层。

## Data And Audit Guardrails

- 关键业务表保留 `id`、`created_at`、`updated_at`、`deleted_at` 或等价生命周期字段。
- 业务编号使用独立单号字段，不使用数据库主键作为业务单号。
- 审计表保持追加写入，除非领域文档明确允许清理或归档。
- 发票重复校验、预算占用、付款、凭证草稿和权限控制相关索引不得随意移除。
