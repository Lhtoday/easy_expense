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
