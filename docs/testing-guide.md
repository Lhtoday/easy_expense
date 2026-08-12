# 测试指南

本文档为 AI 助手提供稳定的验证选择。默认优先选择能覆盖风险的最小检查范围。

## 通用命令

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

## 前端

修改 React 页面、表单、路由、API client、状态或 UI 行为时使用：

```powershell
npm.cmd run lint --workspace frontend
npm.cmd run test --workspace frontend
npm.cmd run build --workspace frontend
```

## 后端

修改 FastAPI 模块、router、schema、权限、审计行为或数据库访问时使用：

```powershell
python -m compileall backend_py
```

## Prisma

修改 schema 或 migration 时使用：

```powershell
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
npm.cmd run db:generate
npm.cmd --workspace backend exec prisma migrate status
```

仅在明确创建或调整开发 migration 时使用 `prisma migrate dev`。
