# ExpenseFlow Project Status

本文件记录项目当前开发阶段、完成标准和下一步工作。每完成一个阶段后，需要更新本文档，避免只依赖聊天上下文或个人记忆。

## Current Phase

- Phase: Phase 2 - Expense Report Core
- Status: Done
- Started At: 2026-06-04
- Completed At: 2026-06-04

## Phase 0 Completion Checklist

- [x] 初始化 `frontend`: React + TypeScript + Vite + Ant Design
- [x] 初始化 `backend`: NestJS + TypeScript + Prisma
- [x] 配置 PostgreSQL、Redis、MinIO 的 Docker Compose
- [x] 建立基础环境变量、日志、错误处理和健康检查
- [x] 建立前后端 lint、format、test 脚本
- [x] 建立 API 响应格式、分页格式和错误码约定
- [x] 前端可以启动并访问基础页面
- [x] 后端可以启动并连接数据库
- [x] Prisma migration 可以正常执行
- [x] Docker Compose 可以启动核心依赖

## Phase 1 Completion Checklist

- [x] 用户数据模型
- [x] 角色数据模型
- [x] 部门数据模型
- [x] 成本中心数据模型
- [x] 项目数据模型
- [x] 登录接口
- [x] 当前用户接口
- [x] 基础角色权限模型
- [x] 基础数据权限模型
- [x] 前端登录页
- [x] 前端基础布局和菜单权限雏形
- [x] 用户、部门、角色、成本中心、项目基础管理页面
- [x] 权限清单页面
- [x] 角色页面展示和维护权限明细
- [x] Phase 1 核心接口测试

## Phase 2 Completion Checklist

- [x] 报销单主表
- [x] 报销明细表
- [x] 报销单编号规则
- [x] 草稿保存
- [x] 明细行新增、编辑、删除
- [x] 金额合计、税额合计、可报销金额合计
- [x] 提交前基础校验
- [x] 报销单列表、草稿编辑入口
- [x] 报销单状态日志
- [x] 报销单详情和状态日志前端展示
- [x] 报销单列表状态筛选和服务端分页
- [x] 已提交报销单撤回到草稿态
- [x] Prisma migration 已在本地数据库应用
- [x] 浏览器 smoke check 通过

## Next Phase

- Phase: Phase 3 - Attachments And Invoice Metadata
- Trigger: Phase 2 已完成，下一步进入附件上传、发票元数据录入和发票重复校验。

## Latest Progress

- 2026-06-02: Phase 0 完成并验证通过。前端、后端、Docker 依赖、Prisma migration、lint、test、build 和健康检查均已建立。
- 2026-06-02: Phase 1 完成并验证通过。后端新增 IAM 与主数据模型、登录接口、当前用户接口、用户/角色/部门/成本中心/项目基础 CRUD、基础权限与数据权限雏形。
- 2026-06-03: Phase 1 角色管理页补充权限明细展示，并支持在新增/编辑角色时维护权限编码集合。
- 2026-06-03: 角色权限维护调整为独立弹窗，支持展示全部权限和全部勾选。
- 2026-06-03: 左侧导航新增权限页面，系统管理员可查看全部权限编码、名称、说明和启用状态。
- 2026-06-03: 前端登录态校验调整为先校验 `/auth/me` 再进入系统，校验失败会清理失效 token。
- 2026-06-04: Phase 2 已启动。新增 `exp_reports`、`exp_report_items`、`exp_report_logs` 数据模型和迁移，新增报销单读写权限。
- 2026-06-04: 后端新增 `expense-reports` 模块，支持报销单列表、详情、草稿创建、草稿更新、提交和作废。
- 2026-06-04: 前端新增报销单工作区，支持新建草稿、编辑明细行、金额汇总、提交和作废。
- 2026-06-04: 已通过 `npm.cmd run test`、`npm.cmd run build`、`npm.cmd run lint` 和 `npm.cmd run db:generate`。本地数据库迁移因 Docker/PostgreSQL 未运行暂未应用。
- 2026-06-04: 继续完善 Phase 2 前端体验，报销单列表已支持关键词搜索、状态筛选和服务端分页；新增报销单详情弹窗，可查看主信息、明细行和状态日志。
- 2026-06-04: Phase 2 migration 已在本地 PostgreSQL 应用并确认同步；API smoke 已完成登录、创建草稿、提交和状态日志校验，浏览器 smoke 已确认报销单列表和详情弹窗可渲染。
- 2026-06-04: 根据实际员工使用流程补充撤回能力，申请人可将本人已提交且尚未进入审批处理的报销单撤回到草稿态；撤回动作写入状态日志，审批、财务审核和付款仍留给后续角色阶段。
- 2026-06-04: 撤回增强已验证通过，迁移 `20260604120000_phase2_expense_report_withdraw` 已应用，`EXP202606040002` 完成创建、提交、撤回到草稿态，日志包含 `CREATE,SUBMIT,WITHDRAW`。

## Phase History

| Phase | Status | Started At | Completed At | Notes |
| --- | --- | --- | --- | --- |
| Phase 0 - Project Foundation | Done | 2026-06-02 | 2026-06-02 | Frontend, backend, Docker dependencies, Prisma migration, lint, test, build, and health checks verified. |
| Phase 1 - Identity And Basic Master Data | Done | 2026-06-02 | 2026-06-02 | User, role, permission, data scope, department, cost center, project, auth APIs, frontend management pages, permission list page, role permission display, migration, build, lint, tests, and browser smoke check verified. |
| Phase 2 - Expense Report Core | Done | 2026-06-04 | 2026-06-04 | Draft/report models, APIs, withdraw, frontend workspace, detail view, filters, pagination, amount totals, status log, migration, API smoke, browser smoke, tests, lint, and build verified. |

## Update Rules

- 开始一个阶段时，将 `Current Phase.Status` 改为 `In Progress`，并填写 `Started At`。
- 完成一个阶段时，将 `Current Phase.Status` 改为 `Done`，填写 `Completed At`，并更新 `Phase History`。
- 进入下一阶段前，必须把 `Current Phase` 更新为下一阶段。
- 如果阶段范围变化，先更新 `docs/development-roadmap.md`，再同步更新本文档。
