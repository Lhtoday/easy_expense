# 报销单状态机

本文档是 AI 可读的报销生命周期事实来源。实现和 UI 文案应与本文档保持一致。

## 核心状态

- `DRAFT`：员工正在准备报销单。
- `SUBMITTED`：报销单已提交，等待业务审批。
- `BUSINESS_APPROVED`：业务审批已通过，等待财务审核。
- `BUSINESS_REJECTED`：业务审批已驳回并退回员工。
- `FINANCE_APPROVED`：财务审核已通过，等待付款。
- `FINANCE_REJECTED`：财务审核已拒绝，退回员工或进入作废流程。
- `PAID`：出纳付款已完成。
- `VOUCHER_DRAFTED`：会计凭证草稿已生成。
- `VOUCHER_CONFIRMED`：财务角色已确认凭证。
- `WITHDRAWN`：提交人在最终审批前撤回。
- `VOIDED`：报销单已作废。

## 必要原则

- 业务审批和财务审核是不同职责。
- 付款只能在财务审核通过之后发生。
- 凭证生成必须先生成草稿。
- 驳回、撤回和作废动作必须释放相关预算占用。
- 每次状态流转都必须写入审计日志，包含操作者、动作、时间、前状态、后状态，以及适用时的意见。

## 流转说明

- `DRAFT -> SUBMITTED`：校验明细、发票、成本中心、项目、费用政策和预算占用。
- 对必须发票的费用类型，关联发票价税合计必须不小于相关明细的费用金额；否则属于超额报销，当规则动作为阻断时不得提交。
- `SUBMITTED -> BUSINESS_APPROVED`：记录审批通过动作，并进入财务审核。
- `SUBMITTED -> BUSINESS_REJECTED`：记录审批驳回动作，并在支持时允许修改后重新提交。
- 已存在通过的业务审批实例时，不能只改报销单状态重新打开单据；错误审批后的更正必须通过显式且可审计的冲销、作废或未来的重开流程，并使旧审批实例失效或被替代。
- `BUSINESS_APPROVED -> FINANCE_APPROVED`：校验发票合规、会计映射、税务字段和重复发票。
- `FINANCE_APPROVED -> PAID`：需要出纳/付款权限。
- `PAID -> VOUCHER_DRAFTED`：生成会计凭证草稿。
- `VOUCHER_DRAFTED -> VOUCHER_CONFIRMED`：需要财务确认权限。
