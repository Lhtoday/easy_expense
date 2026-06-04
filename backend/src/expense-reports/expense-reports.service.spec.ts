import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ExpenseReportStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticatedUser } from '../identity/identity.types';
import { ExpenseReportsService } from './expense-reports.service';

const user: AuthenticatedUser = {
  id: 'user_1',
  employeeNo: 'ADMIN001',
  email: 'admin@expenseflow.local',
  name: '系统管理员',
  departmentId: 'dept_1',
  costCenterId: 'cc_1',
  roles: [{ code: 'ADMIN', name: '系统管理员' }],
  permissions: ['exp:report:read', 'exp:report:write', 'exp:report:withdraw'],
};

const draft = {
  title: '差旅报销',
  items: [
    {
      occurredAt: '2026-06-04',
      expenseTypeCode: 'TRAVEL',
      accountSubjectCode: '660201',
      description: '高铁票',
      amountCents: 12050,
      taxAmountCents: 350,
      deductibleTaxCents: 350,
      reimbursableCents: 12050,
    },
  ],
};

describe('ExpenseReportsService', () => {
  it('creates a draft with fixed-cent totals and audit log', async () => {
    const tx = {
      expenseReport: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ reportNo: 'EXP202606040001', amountCents: 12050 }),
      },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new ExpenseReportsService(prisma as never);

    await expect(service.create(user, draft)).resolves.toEqual({ reportNo: 'EXP202606040001', amountCents: 12050 });
    expect(tx.expenseReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountCents: 12050,
          taxAmountCents: 350,
          deductibleTaxCents: 350,
          reimbursableCents: 12050,
          logs: expect.objectContaining({ create: expect.objectContaining({ action: 'CREATE' }) }),
        }),
      }),
    );
  });

  it('blocks write actions without report permission', async () => {
    const service = new ExpenseReportsService({} as never);
    await expect(service.create({ ...user, permissions: [] }, draft)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid money relationships before saving', async () => {
    const service = new ExpenseReportsService({} as never);
    await expect(
      service.create(user, {
        ...draft,
        items: [{ ...draft.items[0], deductibleTaxCents: 500, taxAmountCents: 300 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('only submits editable drafts with positive reimbursable amount', async () => {
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'report_1',
          status: ExpenseReportStatus.DRAFT,
          currency: 'CNY',
          departmentId: null,
          costCenterId: null,
          reimbursableCents: 0,
        }),
      },
      expenseReportItem: { count: vi.fn().mockResolvedValue(1) },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new ExpenseReportsService(prisma as never);

    await expect(service.submit(user, 'report_1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('withdraws own submitted report back to draft with audit log', async () => {
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'report_1',
          status: ExpenseReportStatus.SUBMITTED,
          applicantId: user.id,
        }),
        update: vi.fn().mockResolvedValue({ id: 'report_1', status: ExpenseReportStatus.DRAFT }),
      },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new ExpenseReportsService(prisma as never);

    await expect(service.withdraw(user, 'report_1', '填错金额')).resolves.toEqual({ id: 'report_1', status: ExpenseReportStatus.DRAFT });
    expect(tx.expenseReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ExpenseReportStatus.DRAFT,
          logs: expect.objectContaining({
            create: expect.objectContaining({
              action: 'WITHDRAW',
              fromStatus: ExpenseReportStatus.SUBMITTED,
              toStatus: ExpenseReportStatus.DRAFT,
              comment: '填错金额',
            }),
          }),
        }),
      }),
    );
  });

  it('blocks withdrawing another applicant report', async () => {
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'report_1',
          status: ExpenseReportStatus.SUBMITTED,
          applicantId: 'other_user',
        }),
      },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new ExpenseReportsService(prisma as never);

    await expect(service.withdraw(user, 'report_1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
