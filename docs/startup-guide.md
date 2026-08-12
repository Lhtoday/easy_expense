# ExpenseFlow 启动指南

本文记录本地启动 ExpenseFlow 的标准流程。当前项目形态是：

- 前端：React + Vite，默认端口 `5173`
- 后端：FastAPI，代码目录 `backend_py/`，默认端口 `3000`
- 数据库结构：仍沿用 `backend/prisma/schema.prisma` 和既有 Prisma migrations 管理
- 基础依赖：PostgreSQL、Redis、MinIO，由 `docker-compose.yml` 启动

日常启动优先走“快速启动”。只有首次启动、依赖缺失、Docker 未运行、数据库结构变更或排查环境问题时，才执行准备步骤。

## 1. 进入项目目录

```powershell
cd E:\codex\code\expense
```

## 2. 快速启动

适用于 `node_modules` 和 `backend_py` Python 依赖已安装、Docker Desktop 已启动、数据库迁移已应用的日常开发场景。

### 2.1 检查本机状态

需要了解 Docker 服务和本项目相关进程时运行：

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\check-local.ps1
```

该脚本用于诊断当前状态，不是启动前强制步骤。如果 Docker Desktop 未运行，可能会先报 Docker API 连接失败。如果当前 PowerShell 权限不足，也可能在读取 `Win32_Process` 时出现 `拒绝访问`；此时可以继续按下文分别用 `docker ps`、`docker-compose ps` 和端口检查命令确认服务状态。

### 2.2 启动基础依赖

```powershell
docker-compose up -d postgres redis minio
docker-compose ps
```

`postgres`、`redis`、`minio` 应显示为 `healthy` 或 `Up`。如果 Docker API 无法连接，先启动 Docker Desktop，等待 engine 就绪后再重试。若看到 `C:\Users\Administrator\.docker\config.json: Access is denied` 警告，但 `docker ps` 能正常返回容器列表，说明 engine 已可用，可以继续启动项目。

### 2.3 确认数据库状态

Python 后端复用现有 PostgreSQL schema；schema 仍由 Prisma migrations 维护。日常启动不要优先运行 `prisma migrate dev`。

```powershell
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
npm.cmd run db:generate
npm.cmd --workspace schema exec prisma migrate status
```

如果 `migrate status` 显示数据库不是最新，再应用已有迁移：

```powershell
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
npm.cmd --workspace schema exec prisma migrate deploy
```

### 2.4 启动 FastAPI 后端

在一个 PowerShell 窗口中运行：

```powershell
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
npm.cmd run dev:backend
```

等后端启动后验证健康检查：

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/api/health' -TimeoutSec 5
```

正常返回应包含：

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "expenseflow-fastapi"
  }
}
```

如果 `3000` 端口已被占用，先确认进程归属：

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,OwningProcess

Get-CimInstance Win32_Process -Filter "ProcessId = <PID>" |
  Select-Object ProcessId,Name,CommandLine
```

如果旧 NestJS 后端进程仍在运行，常见命令行为 `backend\dist\main` 或 `nest start`。确认属于本项目且不再需要后，再停止对应进程；当前仓库中的后端服务入口已迁移到 `backend_py/`。

### 2.5 启动 React 前端

另开一个 PowerShell 窗口运行：

```powershell
cd E:\codex\code\expense
npm.cmd run dev:frontend
```

前端地址：

```text
http://localhost:5173
```

命令行验证：

```powershell
Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -TimeoutSec 5
```

## 3. 首次启动或依赖恢复

### 3.1 安装 Node 依赖

```powershell
npm.cmd install
```

### 3.2 安装 Python 后端依赖

```powershell
python -m pip install -r backend_py\requirements.txt
```

如果网络或权限受限，需要允许 pip 访问 Python 包索引。

### 3.3 Docker Desktop 未启动

如果出现类似错误：

```text
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
failed to connect to the docker API at npipe:////./pipe/docker_engine
```

先启动 Docker Desktop：

```powershell
Start-Process -FilePath 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
```

等待 20 到 30 秒后检查：

```powershell
docker ps
docker-compose up -d postgres redis minio
docker-compose ps
```

## 4. 后台启动方式

普通开发建议使用前台窗口，方便查看日志。Codex Desktop 自动化场景如果需要服务在命令结束后继续运行，可以使用隐藏 PowerShell 进程。

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

检查本项目相关进程：

```powershell
Get-CimInstance Win32_Process |
  Where-Object { ($_.Name -match 'python|uvicorn|node|npm|cmd|powershell') -and ($_.CommandLine -like '*E:\codex\code\expense*') } |
  Select-Object ProcessId,Name,CommandLine
```

停止服务前，先确认 `ProcessId` 确实属于本项目，再执行：

```powershell
Stop-Process -Id <ProcessId> -Force
```

## 5. 登录信息

默认管理员会在首次登录时自动初始化：

```text
邮箱：admin@expenseflow.local
密码：Admin123!
```

登录后可访问基础管理页面和已迁移的列表/配置页面。当前 Python 后端处于迁移阶段，部分财务状态流转写操作会返回：

```text
501 PYTHON_MIGRATION_PENDING
```

这是有意保护：未完整迁移状态机、预算影响和审计日志前，不允许这些动作伪成功。

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

启动后端：

```powershell
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
npm.cmd run dev:backend
```

启动前端：

```powershell
npm.cmd run dev:frontend
```

验证后端 Python 代码：

```powershell
python -m compileall backend_py
```

构建前端并验证后端：

```powershell
npm.cmd run build
```

生成 Prisma Client：

```powershell
npm.cmd run db:generate
```

检查并应用已有数据库迁移：

```powershell
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
npm.cmd --workspace schema exec prisma migrate status
npm.cmd --workspace schema exec prisma migrate deploy
```

创建或调整开发迁移时才运行：

```powershell
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
npm.cmd --workspace schema exec prisma migrate dev
```

停止基础依赖：

```powershell
docker-compose down
```

## 8. Windows 注意事项

- 在 PowerShell 中使用 `npm.cmd`，不要直接使用 `npm`，避免执行策略拦截 `npm.ps1`。
- 后端现在是 Python/FastAPI，启动失败时优先检查 `backend_py\requirements.txt` 是否已安装。
- 本文档为 UTF-8 编码；Windows PowerShell 读取时如出现中文乱码，可使用 `Get-Content docs\startup-guide.md -Encoding UTF8`。
- 如果前端登录页和登录后页面之间反复跳转，通常是浏览器保存了已失效的 `expenseflow_token`。强制刷新或清理 `http://localhost:5173` 的 localStorage 后重新登录。
