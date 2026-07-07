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

## 2026-06-22 开发记录

- Phase 9 后续开发采用小步闭环：每完成一个可验收步骤，必须更新本任务卡/项目状态，运行相关验证，然后立即提交并推送到 `origin/main`。
- 已新增会计科目主数据 `gl_account_subjects`、科目映射 `gl_account_mappings`、凭证主表 `gl_vouchers`、凭证明细 `gl_voucher_lines` 和凭证日志 `gl_voucher_logs`。
- 已新增 `VOUCHER_DRAFTED`、`VOUCHER_CONFIRMED` 报销单状态，以及 `VOUCHER_DRAFT`、`VOUCHER_CONFIRM` 状态日志动作。
- 已新增会计科目和凭证权限：`gl:account:read`、`gl:account:write`、`gl:voucher:read`、`gl:voucher:generate`、`gl:voucher:confirm`。
- 已新增后端 `vouchers` 模块，支持科目维护、映射维护、凭证预览、凭证草稿生成、凭证确认。
- 生成规则已覆盖报销确认凭证和付款凭证：费用/进项税借方、员工往来贷方；付款时员工往来借方、银行付款科目贷方。
- 凭证生成仅允许 `PAID` 且有成功付款记录的报销单；重复生成会被阻断。
- 凭证确认会检查借贷平衡；最后一张草稿确认后，报销单流转到 `VOUCHER_CONFIRMED`。
- 凭证生成、确认、科目和映射维护已写入系统审计日志，并保留报销单状态日志和凭证领域日志。
- 前端已先补充新报销状态的类型、筛选项和状态标签，完整凭证工作台/详情入口可作为下一步 UI 增量。
- 验证已通过：`npm.cmd run db:generate`、`npm.cmd run test --workspace backend`、`npm.cmd run lint`、`npm.cmd run build`、本地 `prisma migrate deploy`。
- 本步骤已提交并推送：`434b0ca feat: start phase9 voucher drafts`，分支 `main`，远端 `origin/main`。

## 2026-06-24 开发记录

- 已补齐前端凭证工作台：新增左侧 `凭证草稿` 菜单，支持按 `PAID`、`VOUCHER_DRAFTED`、`VOUCHER_CONFIRMED` 筛选，支持凭证预览、生成草稿和确认草稿。
- 已在报销单详情新增 `凭证草稿` 分区，展示凭证草稿、凭证明细、借贷方向、科目、金额和确认入口。
- 已新增凭证视角报销单列表和详情接口：`GET /vouchers/reports`、`GET /vouchers/reports/:reportId`，使用 `gl:voucher:read` 权限，避免凭证角色依赖报销单或付款菜单权限。
- 已新增前端 `会计设置` 菜单，支持维护 `gl_account_subjects` 会计科目和 `gl_account_mappings` 科目映射，覆盖费用类型、员工往来、进项税和银行付款映射用途。
- 已修复已有本地数据库中默认权限不自动补齐的问题：认证启动时会 upsert `DEFAULT_PERMISSIONS`，并为 `ADMIN` 角色补上缺失权限，确保 `gl:voucher:*` 和 `gl:account:*` 能显示对应菜单。
- 验证已通过：`npm.cmd run build --workspace frontend`、`npm.cmd run lint --workspace frontend`、`npm.cmd run build --workspace backend`、`npm.cmd run lint --workspace backend`、`npm.cmd run test --workspace backend`。

## 2026-07-07 验收记录

- 已新增可重复执行的 `scripts/seed-phase9-accounts.sql`，用于生成 Phase 9 凭证草稿所需的基础会计科目和默认科目映射。
- 本地已写入 11 个会计科目和 11 条科目映射，覆盖差旅、交通、招待、办公、其他费用、员工报销应付款、进项税、银行转账、现金和公务卡付款。
- 已修复 `account-subjects`、`account-mappings` 和 `vouchers/reports` 查询 DTO 缺少数字转换导致前端分页请求返回 400 的问题。
- 用户已在页面完成流程测试，反馈凭证相关流程可跑通。
