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
