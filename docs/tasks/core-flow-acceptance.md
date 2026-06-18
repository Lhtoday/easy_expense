# 核心流程验收

## 目标

验证 ExpenseFlow MVP 从管理员前置配置、员工报销、业务审批、财务审核、出纳付款到审计复核的完整闭环。

## 业务背景

项目已经完成 Phase 0 到 Phase 8 的 MVP 边界。在继续做凭证草稿、报表或智能化能力之前，应先证明当前闭环满足财务合规细节，其次再确认流程能顺畅跑通。

## 范围

- 验证管理员能配置用户、角色、权限、部门、成本中心、项目、费用政策和预算。
- 验证员工能创建报销单、上传附件、登记发票、触发政策检查和预算占用。
- 验证主管业务审批与财务审核保持职责分离。
- 验证财务审核覆盖会计维度、税额、发票一致性、重复发票和预算影响。
- 验证出纳付款成功和付款失败两条路径。
- 验证完整生命周期中的审计日志和状态流转。
- 将发现的问题记录到 `docs/test-problem.md` 或新任务卡。

## 不包含

- 首轮验收过程中不直接修改业务实现。
- 不实现凭证草稿。
- 不接入外部供应商。
- 不做性能基准测试，除非发现明显阻塞问题。

## 相关文件或模块

- `docs/e2e-acceptance-script.md`
- `docs/startup-guide.md`
- `docs/acceptance-checklist.md`
- `docs/domain/expense-report-state-machine.md`
- `docs/domain/budget-occupation-flow.md`
- `docs/domain/approval-payment-voucher-flow.md`

## 领域规则

- 必要状态流转：`DRAFT -> SUBMITTED -> BUSINESS_APPROVED -> FINANCE_APPROVED -> PAID`。
- 必要审计行为：创建、更新、提交、撤回、审批通过、审批驳回、财务通过、财务退回、财务拒绝、财务修正、付款登记、付款失败和预算变化都必须可追溯。
- 必要权限检查：审批、财务审核、付款、预算调整和权限变更都需要独立权限。
- 预算或会计影响：提交占用预算，撤回/驳回/财务拒绝释放预算，财务通过确认已审批占用，付款将已审批占用转为实际发生。

## 验收标准

- 管理员可以不改数据库，直接在系统中准备必要主数据。
- 每个角色只能看到已授权菜单和动作。
- 一张合规报销单可以从草稿流转到已付款。
- 存在 BLOCK 级财务复核问题的报销单不能通过财务审核。
- 财务审核通过前不能付款。
- 付款失败后单据保持可付款状态，并写入失败记录。
- 所有核心状态变化都有可见审计记录。
- 提交、审批、财务通过、驳回/撤回和付款后的预算占用金额符合预期生命周期。
- 发现的问题按阻塞、高、中、低分类，并记录清晰复现步骤。

## 验证命令

```powershell
npm.cmd run test --workspace backend
npm.cmd run lint --workspace backend
npm.cmd run lint --workspace frontend
npm.cmd run build --workspace backend
npm.cmd run build --workspace frontend
```

## 文档更新

- `docs/e2e-acceptance-script.md`
- `docs/project-status.md`
- 发现问题时更新 `docs/test-problem.md`

## 风险

- 演示数据可能缺少必要的角色和预算组合。
- 人工验收可能遗漏预算占用的并发风险。
- 浏览器 smoke check 只能证明页面可渲染，不能证明财务正确性；财务断言必须单独记录。
