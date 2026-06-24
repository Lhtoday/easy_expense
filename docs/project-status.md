# ExpenseFlow 项目状态

本文档记录项目当前开发阶段、完成标准和下一步工作。每完成一个阶段后，需要更新本文档，避免只依赖聊天上下文或个人记忆。

## 当前阶段

- 阶段：Phase 9 - 凭证草稿
- 状态：进行中
- 开始时间：2026-06-22
- 完成时间：待定

## Phase 0 完成清单

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

## Phase 1 完成清单

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

## Phase 2 完成清单

- [x] 报销单主表
- [x] 报销明细表
- [x] 报销单编号规则
- [x] 草稿保存
- [x] 明细行新增、编辑、删除
- [x] 金额合计、税额合计、可报销金额合计
- [x] 提交前基础校验
- [x] 报销单列表、草稿编辑入口
- [x] 报销单状态日志
- [x] 报销单详情和状态日志前端展示
- [x] 报销单列表状态筛选和服务端分页
- [x] 已提交报销单撤回到草稿态
- [x] Prisma migration 已在本地数据库应用
- [x] 浏览器 smoke check 通过

## Phase 3 完成清单

- [x] 附件元数据表
- [x] 报销单附件关联
- [x] 发票元数据表
- [x] 手工录入发票代码、号码、金额、税额、开票日期和销方信息
- [x] 发票重复校验
- [x] 报销单详情展示附件和发票元数据
- [x] MinIO 文件上传
- [x] 附件预览和下载鉴权
- [x] 报销明细关联发票的完整交互优化

## Phase 4 完成清单

- [x] 审批流配置表
- [x] 审批实例表
- [x] 审批任务表
- [x] 审批日志表
- [x] 提交后创建默认主管审批实例和待办任务
- [x] 审批人待办/已办列表
- [x] 审批通过和驳回
- [x] 已进入审批但尚未处理的报销单撤回到草稿并关闭待办任务
- [x] 报销单详情展示审批实例、审批任务和审批日志
- [x] Prisma migration 已在本地数据库确认
- [x] 后端测试、前后端 lint 和 build 通过

## Phase 5 完成清单

- [x] 费用类型主数据模型和管理接口
- [x] 费用政策和政策规则模型
- [x] 政策检查结果追踪表
- [x] 单笔金额限额规则
- [x] 基于费用类型的必须发票规则
- [x] 单笔限额按费用金额校验，而不是按可报销金额校验
- [x] 必须发票规则在关联发票价税合计小于费用金额时阻止提交
- [x] 事前申请提醒规则占位
- [x] 提交时报销政策检查支持阻止提交和升级审批
- [x] 命中升级规则时选择升级审批流
- [x] 前端费用政策管理页面
- [x] 前端政策规则列表区域
- [x] 前端政策规则启用和停用控制
- [x] 报销单详情展示政策检查结果
- [x] Prisma migration 已在本地数据库应用
- [x] 后端测试、前后端 lint 和 build 通过

## Phase 6 完成清单

- [x] 预算主数据模型，支持部门、成本中心、项目、费用类型和会计科目维度
- [x] 预算占用模型，区分在途、已审批、实际发生和已释放金额
- [x] 预算检查结果追踪表，支持通过、提醒和阻止
- [x] 预算操作日志，覆盖占用、释放、审批确认、实际发生转入和调整动作
- [x] 提交时报销预算占用，带行级预算锁
- [x] 撤回、驳回和作废时释放预算
- [x] 审批通过时确认预算占用
- [x] 预留付款后转实际发生的服务方法，供 Phase 8 付款集成使用
- [x] 超预算提醒和阻止控制模式
- [x] 前端预算控制页面
- [x] 报销单详情展示预算检查和预算占用影响
- [x] Prisma migration 已在本地数据库应用
- [x] 后端/前端测试、lint 和 build 通过

## 下一阶段

- 阶段：Phase 9 - 凭证草稿
- 触发条件：仅在明确要求后启动，进入会计科目、科目映射、凭证草稿生成、凭证预览、财务确认和凭证审计追踪。

## Phase 7 财务审核清单

- [x] 新增财务审核报销单状态和审计动作。
- [x] 新增 `exp_finance_reviews` 财务审核记录表。
- [x] 新增财务审核权限：查看财务审核、处理财务审核。
- [x] 新增后端 `finance-reviews` 模块，支持列表、详情、通过、退回补充和拒绝。
- [x] 拆分业务审批和财务审核：业务审批通过后进入 `BUSINESS_APPROVED`，财务审核通过后进入 `FINANCE_APPROVED`。
- [x] 将预算确认从业务审批通过后移到财务审核通过。
- [x] 财务退回和拒绝时释放预算占用，并写入财务审核记录和报销单状态日志。
- [x] 新增前端财务审核工作台，支持筛选、详情查看、通过、退回和拒绝。
- [x] 新增财务复核项，覆盖会计维度、税额一致性、重复发票、发票关联和发票金额一致性。
- [x] 财务审核通过前阻断 BLOCK 级复核问题。
- [x] 财务审核详情展示复核项明细。
- [x] 财务审核中的会计维度调整工作流。
- [x] 财务审核中的税额修正工作流。
- [x] 更完整的发票异常复核处理。
- [x] 浏览器点击级 smoke check。

## Phase 6 后验收问题修复清单

- [x] 部门等主数据保存失败时返回明确原因，尤其是编码重复。
- [x] 成本中心维护部门时支持下拉候选和弹窗选择。
- [x] 项目维护部门、成本中心时支持下拉候选和弹窗选择。
- [x] 用户新增和编辑时支持分配角色，并展示用户已有角色。
- [x] 编辑报销单草稿时，部门、成本中心、项目支持下拉候选和弹窗选择。
- [x] 报销单发票登记改为按钮弹窗；发票列表支持编辑已登记发票。

## 最新进展

- 2026-06-02：Phase 0 完成并验证通过。前端、后端、Docker 依赖、Prisma migration、lint、test、build 和健康检查均已建立。
- 2026-06-02：Phase 1 完成并验证通过。后端新增 IAM 与主数据模型、登录接口、当前用户接口、用户/角色/部门/成本中心/项目基础 CRUD、基础权限与数据权限雏形。
- 2026-06-03：Phase 1 角色管理页补充权限明细展示，并支持在新增/编辑角色时维护权限编码集合。
- 2026-06-03：角色权限维护调整为独立弹窗，支持展示全部权限和全部勾选。
- 2026-06-03：左侧导航新增权限页面，系统管理员可查看全部权限编码、名称、说明和启用状态。
- 2026-06-03：前端登录态校验调整为先校验 `/auth/me` 再进入系统，校验失败会清理失效 token。
- 2026-06-04：Phase 2 启动并完成。新增 `exp_reports`、`exp_report_items`、`exp_report_logs` 数据模型、迁移和报销单读写权限；后端新增 `expense-reports` 模块；前端新增报销单工作区、列表筛选、详情弹窗、状态日志和撤回能力。
- 2026-06-04：Phase 2 migration 已在本地 PostgreSQL 应用并确认同步；API smoke 完成登录、创建草稿、提交和状态日志校验；浏览器 smoke 确认报销单列表和详情弹窗可渲染。
- 2026-06-05：Phase 3 启动。新增 `exp_attachments` 和 `exp_invoices` 数据模型、迁移和权限；后端支持附件元数据登记/软删除、发票元数据登记/软删除、基于发票代码/号码/日期/价税合计/销方的重复校验；前端报销单详情弹窗已展示并维护附件与发票元数据。
- 2026-06-05：Phase 3 继续。新增后端 `StorageModule` 和轻量 MinIO S3 V4 适配层，报销附件支持真实文件上传到 MinIO，并通过后端鉴权接口进行预览和下载；前端附件区域改为文件选择上传，附件列表新增预览、下载和删除操作。修复 bucket 初始化时空 body 导致 MinIO `MalformedXML` 的问题，真实 MinIO PUT/GET smoke 已通过，写入并读回 `phase3-minio-smoke`。
- 2026-06-05：Phase 3 完成收口。报销单详情新增发票检查提示，覆盖未关联发票明细、重复发票和未关联明细发票；报销明细表新增发票状态列，发票录入时关联明细下拉展示明细金额和已关联票据情况，发票列表强化未关联明细与重复状态展示。`npm.cmd run build --workspace frontend` 和 `npm.cmd run lint --workspace frontend` 已通过。
- 2026-06-05：Phase 4 完成。新增 `exp_approval_flow_configs`、`exp_approval_instances`、`exp_approval_tasks`、`exp_approval_logs` 数据模型、迁移和审批权限；提交报销单后自动创建默认主管审批实例和待办任务；审批人可在审批任务页查看待办/已办、打开报销详情并执行通过或驳回；撤回已提交但未处理的单据时同步关闭审批任务；报销单详情展示审批实例、任务和审批日志。`npm.cmd run test`、`npm.cmd run build --workspace backend`、`npm.cmd run build --workspace frontend`、`npm.cmd run lint --workspace backend`、`npm.cmd run lint --workspace frontend` 已通过，`npx.cmd prisma migrate deploy --schema backend/prisma/schema.prisma` 确认本地数据库无待应用迁移。
- 2026-06-05：Phase 4 用户验收通过。手工测试覆盖关联发票后提交报销单、审批驳回和审批通过，流程未报错，确认 Phase 4 审批闭环完成。
- 2026-06-05：Phase 5 完成。新增费用类型主数据、费用政策、政策规则、政策检查追踪、提交时阻止/提醒/升级检查、升级审批流选择、前端费用政策管理，以及报销单详情政策结果展示。`npm.cmd run test`、前后端 lint、前后端 build、Prisma generate 和 `prisma migrate deploy` 已通过。
- 2026-06-08：Phase 6 完成。新增预算主数据、预算占用、预算检查、预算操作日志、提交时预算占用、撤回/驳回/作废预算释放、审批通过预算确认、付款转实际发生预留服务、预算控制前端页面，以及报销单详情预算影响展示。Prisma generate、本地 migration deploy/status、后端/前端测试、lint 和 build 已通过。
- 2026-06-08：根据手工验证加固 Phase 5 政策校验。单笔限额改为按费用金额比较，而不是按可报销金额比较；必须发票规则在关联发票价税合计小于费用金额时阻止提交。已补充聚焦后端测试，`npm.cmd run test --workspace backend` 和 `npm.cmd run build --workspace backend` 已通过。
- 2026-06-08：进入 Phase 6 后验收问题修复。根据 `docs/test-problem.md` 整理主数据选择、用户角色分配、发票弹窗新增/编辑和错误提示优化清单，作为进入 Phase 7 前的体验与闭环补强。
- 2026-06-08：Phase 6 后验收问题修复完成。优化唯一字段重复错误提示；成本中心、项目、用户、报销单草稿改用下拉候选加弹窗选择；用户表单支持分配角色；报销单发票改为弹窗登记并支持编辑。后端测试、后端 build、前端 build、全仓 lint 和浏览器 smoke check 已通过。
- 2026-06-11：Phase 7 财务审核启动。新增财务审核状态、动作、`exp_finance_reviews`、财务审核权限和后端 `finance-reviews` 模块；业务审批通过后进入 `BUSINESS_APPROVED`，财务审核通过后进入 `FINANCE_APPROVED`，并将预算确认后移到财务审核通过。
- 2026-06-11：Phase 7 首个工作台增量完成。前端新增财务审核工作台，支持待审/已审筛选、查看详情、审核通过、退回补充和拒绝；退回/拒绝会释放预算占用，并写入财务审核记录和报销单状态日志。`npm.cmd run db:generate`、后端测试、前后端 lint 和前后端 build 已通过；本地数据库未运行时曾阻塞 migration status。
- 2026-06-14：Phase 7 财务复核加固。新增财务复核项，覆盖缺会计科目、缺成本中心、项目缺失提醒、汇总与明细金额/税额不一致、重复发票、发票价税合计不一致、可抵扣税额大于税额、发票未关联或覆盖不足；财务审核通过前会阻断 BLOCK 级问题。后端测试、前后端 lint、前后端 build、migration status、后端健康检查、前端 HTTP smoke 和财务审核列表 API smoke 已通过。
- 2026-06-15：Phase 7 财务修正增量完成。新增财务审核明细修正接口和前端弹窗，财务审核人可在 `BUSINESS_APPROVED` 状态下修正会计科目、成本中心、项目、税额和可抵扣税额；修正会重算报销单汇总税额，写入 `exp_finance_reviews` 的 `ADJUST` 记录，并同步写入报销单 `FINANCE_ADJUST` 状态日志。Prisma generate、后端测试、前后端 lint、前后端 build 和本地 migration deploy 已通过。
- 2026-06-16：Phase 7 发票异常复核增强。财务复核新增发票币种不一致、缺销方税号、缺购方抬头或税号、开票日期晚于提交时间、明细税额/可抵扣税额高于关联发票税额合计、发票价税合计超过明细金额等检查；前端财务复核面板按类别汇总、排序并显示定位信息。
- 2026-06-16：Phase 7 浏览器点击级 smoke check 通过。手工验证财务审核详情在单据缺少成本中心和会计科目时能显示对应阻断提示，确认财务复核提示链路可见且符合预期。

## 阶段历史

| 阶段 | 状态 | 开始时间 | 完成时间 | 说明 |
| --- | --- | --- | --- | --- |
| Phase 0 - 项目基础 | 已完成 | 2026-06-02 | 2026-06-02 | 前端、后端、Docker 依赖、Prisma migration、lint、test、build 和健康检查已验证。 |
| Phase 1 - 身份权限与基础主数据 | 已完成 | 2026-06-02 | 2026-06-02 | 用户、角色、权限、数据权限、部门、成本中心、项目、认证接口、前端管理页面、权限清单、角色权限展示、migration、build、lint、测试和浏览器 smoke check 已验证。 |
| Phase 2 - 报销单核心 | 已完成 | 2026-06-04 | 2026-06-04 | 草稿/报销单模型、接口、撤回、前端工作区、详情视图、筛选、分页、金额合计、状态日志、migration、API smoke、浏览器 smoke、测试、lint 和 build 已验证。 |
| Phase 3 - 附件与发票元数据 | 已完成 | 2026-06-04 | 2026-06-05 | 附件元数据、MinIO 上传、鉴权预览/下载、发票元数据、发票重复校验、明细与发票关联交互、测试、lint、build 和 MinIO smoke 已验证。 |
| Phase 4 - 轻量审批流 | 已完成 | 2026-06-05 | 2026-06-05 | 审批流配置、审批实例、审批任务、审批日志、提交创建待办、审批通过/驳回、待审批撤回关闭任务、前端审批任务列表、详情审批记录、migration 检查、测试、lint 和 build 已验证。 |
| Phase 5 - 费用政策控制 | 已完成 | 2026-06-05 | 2026-06-05 | 费用类型主数据、政策/规则配置、政策检查追踪、提交时阻止和升级、费用金额限额校验、必须发票金额覆盖校验、前端政策管理、详情结果展示、migration、测试、lint 和 build 已验证。 |
| Phase 6 - 预算控制 | 已完成 | 2026-06-08 | 2026-06-08 | 预算主数据、占用/检查/日志模型、提交占用、释放/确认钩子、前端预算页面、详情预算影响、migration、测试、lint 和 build 已验证。 |
| Phase 6 后验收问题修复 | 已完成 | 2026-06-08 | 2026-06-08 | 主数据选择器、用户角色分配、发票弹窗新增/编辑、重复编码提示、报销草稿维度选择、测试、lint、build 和浏览器 smoke check 已验证。 |
| Phase 7 - 财务审核 | 已完成 | 2026-06-11 | 2026-06-16 | 财务审核状态、记录、权限、后端模块、前端工作台、业务审批/财务审核拆分、预算确认后移、财务复核阻断规则、会计维度调整、税额修正、发票异常复核增强和浏览器 smoke check 已完成。 |
| Phase 8 - 出纳付款 | 已完成 | 2026-06-16 | 2026-06-17 | 付款批次、付款记录、出纳权限、付款成功/失败登记、已付款状态、预算实际发生转入、已付款预算修复、测试、lint、build 和 migration 检查已完成。 |

## 更新规则

- 开始一个阶段时，将“当前阶段”的状态改为“进行中”，并填写开始时间。
- 完成一个阶段时，将“当前阶段”的状态改为“已完成”，填写完成时间，并更新“阶段历史”。
- 进入下一阶段前，必须把“当前阶段”更新为下一阶段。
- 如果阶段范围变化，先更新 `docs/development-roadmap.md`，再同步更新本文档。

## Phase 8 出纳付款清单

- [x] 新增 `PAID` 报销单状态和 `PAYMENT_REGISTER`、`PAYMENT_FAIL` 报销单日志动作。
- [x] 通过 migration `20260616120000_phase8_payment` 新增 `exp_payment_batches` 和 `exp_payments`。
- [x] 新增出纳权限：`exp:payment:read` 和 `exp:payment:pay`。
- [x] 新增后端 `payments` 模块，支持待付款列表、付款详情、成功付款登记和失败付款登记。
- [x] 成功付款只能从 `FINANCE_APPROVED` 发起，MVP 阶段必须支付全部剩余可付金额。
- [x] 成功付款写入付款审计记录、报销单状态日志，报销单进入 `PAID`，更新 `paidAmountCents`，并将已审批预算占用转为实际发生。
- [x] 失败付款写入付款审计记录和报销单状态日志，报销单保持 `FINANCE_APPROVED`，允许出纳重试。
- [x] 新增前端出纳付款工作台，支持待付款筛选、付款/失败付款弹窗、付款状态统计和报销单详情付款记录展示。
- [x] 新增已付款单据预算修复能力，支持幂等修复、写入预算操作日志、匹配空维度通配预算，并在已付款报销详情提供前端操作入口。
- [x] 验证完成：Prisma client generation、本地 migration deploy/status、后端测试、后端 lint/build、前端 lint/build。
- [x] 进度已记录并推送：实现提交 `ccd780d` 已于 2026-06-17 推送到 `origin/main`。

## 工作流技能记录

- 2026-06-18：新增项目技能 `expenseflow-submit-progress`，用于完成或中断开发后的提交、推送和进度记录流程。
- 验证完成：`quick_validate.py` 确认该技能有效。
- 进度已记录并推送：技能提交 `271395f` 已于 2026-06-18 推送到 `origin/main`。

## 文档维护记录

- 文档应按 UTF-8 编码读取和编辑。若 PowerShell 默认输出出现乱码，优先使用 `Get-Content -Encoding UTF8` 验证文件内容，不要直接按乱码结果重写业务事实。
- 端到端验收剧本见 `docs/e2e-acceptance-script.md`。
- 2026-06-22：完成审计追溯加固首批实现。新增 `sys_audit_logs` 和 `SystemAuditAction`，补齐用户/角色/权限变更、登录成功与失败、无效 token、附件预览下载、预算主数据、费用类型和费用政策配置变更审计；新增 `GET /audit-logs` 查询入口和 `sys:audit:read` 权限。验证完成：Prisma generate、migration deploy/status、后端 test/lint/build、前端 lint/build。
- 2026-06-21：记录下一开发任务 `docs/tasks/audit-traceability-hardening.md`。明天优先加固审计追溯能力，重点覆盖权限/角色变更、登录审计、附件预览下载审计、预算主数据和费用政策配置变更审计，并为 Phase 9 凭证草稿的生成、确认和重生成审计预留设计。
- 2026-06-18：完成文档治理增强。新增端到端验收剧本，补充 Phase 9 凭证草稿、核心流程验收和文档治理任务卡；将 `docs` 中主要说明文档中文化，保留命令、路径、枚举、权限码和 API 路径等机器可识别内容。
- 2026-06-18：完成 `.codex/skills/expenseflow-*` 技能改造。技能说明改为英文专家库风格，强化触发描述、核心工作流、财务合规 guardrails、验证启发和输出要求；`quick_validate.py` 已确认 8 个 ExpenseFlow 技能有效。
- 2026-06-18：文档治理和技能改造进度已推送。提交 `6148c9a` 已推送到 `origin/main`，分支 `main`。

## Acceptance Stabilization Notes

- 2026-06-18: Fixed six acceptance issues covering repeated expense draft dimensions, expense detail check-panel clarity, compact folder-tab detail layout, and finance over-invoice audit remarks.
- Added `docs/acceptance-issue-log.md` to track user-reported validation issues and implementation status.
- Validation completed: backend tests, backend lint, backend build, frontend lint, frontend build, and local frontend browser smoke test.
- Progress recorded after push: acceptance fix commit `c4abe42` was pushed to `origin/main` on 2026-06-18.

## Phase 9 凭证草稿进展

- 2026-06-22：Phase 9 已启动，完成后端首批凭证草稿能力。新增 `gl_account_subjects`、`gl_account_mappings`、`gl_vouchers`、`gl_voucher_lines`、`gl_voucher_logs`，支持会计科目、费用类型/员工往来/进项税/银行付款科目映射、凭证预览、生成和确认。
- 已新增 `VOUCHER_DRAFTED`、`VOUCHER_CONFIRMED` 状态，凭证生成后从 `PAID` 流转到 `VOUCHER_DRAFTED`，全部草稿确认后流转到 `VOUCHER_CONFIRMED`。
- 已新增 `gl:account:*` 和 `gl:voucher:*` 权限；凭证生成、确认、科目和映射维护均写入系统审计日志。
- 已补充后端单测，验证状态门槛、借贷平衡、凭证确认和审计动作；前端已识别新状态，完整凭证工作台和报销详情入口待下一步开发。
- 验证完成：Prisma generate、本地 migration deploy、后端测试、全量 lint、全量 build。
- 进度已记录并推送：实现提交 `434b0ca` 和任务状态提交 `239211c` 已于 2026-06-22 推送到 `origin/main`，分支 `main`。
- 2026-06-24：Phase 9 前端工作台继续推进。已新增 `凭证草稿` 菜单、凭证工作台、报销单详情凭证分区、凭证视角报销单列表/详情接口，以及 `会计设置` 菜单用于维护会计科目和科目映射；同时修复已有本地库默认权限不补齐导致 `gl:voucher:*` 菜单不可见的问题。验证通过：前端 build/lint、后端 build/lint/test。
