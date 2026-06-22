import { ExpensePolicyAction, ExpensePolicyCheckResult, ExpensePolicyStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticatedUser } from '../identity/identity.types';
import { ExpensePoliciesService } from './expense-policies.service';

const policyUser: AuthenticatedUser = {
  id: 'policy_admin',
  employeeNo: 'POL001',
  email: 'policy@expenseflow.local',
  name: 'Policy Admin',
  departmentId: null,
  costCenterId: null,
  roles: [{ code: 'ADMIN', name: 'Admin' }],
  permissions: ['exp:policy:read', 'exp:policy:write'],
};

describe('ExpensePoliciesService', () => {
  it('records expense policy rule creation audit', async () => {
    const rule = {
      id: 'rule_1',
      code: 'TRAVEL_LIMIT',
      name: 'Travel limit',
      description: null,
      expenseTypeCode: 'TRAVEL',
      city: null,
      jobLevel: null,
      maxAmountCents: 100000,
      requiresInvoice: true,
      requiresPreApproval: false,
      action: ExpensePolicyAction.BLOCK,
      status: ExpensePolicyStatus.ACTIVE,
      createdAt: new Date('2026-06-22T00:00:00.000Z'),
    };
    const prisma = {
      expensePolicy: { findFirst: vi.fn().mockResolvedValue({ id: 'policy_1', rules: [] }) },
      expenseType: { findFirst: vi.fn().mockResolvedValue({ id: 'type_1' }) },
      $transaction: (callback: (client: { expensePolicyRule: { create: ReturnType<typeof vi.fn> } }) => unknown) =>
        callback({ expensePolicyRule: { create: vi.fn().mockResolvedValue(rule) } }),
    };
    const audit = { recordWithClient: vi.fn().mockResolvedValue({ id: 'audit_1' }) };
    const service = new ExpensePoliciesService(prisma as never, audit as never);

    await expect(
      service.createRule(policyUser, 'policy_1', {
        code: 'TRAVEL_LIMIT',
        name: 'Travel limit',
        expenseTypeCode: 'TRAVEL',
        maxAmountCents: 100000,
        requiresInvoice: true,
        action: ExpensePolicyAction.BLOCK,
      }),
    ).resolves.toEqual(rule);
    expect(audit.recordWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        operator: policyUser,
        action: 'POLICY_RULE_CREATE',
        entityType: 'expense-policy-rule',
        entityId: 'rule_1',
        after: expect.objectContaining({ policyId: 'policy_1', maxAmountCents: 100000, requiresInvoice: true }),
      }),
    );
  });

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
