# Phase 7 财务审核启动

## 目标

拆分业务审批和财务审核，并交付第一版财务审核工作台能力。

## 范围

- 新增财务审核相关报销单状态和审计动作。
- 新增 `exp_finance_reviews`，用于记录财务审核审计信息。
- 新增财务审核权限、后端模块、列表接口，以及通过、退回、拒绝接口。
- 将预算确认从业务审批通过后移到财务审核通过后。
- 新增前端财务审核工作台，支持筛选、查看详情、通过、退回和拒绝。

## 不包含

- 不做详细会计维度调整界面。
- 不生成凭证草稿。
- 不做付款登记。
- 不接入外部发票验真或 OCR。

## 验证命令

- `npm.cmd run db:generate`
- `npm.cmd run test --workspace backend`
- `npm.cmd run lint --workspace backend`
- `npm.cmd run lint --workspace frontend`
- `npm.cmd run build --workspace backend`
- `npm.cmd run build --workspace frontend`

## 备注

`prisma migrate status` 需要 Docker/PostgreSQL 正在运行，并使用 `DATABASE_URL=postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public`。

## 当前进展（2026-06-16）

- 状态：已完成。
- 已完成：财务审核状态、动作和 `exp_finance_reviews` 的 Prisma schema 与 migration。
- 已完成：后端 `finance-reviews` 模块，包含列表、通过、退回和拒绝接口。
- 已完成：流程拆分。业务审批通过后报销单进入 `BUSINESS_APPROVED`；财务审核通过后进入 `FINANCE_APPROVED`，并确认预算占用。
- 已完成：财务退回/拒绝会释放预算占用，并写入财务审核记录和报销单状态审计记录。
- 已完成：前端财务审核工作台，支持筛选、查看详情、通过、退回和拒绝。
- 已完成：财务复核检查，覆盖会计维度、税额一致性、重复发票、发票关联，并在存在 BLOCK 问题时阻止审核通过。
- 已完成：财务明细调整接口和前端调整弹窗，支持调整会计科目、成本中心、项目、税额和可抵扣税额。
- 已完成：更完整的发票异常复核，覆盖币种不一致、缺购销方税务信息、开票日期异常、发票税额覆盖和金额超覆盖。
- 已验证：`npm.cmd run db:generate`、`npm.cmd run test --workspace backend`、前后端 lint、前后端 build、本地 `prisma migrate deploy/status`、后端健康检查、前端 HTTP 检查、财务审核列表 API smoke 和浏览器点击级 smoke check。
- 剩余事项：Phase 7 无剩余事项；后续在明确要求后进入 Phase 8 出纳付款。
