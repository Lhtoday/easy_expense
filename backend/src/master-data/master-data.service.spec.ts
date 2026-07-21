import { MasterDataStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CostCentersService } from './cost-centers.service';
import { DepartmentsService } from './departments.service';
import { ProjectsService } from './projects.service';

describe('Master data delete or disable rules', () => {
  it('physically deletes an unreferenced department', async () => {
    const department = { id: 'dep_1', code: 'D001', name: 'New department', parentId: null, status: MasterDataStatus.ACTIVE, createdAt: new Date() };
    const prisma = {
      department: {
        findFirst: vi.fn().mockResolvedValue({ id: 'dep_1' }),
        delete: vi.fn().mockResolvedValue(department),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      user: { count: vi.fn().mockResolvedValue(0) },
      costCenter: { count: vi.fn().mockResolvedValue(0) },
      project: { count: vi.fn().mockResolvedValue(0) },
      dataScope: { count: vi.fn().mockResolvedValue(0) },
      expenseReport: { count: vi.fn().mockResolvedValue(0) },
      expenseReportItem: { count: vi.fn().mockResolvedValue(0) },
      budget: { count: vi.fn().mockResolvedValue(0) },
      glAccountMapping: { count: vi.fn().mockResolvedValue(0) },
      glVoucherLine: { count: vi.fn().mockResolvedValue(0) },
      $transaction: (queries: unknown[]) => Promise.all(queries),
    };
    const service = new DepartmentsService(prisma as never);

    await expect(service.remove('dep_1')).resolves.toEqual(department);
    expect(prisma.department.delete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'dep_1' } }));
    expect(prisma.department.update).not.toHaveBeenCalled();
  });

  it('disables a referenced cost center instead of deleting it', async () => {
    const costCenter = { id: 'cc_1', code: 'CC001', name: 'Ops', departmentId: null, status: MasterDataStatus.DISABLED, createdAt: new Date() };
    const prisma = {
      costCenter: {
        findFirst: vi.fn().mockResolvedValue({ id: 'cc_1' }),
        delete: vi.fn(),
        update: vi.fn().mockResolvedValue(costCenter),
      },
      user: { count: vi.fn().mockResolvedValue(0) },
      project: { count: vi.fn().mockResolvedValue(0) },
      dataScope: { count: vi.fn().mockResolvedValue(0) },
      expenseReport: { count: vi.fn().mockResolvedValue(1) },
      expenseReportItem: { count: vi.fn().mockResolvedValue(0) },
      budget: { count: vi.fn().mockResolvedValue(0) },
      glAccountMapping: { count: vi.fn().mockResolvedValue(0) },
      glVoucherLine: { count: vi.fn().mockResolvedValue(0) },
      $transaction: (queries: unknown[]) => Promise.all(queries),
    };
    const service = new CostCentersService(prisma as never);

    await expect(service.remove('cc_1')).resolves.toEqual(costCenter);
    expect(prisma.costCenter.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: MasterDataStatus.DISABLED } }));
    expect(prisma.costCenter.delete).not.toHaveBeenCalled();
  });

  it('physically deletes an unreferenced project', async () => {
    const project = { id: 'project_1', code: 'P001', name: 'Pilot', ownerUserId: null, departmentId: null, costCenterId: null, status: MasterDataStatus.ACTIVE, createdAt: new Date() };
    const prisma = {
      project: {
        findFirst: vi.fn().mockResolvedValue({ id: 'project_1' }),
        delete: vi.fn().mockResolvedValue(project),
        update: vi.fn(),
      },
      dataScope: { count: vi.fn().mockResolvedValue(0) },
      expenseReport: { count: vi.fn().mockResolvedValue(0) },
      expenseReportItem: { count: vi.fn().mockResolvedValue(0) },
      budget: { count: vi.fn().mockResolvedValue(0) },
      glAccountMapping: { count: vi.fn().mockResolvedValue(0) },
      glVoucherLine: { count: vi.fn().mockResolvedValue(0) },
      $transaction: (queries: unknown[]) => Promise.all(queries),
    };
    const service = new ProjectsService(prisma as never);

    await expect(service.remove('project_1')).resolves.toEqual(project);
    expect(prisma.project.delete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'project_1' } }));
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});
