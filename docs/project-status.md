# ExpenseFlow Project Status

本文件用于记录项目当前开发阶段、完成标准和下一步工作。每完成一个阶段后，必须更新本文件，避免只依赖聊天上下文或个人记忆。

## Current Phase

- Phase: Phase 1 - Identity And Basic Master Data
- Status: Done
- Started At: 2026-06-02
- Completed At: 2026-06-02

## Phase 0 Completion Checklist

- [x] 初始化 `frontend`：React + TypeScript + Vite + Ant Design
- [x] 初始化 `backend`：NestJS + TypeScript + Prisma
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

## Next Phase

- Phase: Phase 2 - Expense Report Core
- Trigger: Phase 1 checklist 全部完成，并且用户、角色、部门、成本中心、项目和基础权限验证通过。

## Latest Progress

- 2026-06-02: Phase 1 已完成并验证通过。后端已新增 IAM 与主数据模型、Prisma migration、登录接口、当前用户接口、用户/角色/部门/成本中心/项目基础 CRUD、基础权限与数据权限雏形。
- 2026-06-02: 前端已新增登录页、基础应用布局、权限菜单雏形，以及用户、角色、部门、成本中心、项目管理页；窄屏下已补充资源切换下拉和表格横向滚动。
- 2026-06-02: 已完成验证：Prisma migration 应用成功，backend build/test/lint 通过，frontend build/test/lint 通过，浏览器 smoke check 可登录默认管理员并进入用户管理页。
- 2026-06-02: 下次开发建议从 Phase 2 开始，优先建立报销单主表、报销明细表、状态机、编号规则和草稿保存接口。
- 2026-06-03: Phase 1 角色管理页已补充权限明细展示，并支持在新增/编辑角色时维护权限编码集合。
- 2026-06-03: 角色权限维护已调整为独立弹窗，展示全部权限并支持全部勾选，降低权限项较多时的配置成本。
- 2026-06-03: 左侧导航已新增权限页面，系统管理员可查看全部权限编码、名称、说明和启用状态。
- 2026-06-03: 前端登录态校验已调整为先校验 `/auth/me` 再进入系统，校验失败会清理失效 token，避免登录页和系统页面反复跳转。

## Phase History

| Phase | Status | Started At | Completed At | Notes |
| --- | --- | --- | --- | --- |
| Phase 0 - Project Foundation | Done | 2026-06-02 | 2026-06-02 | Frontend, backend, Docker dependencies, Prisma migration, lint, test, build, and health checks verified. |
| Phase 1 - Identity And Basic Master Data | Done | 2026-06-02 | 2026-06-02 | User, role, permission, data scope, department, cost center, project, auth APIs, frontend management pages, permission list page, role permission display, migration, build, lint, tests, and browser smoke check verified. |

## Update Rules

- 开始一个阶段时，将 `Current Phase.Status` 改为 `In Progress`，并填写 `Started At`。
- 完成一个阶段时，将 `Current Phase.Status` 改为 `Done`，填写 `Completed At`，并更新 `Phase History`。
- 进入下一阶段前，必须把 `Current Phase` 更新为下一阶段。
- 如果阶段范围变化，先更新 `docs/development-roadmap.md`，再同步更新本文件。
