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
- 登录成功、关键登录失败和无效 token 校验失败
- 附件预览和下载
- 预算主数据、费用类型、费用政策和政策规则配置变更

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

## Phase 9 实现说明

- 会计科目主数据使用 `gl_account_subjects`；费用类型、员工往来、进项税和银行付款科目映射使用 `gl_account_mappings`。
- 已付款报销单通过 `/vouchers/reports/:reportId/preview` 预览凭证草稿，通过 `/vouchers/reports/:reportId/generate` 生成凭证草稿。
- 凭证数据写入 `gl_vouchers`、`gl_voucher_lines` 和 `gl_voucher_logs`，表名前缀统一为 `gl_`。
- 只有 `PAID` 且存在成功付款记录的报销单可以生成凭证草稿；生成后报销单流转为 `VOUCHER_DRAFTED`。
- 报销确认凭证按费用/进项税借方、员工往来贷方生成；付款凭证按员工往来借方、银行付款科目贷方生成。
- 凭证确认使用 `/vouchers/:id/confirm`，需要 `gl:voucher:confirm` 权限，并在确认前检查借贷平衡。
- 同一报销单全部凭证草稿确认后，报销单流转为 `VOUCHER_CONFIRMED`。
- Phase 9 只生成和确认凭证草稿，不自动过账到总账，不对接外部 ERP。
- 凭证生成、确认、会计科目维护和科目映射维护同步写入 `sys_audit_logs`，并保留报销单状态日志和凭证领域日志。
## Acceptance Fix Notes

- If linked invoice total is greater than expense amount, finance review keeps the issue as a warning. On finance approval, the system appends an automatic audit remark explaining that reimbursement, payment, budget occupation, and accounting expense are capped at the approved expense amount; the excess invoice amount is not used as reimbursement basis.

## 审计追溯加固实现说明

- 2026-06-22 起，身份权限、认证安全、附件访问、预算主数据和费用政策配置类审计统一写入 `sys_audit_logs`。
- 审计记录使用 `SystemAuditAction` 区分动作，保留操作者、操作者邮箱、对象类型、对象 id、before/after 结构化快照、metadata、备注和成功状态。
- `GET /audit-logs` 提供后端审计查询入口，需要 `sys:audit:read` 权限。
- 凭证相关动作已在 `SystemAuditAction` 中预留 `VOUCHER_DRAFT_GENERATE`、`VOUCHER_REGENERATE`、`VOUCHER_CONFIRM` 和 `VOUCHER_VOID`，Phase 9 实现时必须把凭证生成依据和借贷明细快照写入审计或凭证领域日志。

## Phase 9 收尾说明

- 未确认的凭证草稿支持通过 `POST /vouchers/reports/:reportId/void-drafts` 整单撤销，权限沿用 `gl:voucher:confirm`，报销单从 `VOUCHER_DRAFTED` 回到 `PAID`。
- 草稿撤销会将对应 `gl_vouchers` 更新为 `VOIDED`，写入 `gl_voucher_logs`、`exp_report_logs` 和 `sys_audit_logs`；付款凭证顶层 `paymentId` 会清空以释放唯一约束，原始付款来源仍保留在凭证明细和审计快照中。
- 已存在任一 `CONFIRMED` 凭证时不允许撤销草稿。确认后回退、冲销或作废不在本收尾范围内，需要作为独立财务控制流程设计。
