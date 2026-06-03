import { describe, expect, it } from 'vitest';
import { AuthController } from './identity/auth.controller';
import { RolesController } from './identity/roles.controller';
import { UsersController } from './identity/users.controller';
import { DepartmentsController } from './master-data/departments.controller';
import { CostCentersController } from './master-data/cost-centers.controller';
import { ProjectsController } from './master-data/projects.controller';
import { RequestWithUser } from './identity/current-user.guard';

const currentUser = {
  id: 'user_1',
  employeeNo: 'ADMIN001',
  email: 'admin@expenseflow.local',
  name: '系统管理员',
  departmentId: null,
  costCenterId: null,
  roles: [{ code: 'ADMIN', name: '系统管理员' }],
  permissions: ['iam:user:read', 'iam:role:read', 'md:department:read'],
};

describe('Phase 1 interface controllers', () => {
  it('returns access token and current user from auth endpoints', async () => {
    const controller = new AuthController({
      login: async () => ({ accessToken: 'token', user: currentUser }),
    } as never);

    await expect(controller.login({ email: 'admin@expenseflow.local', password: 'Admin123!' })).resolves.toEqual({
      accessToken: 'token',
      user: currentUser,
    });
    expect(controller.me({ user: currentUser } as RequestWithUser)).toEqual(currentUser);
  });

  it('exposes user and role list endpoints', async () => {
    const page = { items: [currentUser], page: 1, pageSize: 20, total: 1 };
    const users = new UsersController({ list: async () => page } as never);
    const roles = new RolesController({
      list: async () => ({ items: [{ code: 'ADMIN', name: '系统管理员' }], page: 1, pageSize: 20, total: 1 }),
      permissions: async () => [{ code: 'iam:user:read', name: '查看用户' }],
    } as never);

    await expect(users.list()).resolves.toEqual(page);
    await expect(roles.list()).resolves.toMatchObject({ total: 1 });
    await expect(roles.permissions()).resolves.toEqual([{ code: 'iam:user:read', name: '查看用户' }]);
  });

  it('exposes master data list endpoints', async () => {
    const page = { items: [{ id: 'md_1', code: 'FIN', name: '财务部', status: 'ACTIVE' }], page: 1, pageSize: 20, total: 1 };
    const departments = new DepartmentsController({ list: async () => page } as never);
    const costCenters = new CostCentersController({ list: async () => page } as never);
    const projects = new ProjectsController({ list: async () => page } as never);

    await expect(departments.list()).resolves.toEqual(page);
    await expect(costCenters.list()).resolves.toEqual(page);
    await expect(projects.list()).resolves.toEqual(page);
  });
});
