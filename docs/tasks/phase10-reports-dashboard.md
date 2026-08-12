# Phase 10 - 审计、报表与看板首批增量

## 目标

为财务管理者和审计人员提供首批只读查询入口，覆盖经营看板、预算执行、审批耗时、异常分析和关键审计链路。

## 本次范围

- 新增后端 `reports` 模块：
  - `GET /reports/dashboard`
  - `GET /reports/audit-chain`
- 新增权限：
  - `report:dashboard:read`：查看经营看板
  - 审计链路沿用 `sys:audit:read`
- 新增前端页面：
  - `经营看板`
  - `审计日志`
- 新增 migration `20260721110000_phase10_reports_dashboard`，为 ADMIN 角色补齐看板权限。

## 报表口径

- 报销统计排除 `DRAFT` 和 `VOIDED` 单据，以 `submittedAt` 作为日期筛选字段。
- 部门、成本中心、项目费用优先使用明细行维度，缺失时回退到报销单头维度。
- 预算执行使用预算主表实时字段：在途、已确认、实际发生，并计算可用金额与执行率。
- 审批耗时使用已完成审批任务的 `completedAt - createdAt`。
- 异常分析覆盖费用政策非通过结果、预算非通过结果、重复发票和未关联明细发票。
- 审计链路使用系统审计日志 `sys_audit_logs`。

## 边界

- 本次不新增报表快照表、物化视图或定时报表任务。
- 本次不实现图表库，可视化先用指标条和表格承载，后续可按数据量和管理层需求补充趋势图。
- 本次不改变既有业务状态流转、付款、凭证或预算占用逻辑。

## 验证

- `npm.cmd run build --workspace backend`
- `npm.cmd run lint --workspace backend`
- `npm.cmd run test --workspace backend`
- `npm.cmd run build --workspace frontend`
- `npm.cmd run lint --workspace frontend`
- `npx.cmd prisma migrate deploy --schema backend/prisma/schema.prisma`
- 本地库已确认存在 `report:dashboard:read` 权限，且 ADMIN 角色已授权。

## 运行态说明

2026-07-23 已完成运行态复验：

- `http://localhost:3000/api/health` 返回 OK。
- 使用 `admin@expenseflow.local` / `Admin123!` 登录后，`GET /reports/dashboard` 返回看板汇总、预算执行和异常分析数据。
- `GET /reports/audit-chain?page=1&pageSize=5` 返回审计日志分页数据。
- 前端 `http://localhost:5173` 登录后可见 `经营看板` 和 `审计日志` 菜单；两个页面均可渲染真实数据，浏览器控制台未出现页面错误。

## 2026-08-11 增量

- 后端 `GET /reports/audit-chain` 新增筛选参数：`action`、`entityType`、`entityId`、`operatorId`、`actorEmail`、`success`、`keyword`、`startDate`、`endDate`。
- 审计日志接口返回 `beforeData`、`afterData` 和 `metadata`，用于核对配置、权限、预算、凭证等关键动作的变更细节。
- 前端 `审计日志` 页面新增高级筛选栏，支持按动作、结果、对象、操作者、邮箱、日期范围和关键字筛选。
- 前端审计日志表格支持展开查看变更前、变更后和元数据 JSON。
- 验证通过：后端 lint/build/test、前端 lint/build、后端健康检查、管理员登录、审计链路 keyword 筛选 API、动作+结果+对象类型筛选 API。

## 2026-08-12 增量

- Python 后端 `backend_py` 的 `GET /reports/dashboard` 补齐部门、成本中心、项目费用汇总，支持 `startDate` 和 `endDate` 按 `submitted_at` 过滤。
- 新增 `GET /reports/dimension-drilldown`，支持 `department`、`costCenter`、`project` 三类维度下钻到报销单明细行。
- 维度口径保持“明细行优先、单据头兜底”，报销统计排除 `DRAFT` 和 `VOIDED`；下钻的已付金额按明细可报销金额比例分摊。
- 前端经营看板三张维度汇总表新增下钻按钮，弹窗展示对应报销单和明细金额。
- 验证通过：`npm.cmd run lint`、`npm.cmd run build`、管理员登录、看板 API 和维度下钻 API smoke。
