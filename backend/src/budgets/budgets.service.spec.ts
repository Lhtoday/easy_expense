import { BadRequestException } from '@nestjs/common';
import { BudgetCheckResult, BudgetControlMode, BudgetOccupationStatus, ExpenseReportStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticatedUser } from '../identity/identity.types';
import { BudgetsService } from './budgets.service';

const budgetUser: AuthenticatedUser = {
  id: 'budget_admin',
  employeeNo: 'BUD001',
  email: 'budget@expenseflow.local',
  name: 'Budget Admin',
  departmentId: null,
  costCenterId: null,
  roles: [{ code: 'ADMIN', name: 'Admin' }],
  permissions: ['exp:budget:read', 'exp:budget:write'],
};

describe('BudgetsService paid report reconciliation', () => {
  it('physically deletes unreferenced budgets and audits the cleanup', async () => {
    const budget = {
      id: 'budget_1',
      code: 'TEMP',
      name: 'Temporary budget',
      fiscalPeriod: '2026-07',
      departmentId: null,
      costCenterId: null,
      projectId: null,
      expenseTypeCode: null,
      accountSubjectCode: null,
      currency: 'CNY',
      totalCents: 10000,
      inTransitCents: 0,
      approvedCents: 0,
      actualCents: 0,
      warningThresholdBps: 9000,
      controlMode: BudgetControlMode.WARNING,
      status: 'ACTIVE',
      createdAt: new Date('2026-07-17T00:00:00.000Z'),
      department: null,
      costCenter: null,
      project: null,
      createdBy: { id: budgetUser.id, name: budgetUser.name },
      updatedBy: null,
      logs: [],
    };
    const tx = {
      budget: { delete: vi.fn().mockResolvedValue(budget) },
      budgetOccupation: { count: vi.fn().mockResolvedValue(0) },
      expenseBudgetCheck: { count: vi.fn().mockResolvedValue(0) },
      budgetOperationLog: { count: vi.fn().mockResolvedValue(0) },
    };
    const prisma = {
      budget: { findFirst: vi.fn().mockResolvedValue(budget) },
      $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    };
    const audit = { recordWithClient: vi.fn().mockResolvedValue({ id: 'audit_1' }) };
    const service = new BudgetsService(prisma as never, audit as never);

    await expect(service.disable(budgetUser, 'budget_1')).resolves.toEqual(budget);
    expect(tx.budget.delete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'budget_1' } }));
    expect(audit.recordWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ metadata: { physicalDeleted: true }, after: null }));
  });

  it('records budget master-data creation audit', async () => {
    const budget = {
      id: 'budget_1',
      code: 'BUD202606',
      name: 'June budget',
      fiscalPeriod: '2026-06',
      departmentId: null,
      costCenterId: null,
      projectId: null,
      expenseTypeCode: 'TRAVEL',
      accountSubjectCode: '660201',
      currency: 'CNY',
      totalCents: 100000,
      inTransitCents: 0,
      approvedCents: 0,
      actualCents: 0,
      warningThresholdBps: 9000,
      controlMode: BudgetControlMode.WARNING,
      status: 'ACTIVE',
      createdAt: new Date('2026-06-22T00:00:00.000Z'),
      department: null,
      costCenter: null,
      project: null,
      createdBy: { id: budgetUser.id, name: budgetUser.name },
      updatedBy: null,
      logs: [],
    };
    const tx = {
      budget: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(budget) },
      department: { findFirst: vi.fn() },
      costCenter: { findFirst: vi.fn() },
      project: { findFirst: vi.fn() },
      expenseType: { findFirst: vi.fn().mockResolvedValue({ id: 'type_1' }) },
      glAccountSubject: { findFirst: vi.fn().mockResolvedValue({ id: 'subject_1' }) },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const audit = { recordWithClient: vi.fn().mockResolvedValue({ id: 'audit_1' }) };
    const service = new BudgetsService(prisma as never, audit as never);

    await expect(
      service.create(budgetUser, {
        code: 'BUD202606',
        name: 'June budget',
        fiscalPeriod: '2026-06',
        expenseTypeCode: 'TRAVEL',
        accountSubjectCode: '660201',
        totalCents: 100000,
      }),
    ).resolves.toEqual(budget);
    expect(audit.recordWithClient).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        operator: budgetUser,
        action: 'BUDGET_CREATE',
        entityType: 'budget',
        entityId: 'budget_1',
        after: expect.objectContaining({ totalCents: 100000, expenseTypeCode: 'TRAVEL' }),
      }),
    );
  });

  it('returns a clear error when budget dimensions already exist', async () => {
    const tx = {
      budget: {
        findFirst: vi.fn().mockResolvedValue({ id: 'budget_existing', code: 'BUD202607' }),
        create: vi.fn(),
      },
      department: { findFirst: vi.fn() },
      costCenter: { findFirst: vi.fn() },
      project: { findFirst: vi.fn() },
      expenseType: { findFirst: vi.fn() },
      glAccountSubject: { findFirst: vi.fn() },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new BudgetsService(prisma as never, {} as never);

    await expect(
      service.create(budgetUser, {
        code: 'BUD202607',
        name: 'July budget',
        fiscalPeriod: '2026-07',
        totalCents: 100000,
      }),
    ).rejects.toThrow('该期间和维度组合已有预算 BUD202607');
    expect(tx.budget.create).not.toHaveBeenCalled();
  });

  it('returns a clear error when budget amount exceeds integer storage limit', async () => {
    const prisma = { $transaction: vi.fn() };
    const service = new BudgetsService(prisma as never, {} as never);

    expect(() =>
      service.create(budgetUser, {
        code: 'BUDGET_TEST_PHONE',
        name: 'BUDGET',
        fiscalPeriod: '2026-06',
        expenseTypeCode: 'PHONE',
        totalCents: 10_000_000_000,
      }),
    ).toThrow('预算总额不能超过 21474836.47 元');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns a clear error when budget department is invalid', async () => {
    const tx = {
      budget: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      department: { findFirst: vi.fn().mockResolvedValue(null) },
      costCenter: { findFirst: vi.fn() },
      project: { findFirst: vi.fn() },
      expenseType: { findFirst: vi.fn() },
      glAccountSubject: { findFirst: vi.fn() },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new BudgetsService(prisma as never, {} as never);

    await expect(
      service.create(budgetUser, {
        code: 'BUD202607',
        name: 'July budget',
        fiscalPeriod: '2026-07',
        departmentId: 'invalid_department',
        totalCents: 100000,
      }),
    ).rejects.toThrow('部门不存在或已停用');
    expect(tx.budget.create).not.toHaveBeenCalled();
  });

  it('only reconciles paid reports', async () => {
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'report_1',
          reportNo: 'EXP001',
          status: ExpenseReportStatus.FINANCE_APPROVED,
          currency: 'CNY',
          paidAmountCents: 10000,
          items: [],
        }),
      },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new BudgetsService(prisma as never);

    await expect(service.reconcilePaidReport(budgetUser, 'report_1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('backfills paid report items into matching budget actual amount', async () => {
    const item = {
      id: 'item_1',
      occurredAt: new Date('2026-06-10T00:00:00.000Z'),
      departmentId: 'dep_1',
      costCenterId: 'cc_1',
      projectId: null,
      expenseTypeCode: 'TRAVEL',
      accountSubjectCode: '660201',
      reimbursableCents: 10000,
    };
    const budget = {
      id: 'budget_1',
      departmentId: 'dep_1',
      costCenterId: 'cc_1',
      projectId: null,
      expenseTypeCode: 'TRAVEL',
      accountSubjectCode: '660201',
      totalCents: 50000,
      inTransitCents: 0,
      approvedCents: 0,
      actualCents: 0,
      controlMode: BudgetControlMode.WARNING,
      warningThresholdBps: 9000,
    };
    const genericBudget = {
      ...budget,
      id: 'budget_generic',
      departmentId: null,
      costCenterId: null,
      expenseTypeCode: null,
      accountSubjectCode: null,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'budget_1' }]),
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'report_1',
          reportNo: 'EXP001',
          status: ExpenseReportStatus.PAID,
          currency: 'CNY',
          paidAmountCents: 10000,
          items: [item],
        }),
      },
      budgetOccupation: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
        create: vi.fn().mockResolvedValue({ id: 'occupation_1' }),
        update: vi.fn(),
      },
      budget: {
        findMany: vi.fn().mockResolvedValue([genericBudget, budget]),
        findUniqueOrThrow: vi.fn().mockResolvedValue(budget),
        update: vi.fn().mockResolvedValue({ id: 'budget_1' }),
      },
      budgetOperationLog: { create: vi.fn().mockResolvedValue({ id: 'log_1' }) },
      expenseBudgetCheck: { create: vi.fn() },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new BudgetsService(prisma as never);

    await expect(service.reconcilePaidReport(budgetUser, 'report_1')).resolves.toEqual({
      reportId: 'report_1',
      reportNo: 'EXP001',
      reconciled: [{ itemId: 'item_1', budgetId: 'budget_1', amountCents: 10000 }],
      skipped: [],
    });
    expect(tx.budgetOccupation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          budgetId: 'budget_1',
          reportId: 'report_1',
          itemId: 'item_1',
          status: BudgetOccupationStatus.ACTUAL,
          actualCents: 10000,
        }),
      }),
    );
    expect(tx.budget.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actualCents: 10000 }) }));
    expect(tx.budgetOperationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ADJUST',
          amountCents: 10000,
          beforeActualCents: 0,
          afterActualCents: 10000,
        }),
      }),
    );
  });

  it('does not duplicate actual budget occupation on repeated reconciliation', async () => {
    const item = {
      id: 'item_1',
      occurredAt: new Date('2026-06-10T00:00:00.000Z'),
      departmentId: null,
      costCenterId: null,
      projectId: null,
      expenseTypeCode: 'TRAVEL',
      accountSubjectCode: null,
      reimbursableCents: 10000,
    };
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'report_1',
          reportNo: 'EXP001',
          status: ExpenseReportStatus.PAID,
          currency: 'CNY',
          paidAmountCents: 10000,
          items: [item],
        }),
      },
      budgetOccupation: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ itemId: 'item_1', actualCents: 10000 }]),
        create: vi.fn(),
      },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new BudgetsService(prisma as never);

    await expect(service.reconcilePaidReport(budgetUser, 'report_1')).resolves.toEqual({
      reportId: 'report_1',
      reportNo: 'EXP001',
      reconciled: [],
      skipped: [{ itemId: 'item_1', reason: 'Item already has actual budget occupation.' }],
    });
    expect(tx.budgetOccupation.create).not.toHaveBeenCalled();
  });

  it('blocks report submission when no matching budget is configured', async () => {
    const tx = {
      budgetOccupation: { findMany: vi.fn().mockResolvedValue([]) },
      expenseBudgetCheck: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'report_1',
          currency: 'CNY',
          items: [
            {
              id: 'item_1',
              occurredAt: new Date('2026-06-08T00:00:00.000Z'),
              departmentId: 'dep_1',
              costCenterId: 'cc_1',
              projectId: null,
              expenseTypeCode: 'TRAVEL',
              accountSubjectCode: '660201',
              reimbursableCents: 10000,
            },
          ],
        }),
      },
      budget: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new BudgetsService({} as never);

    await expect(service.occupyOnSubmit(tx as never, 'report_1', budgetUser.id)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.expenseBudgetCheck.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            reportId: 'report_1',
            itemId: 'item_1',
            result: BudgetCheckResult.BLOCK,
            message: expect.stringContaining('未配置匹配预算'),
          }),
        ],
      }),
    );
  });
});
