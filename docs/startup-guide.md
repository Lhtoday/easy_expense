# ExpenseFlow Startup Guide

本文档记录本地启动 ExpenseFlow 项目的操作步骤。日常启动优先走“快速启动”；只有首次启动、Docker 未运行、依赖缺失或数据库结构变更时，才执行对应的准备步骤。

## 1. 进入项目目录

```powershell
cd E:\codex\code\expense
```

## 2. 快速启动

适用于 `node_modules` 已安装、Docker Desktop 已启动、数据库迁移已应用的日常开发场景。

### 2.1 确认基础依赖

```powershell
docker-compose up -d postgres redis minio
docker-compose ps
```

`postgres`、`redis`、`minio` 都应显示为 `healthy` 或 `Up`。如果 Docker API 无法连接，先启动 Docker Desktop，等待 engine 就绪后再重试。

### 2.2 确认数据库状态

只启动项目时，不要优先运行 `prisma migrate dev`。该命令面向开发迁移创建，可能进入交互或长时间等待。

```powershell
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
npm.cmd run db:generate
npm.cmd --workspace backend exec prisma migrate status
```

如果 `migrate status` 显示数据库不是最新，再应用已有迁移：

```powershell
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
npm.cmd --workspace backend exec prisma migrate deploy
```

### 2.3 启动后端

在一个 PowerShell 窗口中运行：

```powershell
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
npm.cmd run dev:backend
```

后端健康检查地址：

```text
http://localhost:3000/api/health
```

### 2.4 启动前端

另开一个 PowerShell 窗口运行：

```powershell
cd E:\codex\code\expense
npm.cmd run dev:frontend
```

前端访问地址：

```text
http://localhost:5173
```

## 3. 后台启动方式

如果需要让服务在当前终端外继续运行，可用隐藏 PowerShell 进程启动。该方式适合本地桌面环境和自动化助手；普通人工开发仍建议使用前台窗口，便于查看编译日志。

启动后端：

```powershell
$script = @'
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
Set-Location 'E:\codex\code\expense'
npm.cmd run dev:backend
'@
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
Start-Process -FilePath 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -ArgumentList '-NoProfile','-EncodedCommand',$encoded -WorkingDirectory 'E:\codex\code\expense' -WindowStyle Hidden
```

启动前端：

```powershell
$script = @'
Set-Location 'E:\codex\code\expense'
npm.cmd run dev:frontend
'@
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
Start-Process -FilePath 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -ArgumentList '-NoProfile','-EncodedCommand',$encoded -WorkingDirectory 'E:\codex\code\expense' -WindowStyle Hidden
```

检查进程：

```powershell
Get-CimInstance Win32_Process |
  Where-Object { ($_.Name -match 'node|npm|cmd|powershell') -and ($_.CommandLine -like '*E:\codex\code\expense*') } |
  Select-Object ProcessId,Name,CommandLine
```

停止本项目本地 dev 进程时，先用上面的命令确认 `ProcessId`，再停止对应进程：

```powershell
Stop-Process -Id <ProcessId> -Force
```

## 4. 首次或慢启动排查

### 4.1 安装依赖

```powershell
npm.cmd install
```

### 4.2 Docker Desktop 未启动

如果出现类似 `failed to connect to the docker API`，先启动 Docker Desktop，等待 10 到 30 秒，再运行：

```powershell
docker ps
docker-compose up -d postgres redis minio
docker-compose ps
```

### 4.3 数据库连接串

当前本地 PostgreSQL 连接串：

```powershell
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
```

### 4.4 迁移命令选择

- 日常启动：使用 `prisma migrate status` 检查状态。
- 应用已有迁移：使用 `prisma migrate deploy`。
- 创建或调整迁移：才使用 `prisma migrate dev`，并在前台终端运行。

## 5. 登录信息和页面

Phase 1 默认管理员会在首次登录时自动初始化：

```text
邮箱：admin@expenseflow.local
密码：Admin123!
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

生成 Prisma Client：

```powershell
npm.cmd run db:generate
```

检查并应用已有数据库迁移：

```powershell
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
npm.cmd --workspace backend exec prisma migrate status
npm.cmd --workspace backend exec prisma migrate deploy
```

创建或调整开发迁移：

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

如果由自动化助手启动长期运行的 dev server，需要使用外部隐藏 PowerShell 进程；沙箱内直接创建的后台子进程可能会在命令结束后被回收。

## 登录状态排查

如果前端页面在登录页和登录后页面之间反复跳转，通常是浏览器本地保存了已失效的 `expenseflow_token`。当前前端会在 `/auth/me` 校验失败时自动清理失效 token；如果浏览器仍显示旧状态，可以强制刷新页面，或清理 `http://localhost:5173` 的 localStorage 后重新登录。
