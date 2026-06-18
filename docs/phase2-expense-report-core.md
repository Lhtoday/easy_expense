# Phase 2 报销单核心

## 范围

Phase 2 引入报销单草稿和提交的第一个闭环。

- 报销单主表包含业务编号、申请人、组织维度、状态、币种和分离的金额字段。
- 报销明细包含发生日期、费用类型编码、会计科目编码、成本维度、金额、税额、可抵扣税额和可报销金额。
- 每个核心动作都有状态日志。
- 前端工作区支持创建草稿、编辑明细、保存草稿、提交草稿和作废草稿。
- 前端列表支持按关键字和状态筛选，并使用服务端分页。
- 前端详情视图展示报销单主信息、明细和操作日志。

## 数据模型

- `exp_reports`：报销单主表。金额字段以分为单位存储：`amount_cents`、`tax_amount_cents`、`deductible_tax_cents`、`reimbursable_cents` 和 `paid_amount_cents`。
- `exp_report_items`：报销明细表。每行保存自己的会计维度和成本维度。
- `exp_report_logs`：状态流转和操作日志。记录操作者、动作、时间戳、前状态、后状态和意见。

## 状态流转

当前 MVP 状态流：

- `DRAFT`：创建报销单后的初始状态。
- `SUBMITTED`：员工提交有效草稿。
- `VOIDED`：员工作废草稿。

允许的流转：

- `DRAFT -> DRAFT`：保存或更新草稿。
- `DRAFT -> SUBMITTED`：提交。
- `SUBMITTED -> DRAFT`：申请人在报销单进入审批处理前撤回已提交单据。
- `DRAFT -> VOIDED`：作废。

报销单离开 `DRAFT` 后，编辑、提交和作废都被阻止。撤回是单独的申请人动作，仅在报销单处于 `SUBMITTED` 时可用。

Phase 2 仅实现员工/申请人操作。审批、财务审核和付款动作留给后续工作流、财务和付款阶段。

## 权限

新增权限：

- `exp:report:read`：查看报销单列表和详情。
- `exp:report:write`：创建、编辑、提交和作废报销单。
- `exp:report:withdraw`：在审批处理开始前撤回自己已提交的报销单。

Phase 2 migration 插入这些权限，并授予现有 `ADMIN` 角色。

## 验证与会计说明

- 金额使用最小货币单位存储和计算。后端汇总基于整数分计算。
- 提交时至少需要一条明细，且可报销金额合计必须为正数。
- 可抵扣税额不能超过税额。
- 可报销金额不能超过原始费用金额。
- 当前以 `account_subject_code` 保存会计科目；详细科目映射留给后续会计政策阶段。

## 测试

已新增后端 service 测试，覆盖：

- 创建草稿时按分汇总金额并写入状态日志。
- 权限控制。
- 非法税额和可报销金额关系。
- 无正数可报销金额草稿的提交校验。

2026-06-04 验证：

- `npm.cmd run test`：通过。
- `npm.cmd run build`：通过。
- `npm.cmd run lint`：通过。
- `npm.cmd run db:generate`：通过。
- `npm.cmd run db:migrate -- --skip-generate`：初次受阻，因为本地 PostgreSQL/Docker daemon 未运行。

2026-06-04 列表/详情增强后的补充验证：

- `npm.cmd run test`：通过。
- `npm.cmd run build`：通过。
- `npm.cmd run lint`：通过。

2026-06-04 Phase 2 最终验证：

- PostgreSQL 可用后，`prisma migrate dev --skip-generate` 显示数据库已同步。
- API smoke 通过：已验证登录、创建草稿、提交报销单、金额合计、明细数量和日志数量。
- 浏览器 smoke 通过：报销单列表渲染了已提交的 smoke 报销单，详情弹窗渲染了报销单详情和状态日志，应用控制台无错误。

2026-06-04 撤回增强验证：

- `prisma migrate dev --skip-generate`：已应用 `20260604120000_phase2_expense_report_withdraw`。
- `npm.cmd run test`：9 个后端测试通过。
- `npm.cmd run build`：通过。
- `npm.cmd run lint`：通过。
- API smoke 通过：报销单 `EXP202606040002` 已创建、提交、撤回到 `DRAFT`，日志包含 `CREATE,SUBMIT,WITHDRAW`。
