# Phase 9 凭证草稿

## 目标

基于已完成财务审核和付款的报销单生成可审计的会计凭证草稿，但不自动过账。

## 业务背景

ExpenseFlow 已完成报销、业务审批、财务审核、预算和付款的 MVP 闭环。下一类财务控制点是凭证草稿：系统可以根据报销和付款数据生成分录草稿，但必须由财务角色复核和确认。这样既能减少重复录入，也能避免系统绕过人工财务判断直接过账。

## 范围

- 如当前费用类型上的默认科目字段不足，新增会计科目主数据。
- 新增费用类型与会计科目的映射关系。
- 新增员工往来科目映射，用于报销确认和付款分录。
- 新增凭证草稿主表和明细表，表名前缀使用 `gl_`。
- 基于财务已通过或已付款报销单生成报销确认凭证草稿。
- 基于付款记录生成付款凭证草稿。
- 新增凭证预览和财务确认流程。
- 记录凭证生成和凭证确认的审计轨迹。
- 在报销单详情展示凭证草稿状态和入口。

## 不包含

- 不做总账自动过账。
- 不接入外部 ERP。
- 不做自动银行对账。
- 不做 AI 科目推荐。
- 不接入 OCR 或发票验真供应商。

## 相关文件或模块

- `backend/prisma/schema.prisma`
- `backend/src/app.module.ts`
- `backend/src/expense-reports/`
- `backend/src/payments/`
- `frontend/src/App.tsx`
- `docs/domain/approval-payment-voucher-flow.md`
- `docs/domain/expense-report-state-machine.md`

## 领域规则

- 必要状态流转：实现时应支持 `PAID -> VOUCHER_DRAFTED` 和 `VOUCHER_DRAFTED -> VOUCHER_CONFIRMED`。
- 必要审计行为：凭证生成和确认必须记录操作者、动作、时间、来源报销单/付款记录、前状态、后状态和必要意见。
- 必要权限检查：凭证预览、凭证生成、凭证确认需要独立财务权限。
- 预算或会计影响：生成凭证草稿不得改变预算占用金额；预算实际发生由付款流程处理。
- 会计规则：系统只能生成凭证草稿，最终确认必须由财务角色执行，不允许自动过账。

## 验收标准

- 财务用户可以为符合条件的已付款报销单生成凭证草稿。
- 未通过财务审核或未满足付款条件的报销单不能生成凭证草稿。
- 凭证明细包含借贷方向、会计科目、金额、币种、来源报销单/付款记录和摘要。
- 每张凭证草稿借贷平衡。
- 财务用户可以在确认前预览凭证详情。
- 有权限的财务确认人可以填写意见并确认凭证草稿。
- 确认动作写入凭证审计记录和报销单状态日志。
- 重复生成凭证草稿应具备幂等处理，或以清晰错误提示阻止重复生成。
- 凭证确认不能仅凭普通管理员权限执行。

## 验证命令

```powershell
npm.cmd run db:generate
npm.cmd run test --workspace backend
npm.cmd run lint --workspace backend
npm.cmd run lint --workspace frontend
npm.cmd run build --workspace backend
npm.cmd run build --workspace frontend
```

## 文档更新

- `docs/project-status.md`
- `docs/development-roadmap.md`
- `docs/domain/approval-payment-voucher-flow.md`
- `docs/domain/expense-report-state-machine.md`
- `docs/e2e-acceptance-script.md`

## 风险

- 会计科目映射不完整，可能导致凭证不平或分录误导。
- 如果页面文案和权限边界不清晰，凭证确认可能被误解为自动过账。
- 现有 `APPROVED` 状态偏历史遗留，不能在未评估状态机影响前复用。
- 如果需要补生成历史已付款单据的凭证，补生成过程必须幂等且可审计。
