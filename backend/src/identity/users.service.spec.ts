import { describe, expect, it, vi } from 'vitest';
import { AuthenticatedUser } from './identity.types';
import { UsersService } from './users.service';

const admin: AuthenticatedUser = {
  id: 'admin_1',
  employeeNo: 'ADMIN001',
  email: 'admin@expenseflow.local',
  name: 'Admin',
  departmentId: null,
  costCenterId: null,
  roles: [{ code: 'ADMIN', name: 'Admin' }],
  permissions: ['iam:user:read', 'iam:user:write'],
};

describe('UsersService audit behavior', () => {
  it('records user role assignment changes with the authenticated operator', async () => {
    const before = {
      id: 'user_1',
      employeeNo: 'EMP001',
      email: 'employee@expenseflow.local',
      name: 'Employee',
      status: 'ACTIVE',
      departmentId: null,
      costCenterId: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      deletedAt: null,
      roles: [{ role: { id: 'role_old', code: 'EMPLOYEE', name: 'Employee' } }],
    };
    const after = {
      ...before,
      roles: [{ role: { id: 'role_cashier', code: 'CASHIER', name: 'Cashier' } }],
    };
    const tx = {
      userRole: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      user: { update: vi.fn().mockResolvedValue(after) },
    };
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue(before) },
      $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    };
    const auth = { hashPassword: vi.fn() };
    const audit = { recordWithClient: vi.fn().mockResolvedValue({ id: 'audit_1' }) };
    const service = new UsersService(prisma as never, auth as never, audit as never);

    await expect(service.update(admin, 'user_1', { roleIds: ['role_cashier'] })).resolves.toEqual(after);
    expect(audit.recordWithClient).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        operator: admin,
        action: 'USER_ROLE_UPDATE',
        entityType: 'iam-user',
        entityId: 'user_1',
        before: expect.objectContaining({ roles: before.roles }),
        after: expect.objectContaining({ roles: after.roles }),
      }),
    );
  });
});
