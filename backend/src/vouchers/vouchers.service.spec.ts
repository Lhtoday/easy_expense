import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  ExpenseReportStatus,
  GlAccountMappingPurpose,
  GlVoucherLineDirection,
  GlVoucherStatus,
  GlVoucherType,
  PaymentMethod,
  SystemAuditAction,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticatedUser } from '../identity/identity.types';
import { VouchersService } from './vouchers.service';

const accountant: AuthenticatedUser = {
  id: 'fin_1',
  employeeNo: 'FIN001',
  email: 'fin@expenseflow.local',
  name: 'Finance',
  departmentId: null,
  costCenterId: null,
  roles: [{ code: 'FINANCE', name: 'Finance' }],
  permissions: ['gl:voucher:read', 'gl:voucher:generate', 'gl:voucher:confirm', 'gl:account:read', 'gl:account:write'],
};

const paidReport = {
  id: 'report_1',
  reportNo: 'EXP202606220001',
  title: 'Travel',
  status: ExpenseReportStatus.PAID,
  currency: 'CNY',
  reimbursableCents: 10000,
  paidAmountCents: 10000,
  applicantId: 'emp_1',
  applicant: { id: 'emp_1', name: 'Alice', employeeNo: 'E001' },
  items: [
    {
      id: 'item_1',
      expenseTypeCode: 'TRAVEL',
      accountSubjectCode: null,
      description: 'Taxi',
      departmentId: 'dept_1',
      costCenterId: 'cc_1',
      projectId: null,
      reimbursableCents: 10000,
      deductibleTaxCents: 600,
    },
  ],
  payments: [
    {
      id: 'payment_1',
      method: PaymentMethod.BANK_TRANSFER,
      amountCents: 10000,
      currency: 'CNY',
      payerAccount: 'BANK-001',
      paidAt: new Date('2026-06-22T10:00:00.000Z'),
    },
  ],
};

function mappingFor(purpose: GlAccountMappingPurpose) {
  const accountSubjectCodeByPurpose = {
    [GlAccountMappingPurpose.EXPENSE_TYPE]: '660101',
    [GlAccountMappingPurpose.INPUT_TAX]: '222101',
    [GlAccountMappingPurpose.EMPLOYEE_PAYABLE]: '224101',
    [GlAccountMappingPurpose.BANK_PAYMENT]: '100201',
  };
  return [
    {
      accountSubjectCode: accountSubjectCodeByPurpose[purpose],
      priority: 10,
      applicantId: purpose === GlAccountMappingPurpose.EMPLOYEE_PAYABLE ? 'emp_1' : null,
      paymentMethod: purpose === GlAccountMappingPurpose.BANK_PAYMENT ? PaymentMethod.BANK_TRANSFER : null,
      payerAccount: purpose === GlAccountMappingPurpose.BANK_PAYMENT ? 'BANK-001' : null,
      departmentId: null,
      costCenterId: null,
      projectId: null,
    },
  ];
}

describe('VouchersService', () => {
  it('blocks voucher generation without permission', () => {
    const service = new VouchersService({} as never, {} as never);

    expect(() => service.generateReportVouchers({ ...accountant, permissions: [] }, 'report_1')).toThrow(ForbiddenException);
  });

  it('only generates vouchers for paid reports with successful payments', async () => {
    const tx = {
      expenseReport: { findFirst: vi.fn().mockResolvedValue({ ...paidReport, status: ExpenseReportStatus.FINANCE_APPROVED, paidAmountCents: 0, payments: [] }) },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new VouchersService(prisma as never, {} as never);

    await expect(service.generateReportVouchers(accountant, 'report_1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generates balanced accrual and payment voucher drafts with report log and audit', async () => {
    const createdVouchers: unknown[] = [];
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue(paidReport),
        update: vi.fn().mockResolvedValue({ id: 'report_1', status: ExpenseReportStatus.VOUCHER_DRAFTED }),
      },
      glVoucher: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockImplementation(async ({ data }) => {
          const voucher = { id: `voucher_${createdVouchers.length + 1}`, status: GlVoucherStatus.DRAFT, ...data };
          createdVouchers.push(voucher);
          return voucher;
        }),
      },
      glAccountMapping: {
        findMany: vi.fn().mockImplementation(({ where }) => Promise.resolve(mappingFor(where.purpose))),
      },
      expenseReportLog: { create: vi.fn().mockResolvedValue({ id: 'log_1' }) },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const audit = { recordWithClient: vi.fn().mockResolvedValue(undefined) };
    const service = new VouchersService(prisma as never, audit as never);

    await expect(service.generateReportVouchers(accountant, 'report_1', 'draft')).resolves.toHaveLength(2);
    expect(tx.glVoucher.create).toHaveBeenCalledTimes(2);
    expect(createdVouchers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ voucherType: GlVoucherType.EXPENSE_ACCRUAL, totalDebitCents: 10000, totalCreditCents: 10000 }),
        expect.objectContaining({ voucherType: GlVoucherType.PAYMENT, totalDebitCents: 10000, totalCreditCents: 10000, paymentId: 'payment_1' }),
      ]),
    );
    expect(tx.expenseReportLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'VOUCHER_DRAFT',
          fromStatus: ExpenseReportStatus.PAID,
          toStatus: ExpenseReportStatus.VOUCHER_DRAFTED,
        }),
      }),
    );
    expect(audit.recordWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ action: SystemAuditAction.VOUCHER_DRAFT_GENERATE }));
  });

  it('confirms the last draft voucher and moves the report to voucher confirmed', async () => {
    const tx = {
      glVoucher: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'voucher_1',
          status: GlVoucherStatus.DRAFT,
          reportId: 'report_1',
          voucherType: GlVoucherType.EXPENSE_ACCRUAL,
          lines: [
            { direction: GlVoucherLineDirection.DEBIT, amountCents: 10000 },
            { direction: GlVoucherLineDirection.CREDIT, amountCents: 10000 },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: 'voucher_1', status: GlVoucherStatus.CONFIRMED }),
        count: vi.fn().mockResolvedValue(0),
      },
      expenseReportLog: { create: vi.fn().mockResolvedValue({ id: 'log_1' }) },
      expenseReport: { update: vi.fn().mockResolvedValue({ id: 'report_1', status: ExpenseReportStatus.VOUCHER_CONFIRMED }) },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const audit = { recordWithClient: vi.fn().mockResolvedValue(undefined) };
    const service = new VouchersService(prisma as never, audit as never);

    await expect(service.confirm(accountant, 'voucher_1', 'ok')).resolves.toEqual(expect.objectContaining({ status: GlVoucherStatus.CONFIRMED }));
    expect(tx.expenseReportLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'VOUCHER_CONFIRM',
          fromStatus: ExpenseReportStatus.VOUCHER_DRAFTED,
          toStatus: ExpenseReportStatus.VOUCHER_CONFIRMED,
        }),
      }),
    );
    expect(tx.expenseReport.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: ExpenseReportStatus.VOUCHER_CONFIRMED }) }));
    expect(audit.recordWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ action: SystemAuditAction.VOUCHER_CONFIRM }));
  });
});
