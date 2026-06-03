# ExpenseFlow Startup Guide

本文档记录本地启动 ExpenseFlow 项目的操作步骤。

## 1. 进入项目目录

```powershell
cd E:\codex\code\expense
```

## 2. 启动基础依赖

项目依赖 PostgreSQL、Redis 和 MinIO。

```powershell
docker-compose up -d postgres redis minio
```

可选：查看容器状态。

```powershell
docker-compose ps
```

## 3. 设置后端数据库连接

当前本地 PostgreSQL 连接串：

```powershell
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
```

## 4. 启动后端

```powershell
npm.cmd run dev:backend
```

后端健康检查地址：

```text
http://localhost:3000/api/health
```

Phase 1 默认管理员会在首次登录时自动初始化：

```text
邮箱：admin@expenseflow.local
密码：Admin123!
```

## 5. 启动前端

另开一个 PowerShell 窗口：

```powershell
cd E:\codex\code\expense
npm.cmd run dev:frontend
```

前端访问地址：

```text
http://localhost:5173
```

Phase 1 登录后可访问的基础管理页面：

- 用户
- 角色
- 权限
- 部门
- 成本中心
- 项目

其中，系统管理员可以在“权限”页面查看全部权限；在“角色”页面编辑角色时，可以通过权限弹窗批量勾选权限。

## 6. MinIO 控制台

MinIO 控制台地址：

```text
http://localhost:9001
```

登录信息：

```text
用户名：expenseflow
密码：expenseflow-secret
```

## 7. 常用命令

安装依赖：

```powershell
npm.cmd install
```

生成 Prisma Client：

```powershell
npm.cmd run db:generate
```

执行数据库迁移：

```powershell
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
npm.cmd --workspace backend exec prisma migrate dev
```

运行检查：

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

停止基础依赖：

```powershell
docker-compose down
```

## Windows 注意事项

在当前机器的 PowerShell 中，建议使用 `npm.cmd`，不要直接使用 `npm`。直接运行 `npm` 可能会被 PowerShell 执行策略拦截 `npm.ps1`。

## 登录状态排查

如果前端页面在登录页和登录后页面之间反复跳转，通常是浏览器本地保存了已失效的 `expenseflow_token`。当前前端会在 `/auth/me` 校验失败时自动清理失效 token；如果浏览器仍显示旧状态，可以强制刷新页面，或清理 `http://localhost:5173` 的 localStorage 后重新登录。
