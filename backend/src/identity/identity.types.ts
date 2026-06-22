export const DEFAULT_PERMISSIONS = [
  { code: 'iam:user:read', name: '查看用户' },
  { code: 'iam:user:write', name: '维护用户' },
  { code: 'iam:role:read', name: '查看角色' },
  { code: 'iam:role:write', name: '维护角色' },
  { code: 'md:department:read', name: '查看部门' },
  { code: 'md:department:write', name: '维护部门' },
  { code: 'md:cost-center:read', name: '查看成本中心' },
  { code: 'md:cost-center:write', name: '维护成本中心' },
  { code: 'md:project:read', name: '查看项目' },
  { code: 'md:project:write', name: '维护项目' },
  { code: 'exp:report:read', name: '查看报销单', description: '查看报销单列表和详情' },
  { code: 'exp:report:write', name: '维护报销单', description: '创建、编辑、提交和作废报销单' },
  { code: 'exp:report:withdraw', name: '撤回报销单', description: '撤回本人已提交且尚未进入审批处理的报销单' },
  { code: 'exp:approval:read', name: '查看审批任务', description: '查看报销审批待办、已办和审批记录' },
  { code: 'exp:approval:approve', name: '处理报销审批', description: '通过或驳回报销审批任务' },
  { code: 'exp:policy:read', name: '查看费用政策', description: '查看费用类型、政策和规则配置' },
  { code: 'exp:policy:write', name: '维护费用政策', description: '维护费用类型、政策和规则配置' },
  { code: 'exp:budget:read', name: '查看预算', description: '查看预算额度、占用、确认和实际发生情况' },
  { code: 'exp:budget:write', name: '维护预算', description: '维护预算额度、控制方式和预算调整入口' },
  { code: 'exp:finance-review:read', name: '查看财务审核', description: '查看待财务审核、已审核报销单和财务审核记录' },
  { code: 'exp:finance-review:review', name: '处理财务审核', description: '执行财务审核通过、退回补充或拒绝' },
  { code: 'exp:payment:read', name: '查看出纳付款', description: '查看待付款报销单、付款批次和付款记录' },
  { code: 'exp:payment:pay', name: '登记出纳付款', description: '登记付款成功、付款失败和重新付款' },
  { code: 'sys:audit:read', name: '查看系统审计', description: '查看登录、权限、附件访问、预算和政策配置等系统审计记录' },
];

export interface AuthenticatedUser {
  id: string;
  employeeNo: string;
  email: string;
  name: string;
  departmentId: string | null;
  costCenterId: string | null;
  roles: Array<{ code: string; name: string }>;
  permissions: string[];
}
