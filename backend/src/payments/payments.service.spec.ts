import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ExpenseReportStatus, PaymentMethod } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticatedUser } from '../identity/identity.types';
import { PaymentsService } from './payments.service';

const cashier: AuthenticatedUser = {
  id: 'cashier_1',
  employeeNo: 'PAY001',
  email: 'cashier@expenseflow.local',
  name: 'Cashier',
  departmentId: null,
  costCenterId: null,
  roles: [{ code: 'CASHIER', name: 'Cashier' }],
  permissions: ['exp:payment:read', 'exp:payment:pay'],
};

describe('PaymentsService', () => {
  it('blocks payment actions without cashier payment permission', async () => {
    const service = new PaymentsService({} as never, {} as never);

    expect(() => service.register({ ...cashier, permissions: [] }, 'report_1', { amountCents: 10000 })).toThrow(ForbiddenException);
  });

  it('only pays finance-approved reports', async () => {
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'report_1',
          reportNo: 'EXP001',
          status: ExpenseReportStatus.BUSINESS_APPROVED,
          reimbursableCents: 10000,
          paidAmountCents: 0,
        }),
      },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new PaymentsService(prisma as never, {} as never);

    await expect(service.register(cashier, 'report_1', { amountCents: 10000 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('registers full payment with payment audit, report log, and budget actual transfer', async () => {
    const report = {
      id: 'report_1',
      reportNo: 'EXP001',
      title: 'Taxi',
      status: ExpenseReportStatus.FINANCE_APPROVED,
      currency: 'CNY',
      amountCents: 10000,
      taxAmountCents: 600,
      deductibleTaxCents: 600,
      reimbursableCents: 10000,
      paidAmountCents: 0,
    };
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue(report),
        update: vi.fn().mockResolvedValue({ ...report, status: ExpenseReportStatus.PAID, paidAmountCents: 10000 }),
      },
      expensePaymentBatch: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'batch_1' }),
      },
      expensePayment: { create: vi.fn().mockResolvedValue({ id: 'payment_1' }) },
      expenseReportLog: { create: vi.fn().mockResolvedValue({ id: 'log_1' }) },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const budgets = { transferActual: vi.fn().mockResolvedValue(undefined) };
    const service = new PaymentsService(prisma as never, budgets as never);

    await expect(
      service.register(cashier, 'report_1', {
        amountCents: 10000,
        method: PaymentMethod.BANK_TRANSFER,
        paymentReference: 'BANK-001',
        comment: 'paid',
      }),
    ).resolves.toEqual(expect.objectContaining({ id: 'report_1', status: ExpenseReportStatus.PAID, paidAmountCents: 10000 }));
    expect(tx.expensePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SUCCESS',
          amountCents: 10000,
          fromStatus: ExpenseReportStatus.FINANCE_APPROVED,
          toStatus: ExpenseReportStatus.PAID,
        }),
      }),
    );
    expect(tx.expenseReportLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PAYMENT_REGISTER',
          fromStatus: ExpenseReportStatus.FINANCE_APPROVED,
          toStatus: ExpenseReportStatus.PAID,
        }),
      }),
    );
    expect(budgets.transferActual).toHaveBeenCalledWith(tx, 'report_1', cashier.id, 10000);
  });

  it('records failed payment without changing report status or budget actual amount', async () => {
    const report = {
      id: 'report_1',
      reportNo: 'EXP001',
      status: ExpenseReportStatus.FINANCE_APPROVED,
      currency: 'CNY',
      reimbursableCents: 10000,
      paidAmountCents: 0,
    };
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue(report),
        findUnique: vi.fn().mockResolvedValue(report),
      },
      expensePaymentBatch: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'batch_1' }),
      },
      expensePayment: { create: vi.fn().mockResolvedValue({ id: 'payment_1' }) },
      expenseReportLog: { create: vi.fn().mockResolvedValue({ id: 'log_1' }) },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const budgets = { transferActual: vi.fn() };
    const service = new PaymentsService(prisma as never, budgets as never);

    await expect(service.fail(cashier, 'report_1', { amountCents: 10000, failureReason: 'Bank rejected' })).resolves.toEqual(report);
    expect(tx.expensePayment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }));
    expect(tx.expenseReportLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'PAYMENT_FAIL' }) }));
    expect(budgets.transferActual).not.toHaveBeenCalled();
  });
});
