# 审批、付款与凭证流程

本文档用于区分业务审批、财务审核、出纳付款和凭证确认。

## 职责

- 提交人：创建、编辑、提交，并在允许时撤回报销单。
- 业务审批人：审批或驳回业务真实性和预算匹配性。
- 财务审核人：核验发票合规性、会计映射、税务字段和政策适配。
- 出纳：在财务审核通过后执行付款。
- 凭证确认财务角色：确认凭证草稿。

## 控制边界

- 不要把业务审批和财务审核合并成一个节点。
- 财务审核通过前不得付款。
- 未经财务确认不得自动过账凭证。
- 高风险动作不能只依赖普通管理员权限。

## 审计要求

以下动作需要记录审计日志：

- 提交
- 撤回
- 业务审批通过/驳回
- 财务审核通过/拒绝
- 付款
- 凭证草稿生成
- 凭证确认
- 预算调整
- 权限或角色变更

## Phase 7 实现说明

- 业务审批现在将报销单从 `SUBMITTED` 流转到 `BUSINESS_APPROVED`。
- 财务审核工作台列表使用 `/finance-reviews/reports`，审计动作使用 `/finance-reviews/reports/:id/approve`、`/return` 和 `/reject`。
- 财务审核通过将 `BUSINESS_APPROVED` 流转到 `FINANCE_APPROVED`，并确认预算占用。
- 财务退回将 `BUSINESS_APPROVED` 流转到 `FINANCE_REJECTED`，释放预算占用，并允许提交人补充后重新提交。
- 财务拒绝将 `BUSINESS_APPROVED` 流转到 `REJECTED`，并释放预算占用。
- 财务审核动作记录在 `exp_finance_reviews`，并同步镜像到报销单状态日志。
- 财务审核通过前必须先运行财务复核检查。缺少会计科目、缺少成本中心、税额合计不一致、重复发票或发票税额非法等 BLOCK 问题会阻止通过。
- 财务审核人可以在报销单处于 `BUSINESS_APPROVED` 时调整明细会计科目、成本中心、项目、税额和可抵扣税额。调整不改变报销单状态，会重算报销单汇总，向 `exp_finance_reviews` 写入 `ADJUST`，并向报销单状态日志写入 `FINANCE_ADJUST`。

## Phase 8 实现说明

- 出纳付款工作台使用 `/payments/reports`，审计动作使用 `/payments/reports/:id/register` 或 `/fail`。
- 只有 `FINANCE_APPROVED` 状态的报销单可以付款。财务审核通过前付款会被拒绝。
- 成功付款记录 `exp_payments`，创建一条 `exp_payment_batches`，向报销单状态日志写入 `PAYMENT_REGISTER`，将报销单流转到 `PAID`，并更新 `paidAmountCents`。
- 失败付款记录 `exp_payments`，创建失败批次，向报销单状态日志写入 `PAYMENT_FAIL`，并保持报销单为 `FINANCE_APPROVED`，让出纳可以重试。
- Phase 8 MVP 要求成功付款金额等于剩余可付金额。付款表保留金额/状态字段以便未来支持部分付款，但在实现预算占用拆分前，故意阻断部分成功付款。
- 付款动作需要 `exp:payment:pay`；查看付款工作台需要 `exp:payment:read`。
