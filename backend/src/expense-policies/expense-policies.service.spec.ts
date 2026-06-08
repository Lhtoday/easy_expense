import { ExpensePolicyAction, ExpensePolicyCheckResult, ExpensePolicyStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ExpensePoliciesService } from './expense-policies.service';

describe('ExpensePoliciesService', () => {
  it('checks single-item limits against expense amount instead of reimbursable amount', async () => {
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'report_1',
          items: [
            {
              id: 'item_1',
              expenseTypeCode: 'OFFICE',
              description: '办公用品',
              amountCents: 10000,
              reimbursableCents: 8000,
              invoices: [{ id: 'invoice_1', totalAmountCents: 10000 }],
            },
          ],
        }),
      },
      expensePolicy: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'policy_1',
            rules: [
              {
                id: 'rule_1',
                name: '办公费限额',
                expenseTypeCode: 'OFFICE',
                maxAmountCents: 8000,
                requiresInvoice: false,
                requiresPreApproval: false,
                action: ExpensePolicyAction.BLOCK,
              },
            ],
          },
        ]),
      },
      expensePolicyCheck: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new ExpensePoliciesService({} as never);

    const findings = await service.evaluateAndStore(tx as never, 'report_1');

    expect(findings).toEqual([
      expect.objectContaining({
        result: ExpensePolicyCheckResult.BLOCK,
        message: '办公用品 命中「办公费限额」：费用金额 100 元超过单笔限额 80 元',
      }),
    ]);
    expect(tx.expensePolicy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: ExpensePolicyStatus.ACTIVE }),
      }),
    );
    expect(tx.expensePolicyCheck.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            reportId: 'report_1',
            itemId: 'item_1',
            result: ExpensePolicyCheckResult.BLOCK,
          }),
        ],
      }),
    );
  });

  it('blocks invoice-required items when invoice total is less than expense amount', async () => {
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'report_1',
          items: [
            {
              id: 'item_1',
              expenseTypeCode: 'TRAVEL',
              description: '差旅费',
              amountCents: 10000,
              reimbursableCents: 10000,
              invoices: [{ id: 'invoice_1', totalAmountCents: 8000 }],
            },
          ],
        }),
      },
      expensePolicy: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'policy_1',
            rules: [
              {
                id: 'rule_1',
                name: '差旅发票必填',
                expenseTypeCode: 'TRAVEL',
                maxAmountCents: null,
                requiresInvoice: true,
                requiresPreApproval: false,
                action: ExpensePolicyAction.BLOCK,
              },
            ],
          },
        ]),
      },
      expensePolicyCheck: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new ExpensePoliciesService({} as never);

    const findings = await service.evaluateAndStore(tx as never, 'report_1');

    expect(findings).toEqual([
      expect.objectContaining({
        result: ExpensePolicyCheckResult.BLOCK,
        message: '差旅费 命中「差旅发票必填」：发票价税合计 80 元小于费用金额 100 元',
      }),
    ]);
  });
});
