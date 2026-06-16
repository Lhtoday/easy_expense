import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ExpenseReportStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticatedUser } from '../identity/identity.types';
import { FinanceReviewsService } from './finance-reviews.service';

const user: AuthenticatedUser = {
  id: 'finance_1',
  employeeNo: 'FIN001',
  email: 'finance@expenseflow.local',
  name: 'Finance Reviewer',
  departmentId: null,
  costCenterId: null,
  roles: [{ code: 'FINANCE', name: 'Finance' }],
  permissions: ['exp:finance-review:read', 'exp:finance-review:review'],
};

describe('FinanceReviewsService', () => {
  it('blocks finance review actions without review permission', async () => {
    const service = new FinanceReviewsService({} as never, {} as never);

    await expect(service.approve({ ...user, permissions: [] }, 'report_1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('only handles business-approved reports', async () => {
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({ id: 'report_1', status: ExpenseReportStatus.SUBMITTED }),
      },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new FinanceReviewsService(prisma as never, {} as never);

    await expect(service.approve(user, 'report_1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('approves a business-approved report with audit records and budget confirmation', async () => {
    const report = {
      id: 'report_1',
      status: ExpenseReportStatus.BUSINESS_APPROVED,
      amountCents: 10000,
      taxAmountCents: 600,
      deductibleTaxCents: 600,
      items: [
        {
          id: 'item_1',
          description: 'Taxi',
          accountSubjectCode: '660201',
          costCenterId: 'cc_1',
          projectId: null,
          amountCents: 10000,
          taxAmountCents: 600,
          deductibleTaxCents: 600,
          reimbursableCents: 10000,
        },
      ],
      invoices: [
        {
          id: 'invoice_1',
          itemId: 'item_1',
          invoiceNo: 'INV001',
          duplicateStatus: 'UNIQUE',
          amountCents: 9400,
          taxAmountCents: 600,
          totalAmountCents: 10000,
          deductibleTaxCents: 600,
        },
      ],
    };
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue(report),
        update: vi.fn().mockResolvedValue({ ...report, status: ExpenseReportStatus.FINANCE_APPROVED }),
      },
      expenseFinanceReview: { create: vi.fn().mockResolvedValue({ id: 'review_1' }) },
      expenseReportLog: { create: vi.fn().mockResolvedValue({ id: 'log_1' }) },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const budgets = { confirmApproved: vi.fn().mockResolvedValue(undefined), releaseReport: vi.fn().mockResolvedValue(undefined) };
    const service = new FinanceReviewsService(prisma as never, budgets as never);

    await expect(service.approve(user, 'report_1', 'ok')).resolves.toEqual(
      expect.objectContaining({
        id: 'report_1',
        status: ExpenseReportStatus.FINANCE_APPROVED,
        financeReviewChecks: expect.arrayContaining([expect.objectContaining({ severity: 'WARNING', code: 'MISSING_PROJECT' })]),
      }),
    );
    expect(tx.expenseFinanceReview.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'APPROVE',
          fromStatus: ExpenseReportStatus.BUSINESS_APPROVED,
          toStatus: ExpenseReportStatus.FINANCE_APPROVED,
          operatorId: user.id,
        }),
      }),
    );
    expect(tx.expenseReportLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'FINANCE_APPROVE',
          fromStatus: ExpenseReportStatus.BUSINESS_APPROVED,
          toStatus: ExpenseReportStatus.FINANCE_APPROVED,
        }),
      }),
    );
    expect(budgets.confirmApproved).toHaveBeenCalledWith(tx, 'report_1', user.id);
    expect(budgets.releaseReport).not.toHaveBeenCalled();
  });

  it('blocks finance approval when accounting dimensions have blocking issues', async () => {
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'report_1',
          status: ExpenseReportStatus.BUSINESS_APPROVED,
          amountCents: 10000,
          taxAmountCents: 600,
          deductibleTaxCents: 600,
          items: [
            {
              id: 'item_1',
              description: 'Taxi',
              accountSubjectCode: null,
              costCenterId: 'cc_1',
              projectId: null,
              amountCents: 10000,
              taxAmountCents: 600,
              deductibleTaxCents: 600,
              reimbursableCents: 10000,
            },
          ],
          invoices: [
            {
              id: 'invoice_1',
              itemId: 'item_1',
              invoiceNo: 'INV001',
              duplicateStatus: 'UNIQUE',
              amountCents: 9400,
              taxAmountCents: 600,
              totalAmountCents: 10000,
              deductibleTaxCents: 600,
            },
          ],
        }),
      },
      expenseFinanceReview: { create: vi.fn() },
      expenseReportLog: { create: vi.fn() },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const budgets = { confirmApproved: vi.fn(), releaseReport: vi.fn() };
    const service = new FinanceReviewsService(prisma as never, budgets as never);

    await expect(service.approve(user, 'report_1')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.expenseFinanceReview.create).not.toHaveBeenCalled();
    expect(budgets.confirmApproved).not.toHaveBeenCalled();
  });

  it('adjusts finance review item fields with audit records and report tax totals', async () => {
    const report = {
      id: 'report_1',
      status: ExpenseReportStatus.BUSINESS_APPROVED,
      currency: 'CNY',
      items: [
        {
          id: 'item_1',
          accountSubjectCode: null,
          costCenterId: 'cc_old',
          projectId: null,
          taxAmountCents: 500,
          deductibleTaxCents: 300,
        },
      ],
    };
    const updatedReport = {
      id: 'report_1',
      status: ExpenseReportStatus.BUSINESS_APPROVED,
      amountCents: 10000,
      taxAmountCents: 600,
      deductibleTaxCents: 600,
      items: [
        {
          id: 'item_1',
          description: 'Taxi',
          accountSubjectCode: '660201',
          costCenterId: 'cc_new',
          projectId: null,
          amountCents: 10000,
          taxAmountCents: 600,
          deductibleTaxCents: 600,
          reimbursableCents: 10000,
        },
      ],
      invoices: [],
    };
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue(report),
        update: vi.fn().mockResolvedValue(updatedReport),
      },
      expenseReportItem: {
        update: vi.fn().mockResolvedValue({ id: 'item_1' }),
        findMany: vi.fn().mockResolvedValue([{ amountCents: 10000, taxAmountCents: 600, deductibleTaxCents: 600, reimbursableCents: 10000 }]),
      },
      expenseFinanceReview: { create: vi.fn().mockResolvedValue({ id: 'review_1' }) },
      expenseReportLog: { create: vi.fn().mockResolvedValue({ id: 'log_1' }) },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new FinanceReviewsService(prisma as never, {} as never);

    await expect(
      service.adjustItem(user, 'report_1', 'item_1', {
        accountSubjectCode: '660201',
        costCenterId: 'cc_new',
        taxAmountCents: 600,
        deductibleTaxCents: 600,
        comment: 'fix accounting and tax',
      }),
    ).resolves.toEqual(expect.objectContaining({ id: 'report_1', taxAmountCents: 600, deductibleTaxCents: 600 }));
    expect(tx.expenseReportItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item_1' },
        data: expect.objectContaining({
          accountSubjectCode: '660201',
          costCenter: { connect: { id: 'cc_new' } },
          taxAmountCents: 600,
          deductibleTaxCents: 600,
        }),
      }),
    );
    expect(tx.expenseReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountCents: 10000, taxAmountCents: 600, deductibleTaxCents: 600, reimbursableCents: 10000, updatedById: user.id }),
      }),
    );
    expect(tx.expenseFinanceReview.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'ADJUST', fromStatus: ExpenseReportStatus.BUSINESS_APPROVED, toStatus: ExpenseReportStatus.BUSINESS_APPROVED }),
      }),
    );
    expect(tx.expenseReportLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'FINANCE_ADJUST' }) }));
  });

  it('returns richer invoice exception checks for finance review detail', async () => {
    const report = {
      id: 'report_1',
      status: ExpenseReportStatus.BUSINESS_APPROVED,
      currency: 'CNY',
      amountCents: 10000,
      taxAmountCents: 600,
      deductibleTaxCents: 600,
      submittedAt: new Date('2026-06-10T00:00:00.000Z'),
      items: [
        {
          id: 'item_1',
          description: 'Taxi',
          accountSubjectCode: '660201',
          costCenterId: 'cc_1',
          projectId: 'project_1',
          amountCents: 10000,
          taxAmountCents: 600,
          deductibleTaxCents: 600,
          reimbursableCents: 10000,
        },
      ],
      invoices: [
        {
          id: 'invoice_1',
          itemId: 'item_1',
          invoiceCode: '044',
          invoiceNo: 'INV001',
          issuedAt: new Date('2026-06-11T00:00:00.000Z'),
          sellerName: 'Seller',
          sellerTaxNo: null,
          buyerName: null,
          buyerTaxNo: null,
          duplicateStatus: 'UNIQUE',
          amountCents: 9400,
          taxAmountCents: 300,
          totalAmountCents: 9700,
          deductibleTaxCents: 300,
          currency: 'USD',
        },
      ],
    };
    const prisma = { expenseReport: { findFirst: vi.fn().mockResolvedValue(report) } };
    const service = new FinanceReviewsService(prisma as never, {} as never);

    await expect(service.getReport(user, 'report_1')).resolves.toEqual(
      expect.objectContaining({
        financeReviewChecks: expect.arrayContaining([
          expect.objectContaining({ code: 'INVOICE_CURRENCY_MISMATCH', severity: 'BLOCK' }),
          expect.objectContaining({ code: 'INVOICE_MISSING_SELLER_TAX_NO', severity: 'WARNING' }),
          expect.objectContaining({ code: 'INVOICE_MISSING_BUYER_INFO', severity: 'WARNING' }),
          expect.objectContaining({ code: 'INVOICE_ISSUED_AFTER_SUBMIT', severity: 'WARNING' }),
          expect.objectContaining({ code: 'ITEM_INVOICE_TAX_SHORT', severity: 'BLOCK' }),
          expect.objectContaining({ code: 'ITEM_INVOICE_DEDUCTIBLE_TAX_SHORT', severity: 'BLOCK' }),
        ]),
      }),
    );
  });
});
