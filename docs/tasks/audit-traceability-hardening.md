# 审计追溯加固

## 目标

补齐 Phase 9 凭证草稿前后的关键审计缺口，让审批、财务审核、付款、预算、权限、附件访问和后续凭证动作都能被财务或审计人员复盘。

## 业务背景

ExpenseFlow 已完成 Phase 0 到 Phase 8 的报销、审批、财务审核、预算和付款 MVP 闭环。进入凭证草稿前，系统需要确保高风险配置和权限变更也具备审计轨迹，否则后续凭证生成虽然可追踪，但无法解释“谁修改了权限、预算、政策或科目映射”。

## 范围

- 新增身份权限审计能力，覆盖用户创建/更新/停用、用户角色分配、角色创建/更新/删除、角色权限和数据权限变更。
- 新增登录审计能力，至少覆盖登录成功、登录失败、禁用用户登录失败和无效 token 校验失败中的高价值事件。
- 新增附件访问审计能力，覆盖附件预览和下载，尤其是发票、付款凭证和后续凭证附件。
- 加固预算主数据审计，覆盖预算创建、金额/维度/阈值/控制模式修改、启用和停用，并记录变更前后关键值。
- 加固费用政策和费用类型配置审计，覆盖规则启停、限额、必须发票、升级审批等控制规则变更。
- 为 Phase 9 凭证草稿预留凭证审计设计，包括凭证草稿生成、重新生成、确认、作废或阻止重复生成。
- 在相关详情页或管理页提供可查看的审计记录入口，至少保证后端 API 能返回审计链。

## 不包含

- 不启动大型工作流引擎替换。
- 不接入外部 OCR、发票验真、ERP 或总账系统。
- 不自动过账会计凭证。
- 不改变已完成的报销、审批、财务审核、付款和预算状态流转语义，除非为审计补充必要字段。

## 相关文件或模块

- `backend/prisma/schema.prisma`
- `backend/src/identity/*`
- `backend/src/expense-reports/*`
- `backend/src/budgets/*`
- `backend/src/expense-policies/*`
- 后续 Phase 9：`backend/src/vouchers/*` 或 `backend/src/gl-*`
- `frontend/src/App.tsx`
- `docs/domain/approval-payment-voucher-flow.md`
- `docs/domain/budget-occupation-flow.md`
- `docs/domain/expense-report-state-machine.md`

## 领域规则

- 必要状态流转：审计加固不得绕过现有 `DRAFT -> SUBMITTED -> BUSINESS_APPROVED -> FINANCE_APPROVED -> PAID` 主链路；凭证相关状态只能在 Phase 9 明确实现后加入。
- 必要审计行为：每条高风险审计记录必须包含操作者、动作、时间、对象类型、对象 id、关键前值、关键后值和原因/备注；状态变更必须记录 `fromStatus` 和 `toStatus`。
- 必要权限检查：权限、预算、政策、附件下载/预览和凭证动作必须使用独立权限点或已有高风险权限点，操作者必须来自登录态，不能信任请求体传入的 operator id。
- 预算或会计影响：预算金额、预算占用、实际发生、费用政策、会计科目映射和凭证明细变更必须记录 before/after；凭证草稿生成不得改变预算占用金额。
- 阻断型财务合规场景：缺少操作者、缺少权限、凭证借贷不平、重复生成凭证无幂等策略、预算调整后金额异常、角色权限变更无审计记录，都应阻止对应高风险动作或至少拒绝提交。

## 验收标准

- [x] 用户和角色管理接口接收当前登录用户，并能记录用户角色、角色权限、数据权限变更的审计记录。
- [x] 登录成功和关键失败场景有可查询审计记录，且不泄露密码或 token。
- [x] 附件预览和下载会记录访问者、附件、报销单、动作和时间。
- [x] 预算主数据和费用政策配置变更会记录关键 before/after 值。
- [x] 现有审批、财务审核、付款和预算操作日志继续在同一事务内写入，不因审计加固退化。
- [x] Phase 9 凭证草稿开发前，凭证审计表或审计字段设计已明确，生成和确认动作的审计要求写入实现。
- [x] 相关后端测试覆盖至少一个权限变更审计、一个附件访问审计、一个预算/政策配置审计和一个凭证审计设计用例或预留测试。

## 验证命令

```powershell
npm.cmd run test --workspace backend
npm.cmd run lint --workspace backend
npm.cmd run build --workspace backend
npm.cmd run lint --workspace frontend
npm.cmd run build --workspace frontend
```

## 文档更新

- `docs/project-status.md`
- `docs/current-priorities.md`
- `docs/domain/approval-payment-voucher-flow.md`
- `docs/domain/budget-occupation-flow.md`
- Phase 9 启动时同步更新 `docs/tasks/phase9-voucher-draft.md`

## 风险

- 审计表设计过于通用会丢失领域语义，过于分散又会增加查询复杂度；应优先保留领域日志，并对身份、附件访问、配置变更新增专门审计表。
- 权限和用户接口当前部分服务方法没有操作者上下文，需要调整 controller/service 签名，避免从请求体传 operator。
- 配置变更审计如果只记录自然语言备注，后续难以比对；关键字段应结构化保存 before/after。
- 凭证草稿若先实现业务功能再补审计，容易遗漏生成依据和借贷明细快照；Phase 9 应把凭证审计作为首批数据模型一起设计。

## 实现记录

- 2026-06-22：新增 `SystemAuditAction` 和 `sys_audit_logs`，通过 `AuditService` 统一记录身份权限、登录、附件访问、预算主数据、费用政策配置和凭证预留动作。
- 2026-06-22：新增 `GET /audit-logs` 审计查询入口，需要 `sys:audit:read` 权限。
- 2026-06-22：用户、角色、预算、费用类型、费用政策和政策规则写操作已记录结构化 before/after；附件预览/下载记录访问动作；登录成功、登录失败、无效 token 和不可用用户校验失败已记录安全审计。
- 2026-06-22：Prisma migration `20260622090000_audit_traceability_hardening` 已在本地数据库应用。
- 2026-06-22：验证通过：`npm.cmd run db:generate`、Prisma `migrate deploy/status`、后端 test/lint/build、前端 lint/build。
