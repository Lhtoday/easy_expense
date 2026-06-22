import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApprovalFlowConfigStatus, ExpenseAttachmentCategory, ExpenseReportStatus } from '@prisma/client';
import { Readable } from 'stream';
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
  permissions: ['exp:report:read', 'exp:report:write', 'exp:report:withdraw', 'exp:attachment:read', 'exp:attachment:write', 'exp:invoice:write'],
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

  it('creates an approval task when submitting a valid draft', async () => {
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'report_1',
          status: ExpenseReportStatus.DRAFT,
          currency: 'CNY',
          departmentId: null,
          costCenterId: null,
          reimbursableCents: 12050,
        }),
        update: vi.fn().mockResolvedValue({ id: 'report_1', status: ExpenseReportStatus.SUBMITTED }),
        findUnique: vi.fn().mockResolvedValue({ id: 'report_1', status: ExpenseReportStatus.SUBMITTED }),
      },
      expenseReportItem: { count: vi.fn().mockResolvedValue(1) },
      expenseApprovalFlowConfig: {
        findFirst: vi.fn().mockResolvedValue({ id: 'flow_1', approverRoleCode: 'ADMIN' }),
      },
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'approver_1' }) },
      expenseApprovalInstance: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'instance_1', tasks: [{ id: 'task_1' }] }),
      },
      expenseApprovalLog: { create: vi.fn().mockResolvedValue({ id: 'log_1' }) },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new ExpenseReportsService(prisma as never);

    await expect(service.submit(user, 'report_1')).resolves.toEqual({ id: 'report_1', status: ExpenseReportStatus.SUBMITTED });
    expect(tx.expenseApprovalFlowConfig.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: ApprovalFlowConfigStatus.ACTIVE }) }),
    );
    expect(tx.expenseApprovalInstance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportId: 'report_1',
          tasks: { create: expect.objectContaining({ nodeCode: 'MANAGER_APPROVAL', assigneeId: 'approver_1' }) },
        }),
      }),
    );
  });

  it('allows rejected reports to be submitted again with a new approval task', async () => {
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'report_1',
          status: ExpenseReportStatus.REJECTED,
          currency: 'CNY',
          departmentId: null,
          costCenterId: null,
          reimbursableCents: 12050,
        }),
        update: vi.fn().mockResolvedValue({ id: 'report_1', status: ExpenseReportStatus.SUBMITTED }),
        findUnique: vi.fn().mockResolvedValue({ id: 'report_1', status: ExpenseReportStatus.SUBMITTED }),
      },
      expenseReportItem: { count: vi.fn().mockResolvedValue(1) },
      expenseApprovalFlowConfig: {
        findFirst: vi.fn().mockResolvedValue({ id: 'flow_1', approverRoleCode: 'ADMIN' }),
      },
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'approver_1' }) },
      expenseApprovalInstance: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'instance_2', tasks: [{ id: 'task_2' }] }),
      },
      expenseApprovalLog: { create: vi.fn().mockResolvedValue({ id: 'log_2' }) },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new ExpenseReportsService(prisma as never);

    await expect(service.submit(user, 'report_1', '修改后重新提交')).resolves.toEqual({ id: 'report_1', status: ExpenseReportStatus.SUBMITTED });
    expect(tx.expenseReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          logs: expect.objectContaining({
            create: expect.objectContaining({
              fromStatus: ExpenseReportStatus.REJECTED,
              toStatus: ExpenseReportStatus.SUBMITTED,
            }),
          }),
        }),
      }),
    );
    expect(tx.expenseApprovalInstance.create).toHaveBeenCalled();
  });

  it('blocks resubmitting a report that already has an approved approval instance', async () => {
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'report_1',
          status: ExpenseReportStatus.REJECTED,
          currency: 'CNY',
          departmentId: null,
          costCenterId: null,
          reimbursableCents: 12050,
        }),
        update: vi.fn().mockResolvedValue({ id: 'report_1', status: ExpenseReportStatus.SUBMITTED }),
      },
      expenseReportItem: { count: vi.fn().mockResolvedValue(1) },
      expenseApprovalInstance: {
        findFirst: vi.fn().mockResolvedValue({ id: 'instance_approved' }),
      },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new ExpenseReportsService(prisma as never);

    await expect(service.submit(user, 'report_1')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.expenseApprovalInstance.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reportId: 'report_1', status: 'APPROVED' },
      }),
    );
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
      expenseApprovalInstance: {
        findFirst: vi.fn().mockResolvedValue({ id: 'instance_1', tasks: [{ id: 'task_1' }] }),
        update: vi.fn().mockResolvedValue({ id: 'instance_1' }),
      },
      expenseApprovalTask: {
        update: vi.fn().mockResolvedValue({ id: 'task_1' }),
      },
      expenseApprovalLog: {
        create: vi.fn().mockResolvedValue({ id: 'approval_log_1' }),
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
    expect(tx.expenseApprovalTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task_1' },
        data: expect.objectContaining({ status: 'WITHDRAWN', comment: '填错金额' }),
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

  it('uploads an attachment to storage before writing metadata', async () => {
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'report_1',
          status: ExpenseReportStatus.DRAFT,
          currency: 'CNY',
          departmentId: null,
          costCenterId: null,
          reimbursableCents: 12050,
        }),
      },
      expenseAttachment: {
        create: vi.fn().mockResolvedValue({ id: 'att_1', fileName: 'invoice.pdf' }),
      },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const storage = {
      putExpenseAttachment: vi.fn().mockResolvedValue({ storageBucket: 'expenseflow-files', storageKey: 'expense-reports/report_1/invoice.pdf' }),
    };
    const service = new ExpenseReportsService(prisma as never, storage as never);

    await expect(
      service.uploadAttachment(
        user,
        'report_1',
        {
          originalname: 'invoice.pdf',
          mimetype: 'application/pdf',
          size: 5,
          buffer: Buffer.from('hello'),
        },
        { category: ExpenseAttachmentCategory.INVOICE_IMAGE },
      ),
    ).resolves.toEqual({ id: 'att_1', fileName: 'invoice.pdf' });
    expect(storage.putExpenseAttachment).toHaveBeenCalledWith(
      'report_1',
      expect.objectContaining({ originalname: 'invoice.pdf', mimetype: 'application/pdf', buffer: Buffer.from('hello') }),
    );
    expect(tx.expenseAttachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storageBucket: 'expenseflow-files',
          storageKey: 'expense-reports/report_1/invoice.pdf',
          category: 'INVOICE_IMAGE',
          uploadedById: user.id,
        }),
      }),
    );
  });

  it('blocks opening attachments without attachment read permission', async () => {
    const service = new ExpenseReportsService({} as never, {} as never);
    await expect(service.openAttachment({ ...user, permissions: ['exp:report:read'] }, 'report_1', 'att_1', 'DOWNLOAD')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('records attachment download access audit', async () => {
    const prisma = {
      expenseAttachment: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'att_1',
          fileName: 'invoice.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 5,
          storageBucket: 'expenseflow-files',
          storageKey: 'expense-reports/report_1/invoice.pdf',
          category: ExpenseAttachmentCategory.INVOICE_IMAGE,
        }),
      },
    };
    const storage = { getObject: vi.fn().mockResolvedValue({ stream: Readable.from(['hello']) }) };
    const audit = { record: vi.fn().mockResolvedValue({ id: 'audit_1' }) };
    const service = new ExpenseReportsService(prisma as never, storage as never, undefined, undefined, audit as never);

    await expect(service.openAttachment(user, 'report_1', 'att_1', 'DOWNLOAD')).resolves.toMatchObject({
      attachment: { id: 'att_1', fileName: 'invoice.pdf' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        operator: user,
        action: 'ATTACHMENT_DOWNLOAD',
        entityType: 'expense-attachment',
        entityId: 'att_1',
        metadata: expect.objectContaining({ reportId: 'report_1', category: ExpenseAttachmentCategory.INVOICE_IMAGE }),
      }),
    );
  });

  it('marks invoice metadata as duplicate when key fields already exist', async () => {
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'report_1',
          status: ExpenseReportStatus.DRAFT,
          currency: 'CNY',
          departmentId: null,
          costCenterId: null,
          reimbursableCents: 12050,
        }),
      },
      expenseInvoice: {
        findFirst: vi.fn().mockResolvedValue({ id: 'invoice_0' }),
        create: vi.fn().mockResolvedValue({ id: 'invoice_1', duplicateStatus: 'DUPLICATE', duplicateOfId: 'invoice_0' }),
      },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new ExpenseReportsService(prisma as never);

    await expect(
      service.registerInvoice(user, 'report_1', {
        invoiceCode: '044001900111',
        invoiceNo: '12345678',
        issuedAt: '2026-06-04',
        sellerName: '测试供应商',
        amountCents: 10000,
        taxAmountCents: 600,
        deductibleTaxCents: 600,
        totalAmountCents: 10600,
      }),
    ).resolves.toEqual({ id: 'invoice_1', duplicateStatus: 'DUPLICATE', duplicateOfId: 'invoice_0' });
    expect(tx.expenseInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          duplicateStatus: 'DUPLICATE',
          duplicateOfId: 'invoice_0',
        }),
      }),
    );
  });

  it('updates invoice metadata and ignores itself in duplicate check', async () => {
    const tx = {
      expenseReport: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'report_1',
          status: ExpenseReportStatus.DRAFT,
          currency: 'CNY',
          departmentId: null,
          costCenterId: null,
          reimbursableCents: 12050,
        }),
      },
      expenseInvoice: {
        findFirst: vi.fn().mockResolvedValueOnce({ id: 'invoice_1' }).mockResolvedValueOnce(null),
        update: vi.fn().mockResolvedValue({ id: 'invoice_1', invoiceNo: '87654321', duplicateStatus: 'UNIQUE' }),
      },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const service = new ExpenseReportsService(prisma as never);

    await expect(
      service.updateInvoice(user, 'report_1', 'invoice_1', {
        invoiceNo: '87654321',
        issuedAt: '2026-06-04',
        sellerName: '测试供应商',
        amountCents: 10000,
        taxAmountCents: 600,
        deductibleTaxCents: 600,
        totalAmountCents: 10600,
      }),
    ).resolves.toEqual({ id: 'invoice_1', invoiceNo: '87654321', duplicateStatus: 'UNIQUE' });
    expect(tx.expenseInvoice.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: 'invoice_1' } }),
      }),
    );
    expect(tx.expenseInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'invoice_1' },
        data: expect.objectContaining({ invoiceNo: '87654321', duplicateStatus: 'UNIQUE' }),
      }),
    );
  });

  it('rejects invoice totals that do not equal amount plus tax', async () => {
    const service = new ExpenseReportsService({} as never);

    await expect(
      service.registerInvoice(user, 'report_1', {
        invoiceNo: '12345678',
        issuedAt: '2026-06-04',
        sellerName: '测试供应商',
        amountCents: 10000,
        taxAmountCents: 600,
        deductibleTaxCents: 600,
        totalAmountCents: 10000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
