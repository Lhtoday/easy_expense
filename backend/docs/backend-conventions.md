# Backend Schema Conventions

`backend/` 现在是 Prisma schema 和 migration 目录，不再承载 HTTP 服务代码。

## Directory Layout

- `prisma/schema.prisma`：数据库模型、枚举和 Prisma Client 生成配置。
- `prisma/migrations/`：已提交的数据库迁移 SQL。
- `package.json`：仅保留 Prisma 命令。

FastAPI 服务代码在 `backend_py/`。

## Database And SQL

- 查询实现不放在本目录；业务查询应在 `backend_py/` 中明确列出字段。
- 业务删除默认使用软删除字段或状态字段，避免硬删除核心财务数据。
- 状态、金额、预算、付款和凭证相关变更必须在 FastAPI 服务层事务中完成。
- Migration SQL 需要保留财务字段分离、外键、唯一约束和必要索引。

## Naming Prefixes

- `gl_`：总帐、凭证、会计分录等总帐相关对象。
- `md_`：部门、项目、成本中心、费用类型等基础资料。
- `iam_`：用户、角色、权限、数据权限等身份权限对象。
- `exp_`：报销、发票、审批、付款等费用业务对象。
- `bud_`：预算、预算占用、预算检查和预算操作日志。
- `sys_`：系统审计日志和系统配置。

## Validation

```powershell
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
npm.cmd run db:generate
npm.cmd --workspace schema exec prisma migrate status
```
