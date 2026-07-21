import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  ExpenseReportStatus,
  GlAccountMappingPurpose,
  GlVoucherLineDirection,
  GlVoucherStatus,
  GlVoucherType,
  PaymentMethod,
  GlAccountCategory,
  GlNormalBalance,
  GlStatus,
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
  it('physically deletes unreferenced account subjects and audits the cleanup', async () => {
    const subject = {
      id: 'subject_1',
      code: '660199',
      name: 'Temporary expense',
      category: GlAccountCategory.EXPENSE,
      normalBalance: GlNormalBalance.DEBIT,
      description: null,
      status: GlStatus.ACTIVE,
      createdAt: new Date('2026-07-17T00:00:00.000Z'),
      deletedAt: null,
      createdBy: { id: accountant.id, name: accountant.name },
      updatedBy: null,
    };
    const tx = {
      glAccountSubject: { delete: vi.fn().mockResolvedValue(subject) },
      expenseType: { count: vi.fn().mockResolvedValue(0) },
      expenseReportItem: { count: vi.fn().mockResolvedValue(0) },
      budget: { count: vi.fn().mockResolvedValue(0) },
      budgetOccupation: { count: vi.fn().mockResolvedValue(0) },
      glAccountMapping: { count: vi.fn().mockResolvedValue(0) },
      glVoucherLine: { count: vi.fn().mockResolvedValue(0) },
    };
    const prisma = {
      glAccountSubject: { findFirst: vi.fn().mockResolvedValue(subject) },
      $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    };
    const audit = { recordWithClient: vi.fn().mockResolvedValue(undefined) };
    const service = new VouchersService(prisma as never, audit as never);

    await expect(service.disableSubject(accountant, 'subject_1')).resolves.toEqual(subject);
    expect(tx.glAccountSubject.delete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'subject_1' } }));
    expect(audit.recordWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ metadata: { physicalDeleted: true }, after: null }));
  });

  it('deletes account mappings because generated vouchers keep independent line snapshots', async () => {
    const mapping = {
      id: 'mapping_1',
      purpose: GlAccountMappingPurpose.EXPENSE_TYPE,
      expenseTypeCode: 'TRAVEL',
      applicantId: null,
      paymentMethod: null,
      payerAccount: null,
      departmentId: null,
      costCenterId: null,
      projectId: null,
      accountSubjectCode: '660101',
      priority: 100,
      status: GlStatus.ACTIVE,
      effectiveFrom: null,
      effectiveTo: null,
      createdAt: new Date('2026-07-17T00:00:00.000Z'),
      deletedAt: null,
      accountSubject: { id: 'subject_1', code: '660101', name: 'Travel' },
      applicant: null,
      department: null,
      costCenter: null,
      project: null,
      createdBy: { id: accountant.id, name: accountant.name },
      updatedBy: null,
    };
    const tx = { glAccountMapping: { delete: vi.fn().mockResolvedValue(mapping) } };
    const prisma = {
      glAccountMapping: { findFirst: vi.fn().mockResolvedValue(mapping) },
      $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    };
    const audit = { recordWithClient: vi.fn().mockResolvedValue(undefined) };
    const service = new VouchersService(prisma as never, audit as never);

    await expect(service.disableMapping(accountant, 'mapping_1')).resolves.toEqual(mapping);
    expect(tx.glAccountMapping.delete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'mapping_1' } }));
    expect(audit.recordWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ metadata: { physicalDeleted: true }, after: null }));
  });

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

  it('voids all draft vouchers and moves the report back to paid', async () => {
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({ id: 'report_1', reportNo: 'EXP202606220001', status: ExpenseReportStatus.VOUCHER_DRAFTED }),
        update: vi.fn().mockResolvedValue({ id: 'report_1', status: ExpenseReportStatus.PAID }),
      },
      glVoucher: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'voucher_1',
            voucherNo: 'VCH202606220001',
            voucherType: GlVoucherType.PAYMENT,
            status: GlVoucherStatus.DRAFT,
            reportId: 'report_1',
            paymentId: 'payment_1',
            currency: 'CNY',
            totalDebitCents: 10000,
            totalCreditCents: 10000,
            summary: 'Payment',
            lines: [],
            logs: [],
          },
        ]),
        update: vi.fn().mockResolvedValue({ id: 'voucher_1', status: GlVoucherStatus.VOIDED, paymentId: null }),
      },
      expenseReportLog: { create: vi.fn().mockResolvedValue({ id: 'log_1' }) },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const audit = { recordWithClient: vi.fn().mockResolvedValue(undefined) };
    const service = new VouchersService(prisma as never, audit as never);

    await expect(service.voidReportDrafts(accountant, 'report_1', 'mapping changed')).resolves.toEqual([expect.objectContaining({ status: GlVoucherStatus.VOIDED })]);
    expect(tx.glVoucher.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: GlVoucherStatus.VOIDED,
          paymentId: null,
        }),
      }),
    );
    expect(tx.expenseReportLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'VOUCHER_VOID',
          fromStatus: ExpenseReportStatus.VOUCHER_DRAFTED,
          toStatus: ExpenseReportStatus.PAID,
        }),
      }),
    );
    expect(tx.expenseReport.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: ExpenseReportStatus.PAID }) }));
    expect(audit.recordWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ action: SystemAuditAction.VOUCHER_VOID }));
  });

  it('blocks voiding report drafts once any voucher is confirmed', async () => {
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({ id: 'report_1', reportNo: 'EXP202606220001', status: ExpenseReportStatus.VOUCHER_DRAFTED }),
      },
      glVoucher: { count: vi.fn().mockResolvedValue(1) },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new VouchersService(prisma as never, {} as never);

    await expect(service.voidReportDrafts(accountant, 'report_1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
