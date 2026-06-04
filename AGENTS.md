# ExpenseFlow Project Rules

本项目是企业费用报销与财务管控系统。开发时需要同时满足财务合规、审计可追溯、工程可维护和业务可扩展四类目标。

本文件只保存跨前后端都必须遵守的项目级规则。前端和后端的具体开发规则分别放在：

- `frontend/AGENTS.md`
- `backend/AGENTS.md`

## Technology Stack

本项目默认采用以下技术栈，除非后续有明确架构调整：

- Frontend: React + TypeScript + Vite + Ant Design
- Client state and data fetching: TanStack Query + Zustand
- Frontend forms and validation: React Hook Form + Zod
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Cache and queue: Redis + BullMQ
- File storage: MinIO
- Deployment: Docker Compose + Nginx
- Workflow: MVP 阶段采用轻量自研审批流，后续复杂流程再评估 Camunda 或 Flowable
- OCR and invoice verification: 先设计适配层，后续按供应商或本地模型接入

## Product Principles

- 报销系统不是简单的审批工具，必须覆盖预算占用、费用政策、票据合规、财务审核、付款、凭证和归档。
- 所有核心业务动作必须有状态流转和审计日志。
- 用户体验应优先支持高频工作流：提交报销、主管审批、财务审核、出纳付款、凭证查看。
- 系统默认面向多公司、多部门、多成本中心、多项目扩展设计。

## Accounting Principles

- 每一笔报销明细必须能映射到费用类型、会计科目、成本中心和必要的辅助核算维度。
- 报销单金额、发票金额、税额、可抵扣税额、实付金额应分字段保存，不允许只保存一个总金额。
- 发票必须支持重复校验，至少基于发票代码、发票号码、开票日期、金额和销方信息。
- 预算应区分在途占用、已审批占用和实际发生金额。
- 驳回、撤回、作废报销单时，必须释放相应预算占用。
- 自动凭证只能生成凭证草稿，最终过账应由财务角色确认。
- 涉及员工借款冲销时，应明确区分其他应收款与费用科目。
- 达到固定资产确认标准的支出，不应直接费用化，应进入固定资产或资本化审核流程。

## Workflow Principles

- 审批流不得写死在业务代码中，应通过配置、规则引擎或工作流定义驱动。
- 财务审核和业务审批是不同职责，不应混为一个节点。
- 付款动作只能发生在财务审核通过之后。
- 任一审批动作都必须记录操作者、动作、时间、意见、前状态和后状态。

## Security Principles

- 权限必须同时考虑角色权限、数据权限和金额权限。
- 出纳付款、凭证确认、规则配置、预算调整等高风险操作必须单独授权。
- 所有登录、审批、付款、凭证、预算调整和权限变更操作必须写入审计日志。
- 附件下载需要鉴权，不允许暴露永久公开链接。

## Documentation Principles

- 新增核心业务模块时，需要同步补充数据模型、状态流转、权限说明和测试说明。
- 新增费用政策或会计规则时，应写明财务依据、适用范围和边界情况。
- 对接外部系统时，应记录接口协议、鉴权方式、回调幂等策略和失败补偿方案。
- 任何临时方案必须标注原因、影响范围和后续移除条件。

## Startup Operations

- 当用户要求启动本项目、启动服务或检查本地运行状态时，必须先阅读并遵守 `docs/startup-guide.md`。
- 启动顺序、环境变量、健康检查地址和默认登录信息以 `docs/startup-guide.md` 为准。
- 不要在未查看启动文档的情况下自行推断前后端启动命令。

## Git Operations

- 涉及本仓库提交、推送、远端检查或 Git 网络问题时，先阅读并遵守 `.codex/skills/expenseflow-git/SKILL.md`。
