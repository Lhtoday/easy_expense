# ExpenseFlow Project Status

本文档记录项目当前开发阶段、完成标准和下一步工作。每完成一个阶段后，需要更新本文档，避免只依赖聊天上下文或个人记忆。

## Current Phase

- Phase: Phase 4 - Lightweight Approval Workflow
- Status: Done
- Started At: 2026-06-05
- Completed At: 2026-06-05

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

## Phase 3 Completion Checklist

- [x] 附件元数据表
- [x] 报销单附件关联
- [x] 发票元数据表
- [x] 手工录入发票代码、号码、金额、税额、开票日期和销方信息
- [x] 发票重复校验
- [x] 报销单详情展示附件和发票元数据
- [x] MinIO 文件上传
- [x] 附件预览和下载鉴权
- [x] 报销明细关联发票的完整交互优化

## Phase 4 Completion Checklist

- [x] 审批流配置表
- [x] 审批实例表
- [x] 审批任务表
- [x] 审批日志表
- [x] 提交后创建默认主管审批实例和待办任务
- [x] 审批人待办/已办列表
- [x] 审批通过和驳回
- [x] 已进入审批但尚未处理的报销单撤回到草稿并关闭待办任务
- [x] 报销单详情展示审批实例、审批任务和审批日志
- [x] Prisma migration 已在本地数据库确认
- [x] 后端测试、前后端 lint 和 build 通过

## Next Phase

- Phase: Phase 5 - Expense Policy Control
- Trigger: Phase 4 已完成，下一步进入费用政策管控：费用类型、政策规则、金额限制、发票要求和超标处理。

## Latest Progress

- 2026-06-02: Phase 0 完成并验证通过。前端、后端、Docker 依赖、Prisma migration、lint、test、build 和健康检查均已建立。
- 2026-06-02: Phase 1 完成并验证通过。后端新增 IAM 与主数据模型、登录接口、当前用户接口、用户/角色/部门/成本中心/项目基础 CRUD、基础权限与数据权限雏形。
- 2026-06-03: Phase 1 角色管理页补充权限明细展示，并支持在新增/编辑角色时维护权限编码集合。
- 2026-06-03: 角色权限维护调整为独立弹窗，支持展示全部权限和全部勾选。
- 2026-06-03: 左侧导航新增权限页面，系统管理员可查看全部权限编码、名称、说明和启用状态。
- 2026-06-03: 前端登录态校验调整为先校验 `/auth/me` 再进入系统，校验失败会清理失效 token。
- 2026-06-04: Phase 2 启动并完成。新增 `exp_reports`、`exp_report_items`、`exp_report_logs` 数据模型、迁移和报销单读写权限；后端新增 `expense-reports` 模块；前端新增报销单工作区、列表筛选、详情弹窗、状态日志和撤回能力。
- 2026-06-04: Phase 2 migration 已在本地 PostgreSQL 应用并确认同步；API smoke 完成登录、创建草稿、提交和状态日志校验；浏览器 smoke 确认报销单列表和详情弹窗可渲染。
- 2026-06-05: Phase 3 启动。新增 `exp_attachments` 和 `exp_invoices` 数据模型、迁移和权限；后端支持附件元数据登记/软删除、发票元数据登记/软删除、基于发票代码/号码/日期/价税合计/销方的重复校验；前端报销单详情弹窗已展示并维护附件与发票元数据。
- 2026-06-05: Phase 3 继续。新增后端 `StorageModule` 和轻量 MinIO S3 V4 适配层，报销附件支持真实文件上传到 MinIO，并通过后端鉴权接口进行预览和下载；前端附件区域改为文件选择上传，附件列表新增预览、下载和删除操作。修复 bucket 初始化时空 body 导致 MinIO `MalformedXML` 的问题，真实 MinIO PUT/GET smoke 已通过，写入并读回 `phase3-minio-smoke`。
- 2026-06-05: Phase 3 完成收口。报销单详情新增发票检查提示，覆盖未关联发票明细、重复发票和未关联明细发票；报销明细表新增发票状态列，发票录入时关联明细下拉展示明细金额和已关联票据情况，发票列表强化未关联明细与重复状态展示。`npm.cmd run build --workspace frontend` 和 `npm.cmd run lint --workspace frontend` 已通过。
- 2026-06-05: Phase 4 完成。新增 `exp_approval_flow_configs`、`exp_approval_instances`、`exp_approval_tasks`、`exp_approval_logs` 数据模型、迁移和审批权限；提交报销单后自动创建默认主管审批实例和待办任务；审批人可在审批任务页查看待办/已办、打开报销详情并执行通过或驳回；撤回已提交但未处理的单据时同步关闭审批任务；报销单详情展示审批实例、任务和审批日志。`npm.cmd run test`、`npm.cmd run build --workspace backend`、`npm.cmd run build --workspace frontend`、`npm.cmd run lint --workspace backend`、`npm.cmd run lint --workspace frontend` 已通过，`npx.cmd prisma migrate deploy --schema backend/prisma/schema.prisma` 确认本地数据库无待应用迁移。
- 2026-06-05: Phase 4 用户验收通过。手工测试覆盖关联发票后提交报销单、审批驳回和审批通过，流程未报错，确认 Phase 4 审批闭环完成。

## Phase History

| Phase | Status | Started At | Completed At | Notes |
| --- | --- | --- | --- | --- |
| Phase 0 - Project Foundation | Done | 2026-06-02 | 2026-06-02 | Frontend, backend, Docker dependencies, Prisma migration, lint, test, build, and health checks verified. |
| Phase 1 - Identity And Basic Master Data | Done | 2026-06-02 | 2026-06-02 | User, role, permission, data scope, department, cost center, project, auth APIs, frontend management pages, permission list page, role permission display, migration, build, lint, tests, and browser smoke check verified. |
| Phase 2 - Expense Report Core | Done | 2026-06-04 | 2026-06-04 | Draft/report models, APIs, withdraw, frontend workspace, detail view, filters, pagination, amount totals, status log, migration, API smoke, browser smoke, tests, lint, and build verified. |
| Phase 3 - Attachments And Invoice Metadata | Done | 2026-06-04 | 2026-06-05 | Attachment metadata, MinIO upload, authorized preview/download, invoice metadata, duplicate invoice check, item-invoice association UX, tests, lint, build, and MinIO smoke verified. |
| Phase 4 - Lightweight Approval Workflow | Done | 2026-06-05 | 2026-06-05 | Approval flow config, approval instances, approval tasks, approval logs, submit-created tasks, approve/reject, pending withdrawal closure, frontend approval task list, detail approval records, migration check, tests, lint, and build verified. |

## Update Rules

- 开始一个阶段时，将 `Current Phase.Status` 改为 `In Progress`，并填写 `Started At`。
- 完成一个阶段时，将 `Current Phase.Status` 改为 `Done`，填写 `Completed At`，并更新 `Phase History`。
- 进入下一阶段前，必须把 `Current Phase` 更新为下一阶段。
- 如果阶段范围变化，先更新 `docs/development-roadmap.md`，再同步更新本文档。
