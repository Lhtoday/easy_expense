import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  ApprovalAction,
  ApprovalFlowConfigStatus,
  ApprovalInstanceStatus,
  ApprovalTaskStatus,
  ExpenseAttachmentCategory,
  ExpenseReportAction,
  ExpenseReportStatus,
  InvoiceDuplicateStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { BudgetsService } from '../budgets/budgets.service';
import { ExpensePoliciesService } from '../expense-policies/expense-policies.service';
import { AuthenticatedUser } from '../identity/identity.types';
import { PrismaService } from '../prisma/prisma.service';
import { PageResult } from '../shared/api-response';
import { MinioStorageService } from '../storage/minio-storage.service';
import {
  ExpenseReportItemDto,
  ExpenseReportListQueryDto,
  RegisterExpenseAttachmentDto,
  RegisterExpenseInvoiceDto,
  SaveExpenseReportDto,
  UploadExpenseAttachmentDto,
} from './expense-report.dto';

@Injectable()
export class ExpenseReportsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly storage?: MinioStorageService,
    @Optional() private readonly expensePolicies?: ExpensePoliciesService,
    @Optional() private readonly budgets?: BudgetsService,
  ) {}

  async list(user: AuthenticatedUser, query: ExpenseReportListQueryDto): Promise<PageResult<unknown>> {
    this.ensurePermission(user, 'exp:report:read');
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ExpenseReportWhereInput = {
      deletedAt: null,
      status: query.status,
      OR: query.keyword
        ? [{ reportNo: { contains: query.keyword, mode: 'insensitive' } }, { title: { contains: query.keyword, mode: 'insensitive' } }]
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.expenseReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.listSelect(),
      }),
      this.prisma.expenseReport.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async detail(user: AuthenticatedUser, id: string) {
    this.ensurePermission(user, 'exp:report:read');
    const report = await this.prisma.expenseReport.findFirst({
      where: { id, deletedAt: null },
      select: this.detailSelect(),
    });

    if (!report) {
      throw new NotFoundException('报销单不存在');
    }

    return report;
  }

  async create(user: AuthenticatedUser, dto: SaveExpenseReportDto) {
    this.ensurePermission(user, 'exp:report:write');
    this.validateDraft(dto.items);

    return this.prisma.$transaction(async (tx) => {
      const reportNo = await this.nextReportNo(tx);
      const totals = this.calculateTotals(dto.items);
      const report = await tx.expenseReport.create({
        data: {
          reportNo,
          title: dto.title,
          applicantId: user.id,
          departmentId: dto.departmentId ?? user.departmentId,
          costCenterId: dto.costCenterId ?? user.costCenterId,
          projectId: dto.projectId,
          currency: dto.currency ?? 'CNY',
          updatedById: user.id,
          ...totals,
          items: { create: dto.items.map((item) => this.toItemCreate(item, dto)) },
          logs: {
            create: {
              operatorId: user.id,
              action: ExpenseReportAction.CREATE,
              toStatus: ExpenseReportStatus.DRAFT,
              comment: '保存草稿',
            },
          },
        },
        select: this.detailSelect(),
      });
      return report;
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: SaveExpenseReportDto) {
    this.ensurePermission(user, 'exp:report:write');
    this.validateDraft(dto.items);

    return this.prisma.$transaction(async (tx) => {
      const existing = await this.ensureEditable(tx, id);
      const totals = this.calculateTotals(dto.items);
      await tx.expenseReportItem.deleteMany({ where: { reportId: id } });

      return tx.expenseReport.update({
        where: { id },
        data: {
          title: dto.title,
          departmentId: dto.departmentId ?? existing.departmentId,
          costCenterId: dto.costCenterId ?? existing.costCenterId,
          projectId: dto.projectId,
          currency: dto.currency ?? existing.currency,
          updatedById: user.id,
          ...totals,
          items: { create: dto.items.map((item) => this.toItemCreate(item, dto)) },
          logs: {
            create: {
              operatorId: user.id,
              action: ExpenseReportAction.UPDATE,
              fromStatus: existing.status,
              toStatus: existing.status,
              comment: '更新草稿',
            },
          },
        },
        select: this.detailSelect(),
      });
    });
  }

  async submit(user: AuthenticatedUser, id: string, comment?: string) {
    this.ensurePermission(user, 'exp:report:write');

    return this.prisma.$transaction(async (tx) => {
      const existing = await this.ensureEditable(tx, id);
      const itemCount = await tx.expenseReportItem.count({ where: { reportId: id } });
      if (itemCount < 1 || existing.reimbursableCents <= 0) {
        throw new BadRequestException('提交前至少需要一条可报销金额大于 0 的明细');
      }

      const policyFindings = this.expensePolicies ? await this.expensePolicies.evaluateAndStore(tx, id) : [];
      if (this.expensePolicies?.hasBlockingFinding(policyFindings)) {
        throw new BadRequestException(this.expensePolicies.blockingMessage(policyFindings));
      }
      if (this.budgets) {
        await this.budgets.occupyOnSubmit(tx, id, user.id);
      }

      const report = await tx.expenseReport.update({
        where: { id },
        data: {
          status: ExpenseReportStatus.SUBMITTED,
          submittedAt: new Date(),
          updatedById: user.id,
          logs: {
            create: {
              operatorId: user.id,
              action: ExpenseReportAction.SUBMIT,
              fromStatus: existing.status,
              toStatus: ExpenseReportStatus.SUBMITTED,
              comment,
            },
          },
        },
        select: this.detailSelect(),
      });
      await this.createApprovalInstance(tx, report.id, user, this.expensePolicies?.requiresEscalation(policyFindings) ?? false, existing.status);
      return tx.expenseReport.findUnique({ where: { id }, select: this.detailSelect() });
    });
  }

  async void(user: AuthenticatedUser, id: string) {
    this.ensurePermission(user, 'exp:report:write');

    return this.prisma.$transaction(async (tx) => {
      const existing = await this.ensureEditable(tx, id);
      if (this.budgets) {
        await this.budgets.releaseReport(tx, id, user.id, '作废报销单释放预算占用');
      }
      return tx.expenseReport.update({
        where: { id },
        data: {
          status: ExpenseReportStatus.VOIDED,
          deletedAt: new Date(),
          updatedById: user.id,
          logs: {
            create: {
              operatorId: user.id,
              action: ExpenseReportAction.VOID,
              fromStatus: existing.status,
              toStatus: ExpenseReportStatus.VOIDED,
              comment: '作废草稿并释放后续预算占用入口',
            },
          },
        },
        select: this.detailSelect(),
      });
    });
  }

  async withdraw(user: AuthenticatedUser, id: string, comment?: string) {
    this.ensurePermission(user, 'exp:report:withdraw');

    return this.prisma.$transaction(async (tx) => {
      const existing = await this.ensureWithdrawable(tx, id, user);
      await this.withdrawPendingApproval(tx, id, user.id, comment ?? '申请人撤回报销单');
      if (this.budgets) {
        await this.budgets.releaseReport(tx, id, user.id, comment ?? '撤回报销单释放预算占用');
      }
      return tx.expenseReport.update({
        where: { id },
        data: {
          status: ExpenseReportStatus.DRAFT,
          updatedById: user.id,
          logs: {
            create: {
              operatorId: user.id,
              action: ExpenseReportAction.WITHDRAW,
              fromStatus: existing.status,
              toStatus: ExpenseReportStatus.DRAFT,
              comment: comment ?? '申请人撤回报销单',
            },
          },
        },
        select: this.detailSelect(),
      });
    });
  }

  async registerAttachment(user: AuthenticatedUser, reportId: string, dto: RegisterExpenseAttachmentDto) {
    this.ensurePermission(user, 'exp:attachment:write');

    return this.prisma.$transaction(async (tx) => {
      await this.ensureEditable(tx, reportId);
      return tx.expenseAttachment.create({
        data: {
          reportId,
          fileName: dto.fileName,
          mimeType: dto.mimeType,
          sizeBytes: dto.sizeBytes,
          storageBucket: dto.storageBucket,
          storageKey: dto.storageKey,
          category: dto.category ?? ExpenseAttachmentCategory.GENERAL,
          uploadedById: user.id,
        },
        select: this.attachmentSelect(),
      });
    });
  }

  async uploadAttachment(
    user: AuthenticatedUser,
    reportId: string,
    file: { originalname: string; mimetype: string; size: number; buffer?: Buffer },
    dto: UploadExpenseAttachmentDto,
  ) {
    this.ensurePermission(user, 'exp:attachment:write');
    if (!file?.buffer?.length) {
      throw new BadRequestException('附件文件不能为空');
    }
    const storage = this.storage;
    const buffer = file.buffer;
    if (!storage) {
      throw new BadRequestException('文件存储服务未配置');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.ensureEditable(tx, reportId);
      const stored = await this.runStorageOperation(() =>
        storage.putExpenseAttachment(reportId, {
          originalname: file.originalname,
          mimetype: file.mimetype,
          buffer,
        }),
      );
      return tx.expenseAttachment.create({
        data: {
          reportId,
          fileName: file.originalname,
          mimeType: file.mimetype || 'application/octet-stream',
          sizeBytes: file.size,
          storageBucket: stored.storageBucket,
          storageKey: stored.storageKey,
          category: dto.category ?? ExpenseAttachmentCategory.GENERAL,
          uploadedById: user.id,
        },
        select: this.attachmentSelect(),
      });
    });
  }

  async removeAttachment(user: AuthenticatedUser, reportId: string, attachmentId: string) {
    this.ensurePermission(user, 'exp:attachment:write');

    return this.prisma.$transaction(async (tx) => {
      await this.ensureEditable(tx, reportId);
      const attachment = await tx.expenseAttachment.findFirst({ where: { id: attachmentId, reportId, deletedAt: null }, select: { id: true } });
      if (!attachment) {
        throw new NotFoundException('附件不存在');
      }
      return tx.expenseAttachment.update({
        where: { id: attachmentId },
        data: { deletedAt: new Date() },
        select: this.attachmentSelect(),
      });
    });
  }

  async openAttachment(user: AuthenticatedUser, reportId: string, attachmentId: string) {
    this.ensurePermission(user, 'exp:attachment:read');
    if (!this.storage) {
      throw new BadRequestException('文件存储服务未配置');
    }

    const attachment = await this.prisma.expenseAttachment.findFirst({
      where: { id: attachmentId, reportId, deletedAt: null, report: { deletedAt: null } },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        storageBucket: true,
        storageKey: true,
      },
    });
    if (!attachment) {
      throw new NotFoundException('附件不存在');
    }

    const object = await this.runStorageOperation(() => this.storage!.getObject(attachment.storageBucket, attachment.storageKey));
    return { attachment, stream: object.stream };
  }

  async registerInvoice(user: AuthenticatedUser, reportId: string, dto: RegisterExpenseInvoiceDto) {
    this.ensurePermission(user, 'exp:invoice:write');
    this.validateInvoice(dto);

    return this.prisma.$transaction(async (tx) => {
      const report = await this.ensureEditable(tx, reportId);
      if (dto.itemId) {
        const item = await tx.expenseReportItem.findFirst({ where: { id: dto.itemId, reportId }, select: { id: true } });
        if (!item) {
          throw new BadRequestException('发票关联的报销明细不存在');
        }
      }

      const duplicate = await tx.expenseInvoice.findFirst({
        where: {
          deletedAt: null,
          invoiceCode: dto.invoiceCode ?? null,
          invoiceNo: dto.invoiceNo,
          issuedAt: new Date(dto.issuedAt),
          totalAmountCents: dto.totalAmountCents,
          sellerName: dto.sellerName,
        },
        select: { id: true },
      });

      const invoice = await tx.expenseInvoice.create({
        data: {
          reportId,
          itemId: dto.itemId,
          invoiceCode: dto.invoiceCode,
          invoiceNo: dto.invoiceNo,
          issuedAt: new Date(dto.issuedAt),
          sellerName: dto.sellerName,
          sellerTaxNo: dto.sellerTaxNo,
          buyerName: dto.buyerName,
          buyerTaxNo: dto.buyerTaxNo,
          amountCents: dto.amountCents,
          taxAmountCents: dto.taxAmountCents,
          deductibleTaxCents: dto.deductibleTaxCents,
          totalAmountCents: dto.totalAmountCents,
          currency: dto.currency ?? report.currency,
          duplicateStatus: duplicate ? InvoiceDuplicateStatus.DUPLICATE : InvoiceDuplicateStatus.UNIQUE,
          duplicateOfId: duplicate?.id,
          createdById: user.id,
        },
        select: this.invoiceSelect(),
      });
      if (this.expensePolicies) {
        await this.expensePolicies.evaluateAndStore(tx, reportId);
      }
      return invoice;
    });
  }

  async removeInvoice(user: AuthenticatedUser, reportId: string, invoiceId: string) {
    this.ensurePermission(user, 'exp:invoice:write');

    return this.prisma.$transaction(async (tx) => {
      await this.ensureEditable(tx, reportId);
      const invoice = await tx.expenseInvoice.findFirst({ where: { id: invoiceId, reportId, deletedAt: null }, select: { id: true } });
      if (!invoice) {
        throw new NotFoundException('发票不存在');
      }
      return tx.expenseInvoice.update({
        where: { id: invoiceId },
        data: { deletedAt: new Date() },
        select: this.invoiceSelect(),
      });
    });
  }

  async updateInvoice(user: AuthenticatedUser, reportId: string, invoiceId: string, dto: RegisterExpenseInvoiceDto) {
    this.ensurePermission(user, 'exp:invoice:write');
    this.validateInvoice(dto);

    return this.prisma.$transaction(async (tx) => {
      const report = await this.ensureEditable(tx, reportId);
      const existing = await tx.expenseInvoice.findFirst({ where: { id: invoiceId, reportId, deletedAt: null }, select: { id: true } });
      if (!existing) {
        throw new NotFoundException('发票不存在');
      }
      if (dto.itemId) {
        const item = await tx.expenseReportItem.findFirst({ where: { id: dto.itemId, reportId }, select: { id: true } });
        if (!item) {
          throw new BadRequestException('发票关联的报销明细不存在');
        }
      }

      const duplicate = await tx.expenseInvoice.findFirst({
        where: {
          id: { not: invoiceId },
          deletedAt: null,
          invoiceCode: dto.invoiceCode ?? null,
          invoiceNo: dto.invoiceNo,
          issuedAt: new Date(dto.issuedAt),
          totalAmountCents: dto.totalAmountCents,
          sellerName: dto.sellerName,
        },
        select: { id: true },
      });

      const invoice = await tx.expenseInvoice.update({
        where: { id: invoiceId },
        data: {
          itemId: dto.itemId,
          invoiceCode: dto.invoiceCode,
          invoiceNo: dto.invoiceNo,
          issuedAt: new Date(dto.issuedAt),
          sellerName: dto.sellerName,
          sellerTaxNo: dto.sellerTaxNo,
          buyerName: dto.buyerName,
          buyerTaxNo: dto.buyerTaxNo,
          amountCents: dto.amountCents,
          taxAmountCents: dto.taxAmountCents,
          deductibleTaxCents: dto.deductibleTaxCents,
          totalAmountCents: dto.totalAmountCents,
          currency: dto.currency ?? report.currency,
          duplicateStatus: duplicate ? InvoiceDuplicateStatus.DUPLICATE : InvoiceDuplicateStatus.UNIQUE,
          duplicateOfId: duplicate?.id,
        },
        select: this.invoiceSelect(),
      });
      if (this.expensePolicies) {
        await this.expensePolicies.evaluateAndStore(tx, reportId);
      }
      return invoice;
    });
  }

  private ensurePermission(user: AuthenticatedUser, permission: string) {
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenException('缺少报销单操作权限');
    }
  }

  private validateDraft(items: ExpenseReportItemDto[]) {
    items.forEach((item, index) => {
      if (item.deductibleTaxCents > item.taxAmountCents) {
        throw new BadRequestException(`第 ${index + 1} 行可抵扣税额不能大于税额`);
      }
      if (item.reimbursableCents > item.amountCents) {
        throw new BadRequestException(`第 ${index + 1} 行可报销金额不能大于费用金额`);
      }
    });
  }

  private validateInvoice(invoice: RegisterExpenseInvoiceDto) {
    if (invoice.deductibleTaxCents > invoice.taxAmountCents) {
      throw new BadRequestException('发票可抵扣税额不能大于税额');
    }
    if (invoice.amountCents + invoice.taxAmountCents !== invoice.totalAmountCents) {
      throw new BadRequestException('发票价税合计必须等于金额加税额');
    }
  }

  private async runStorageOperation<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch {
      throw new BadRequestException('文件存储服务不可用，请确认 MinIO 已启动');
    }
  }

  private calculateTotals(items: ExpenseReportItemDto[]) {
    return items.reduce(
      (totals, item) => ({
        amountCents: totals.amountCents + item.amountCents,
        taxAmountCents: totals.taxAmountCents + item.taxAmountCents,
        deductibleTaxCents: totals.deductibleTaxCents + item.deductibleTaxCents,
        reimbursableCents: totals.reimbursableCents + item.reimbursableCents,
      }),
      { amountCents: 0, taxAmountCents: 0, deductibleTaxCents: 0, reimbursableCents: 0 },
    );
  }

  private toItemCreate(item: ExpenseReportItemDto, report: SaveExpenseReportDto) {
    const departmentId = item.departmentId ?? report.departmentId;
    const costCenterId = item.costCenterId ?? report.costCenterId;
    const projectId = item.projectId ?? report.projectId;

    return {
      occurredAt: new Date(item.occurredAt),
      expenseTypeCode: item.expenseTypeCode,
      accountSubjectCode: item.accountSubjectCode,
      description: item.description,
      department: departmentId ? { connect: { id: departmentId } } : undefined,
      costCenter: costCenterId ? { connect: { id: costCenterId } } : undefined,
      project: projectId ? { connect: { id: projectId } } : undefined,
      amountCents: item.amountCents,
      taxAmountCents: item.taxAmountCents,
      deductibleTaxCents: item.deductibleTaxCents,
      reimbursableCents: item.reimbursableCents,
    } satisfies Prisma.ExpenseReportItemCreateWithoutReportInput;
  }

  private async ensureEditable(tx: Prisma.TransactionClient, id: string) {
    const report = await tx.expenseReport.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true, currency: true, departmentId: true, costCenterId: true, reimbursableCents: true },
    });

    if (!report) {
      throw new NotFoundException('报销单不存在');
    }
    if (report.status !== ExpenseReportStatus.DRAFT && report.status !== ExpenseReportStatus.REJECTED && report.status !== ExpenseReportStatus.FINANCE_REJECTED) {
      throw new BadRequestException('只有草稿或已驳回状态的报销单可以编辑或提交');
    }

    return report;
  }

  private async createApprovalInstance(
    tx: Prisma.TransactionClient,
    reportId: string,
    user: AuthenticatedUser,
    escalated: boolean,
    previousStatus: ExpenseReportStatus,
  ) {
    const approvedInstance = await tx.expenseApprovalInstance.findFirst({
      where: { reportId, status: ApprovalInstanceStatus.APPROVED },
      select: { id: true },
    });
    if (approvedInstance && previousStatus !== ExpenseReportStatus.FINANCE_REJECTED) {
      throw new BadRequestException('该报销单已存在通过的审批记录，不能重新提交生成新的审批任务');
    }

    const flowCode = escalated ? 'ESCALATED_EXPENSE_APPROVAL' : 'DEFAULT_EXPENSE_APPROVAL';
    const flow = await tx.expenseApprovalFlowConfig.findFirst({
      where: { code: flowCode, status: ApprovalFlowConfigStatus.ACTIVE },
      select: { id: true, approverRoleCode: true },
    });
    if (!flow) {
      throw new BadRequestException('未配置可用的报销审批流');
    }

    const assignee = await tx.user.findFirst({
      where: {
        deletedAt: null,
        status: UserStatus.ACTIVE,
        roles: { some: { role: { code: flow.approverRoleCode, status: 'ACTIVE', deletedAt: null } } },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!assignee) {
      throw new BadRequestException('未找到可用的报销审批人');
    }

    const instance = await tx.expenseApprovalInstance.create({
      data: {
        reportId,
        flowConfigId: flow.id,
        startedById: user.id,
        tasks: {
          create: {
            reportId,
            nodeCode: escalated ? 'POLICY_ESCALATION_APPROVAL' : 'MANAGER_APPROVAL',
            nodeName: '主管审批',
            assigneeId: assignee.id,
          },
        },
      },
      select: { id: true, tasks: { select: { id: true } } },
    });
    await tx.expenseApprovalLog.create({
      data: {
        instanceId: instance.id,
        taskId: instance.tasks[0]?.id,
        operatorId: user.id,
        action: ApprovalAction.CREATE,
        toStatus: ApprovalTaskStatus.PENDING,
        comment: '提交后创建主管审批任务',
      },
    });
  }

  private async withdrawPendingApproval(tx: Prisma.TransactionClient, reportId: string, operatorId: string, comment: string) {
    const instance = await tx.expenseApprovalInstance.findFirst({
      where: { reportId, status: ApprovalInstanceStatus.IN_PROGRESS },
      select: {
        id: true,
        tasks: {
          where: { status: ApprovalTaskStatus.PENDING },
          select: { id: true },
        },
      },
    });

    if (!instance) {
      return;
    }
    if (instance.tasks.length !== 1) {
      throw new BadRequestException('审批已处理，不能撤回到草稿');
    }

    const taskId = instance.tasks[0].id;
    await tx.expenseApprovalTask.update({
      where: { id: taskId },
      data: { status: ApprovalTaskStatus.WITHDRAWN, comment, completedAt: new Date() },
    });
    await tx.expenseApprovalInstance.update({
      where: { id: instance.id },
      data: { status: ApprovalInstanceStatus.WITHDRAWN, completedAt: new Date() },
    });
    await tx.expenseApprovalLog.create({
      data: {
        instanceId: instance.id,
        taskId,
        operatorId,
        action: ApprovalAction.WITHDRAW,
        fromStatus: ApprovalTaskStatus.PENDING,
        toStatus: ApprovalTaskStatus.WITHDRAWN,
        comment,
      },
    });
  }

  private async ensureWithdrawable(tx: Prisma.TransactionClient, id: string, user: AuthenticatedUser) {
    const report = await tx.expenseReport.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true, applicantId: true },
    });

    if (!report) {
      throw new NotFoundException('报销单不存在');
    }
    if (report.applicantId !== user.id) {
      throw new ForbiddenException('只能撤回本人提交的报销单');
    }
    if (report.status !== ExpenseReportStatus.SUBMITTED) {
      throw new BadRequestException('只有已提交且尚未进入审批处理的报销单可以撤回');
    }

    return report;
  }

  private async nextReportNo(tx: Prisma.TransactionClient) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const prefix = `EXP${year}${month}${day}`;
    const count = await tx.expenseReport.count({ where: { reportNo: { startsWith: prefix } } });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private listSelect() {
    return {
      id: true,
      reportNo: true,
      title: true,
      status: true,
      currency: true,
      amountCents: true,
      taxAmountCents: true,
      deductibleTaxCents: true,
      reimbursableCents: true,
      paidAmountCents: true,
      submittedAt: true,
      createdAt: true,
      applicant: { select: { id: true, name: true, employeeNo: true } },
      department: { select: { id: true, name: true, code: true } },
      costCenter: { select: { id: true, name: true, code: true } },
      project: { select: { id: true, name: true, code: true } },
    } satisfies Prisma.ExpenseReportSelect;
  }

  private detailSelect() {
    return {
      ...this.listSelect(),
      departmentId: true,
      costCenterId: true,
      projectId: true,
      items: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          occurredAt: true,
          expenseTypeCode: true,
          accountSubjectCode: true,
          description: true,
          departmentId: true,
          costCenterId: true,
          projectId: true,
          amountCents: true,
          taxAmountCents: true,
          deductibleTaxCents: true,
          reimbursableCents: true,
        },
      },
      logs: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          action: true,
          fromStatus: true,
          toStatus: true,
          comment: true,
          createdAt: true,
          operator: { select: { id: true, name: true } },
        },
      },
      attachments: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: this.attachmentSelect(),
      },
      invoices: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: this.invoiceSelect(),
      },
      approvalInstances: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          flowConfig: { select: { code: true, name: true } },
          tasks: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              nodeCode: true,
              nodeName: true,
              status: true,
              comment: true,
              createdAt: true,
              completedAt: true,
              assignee: { select: { id: true, name: true } },
            },
          },
          logs: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              action: true,
              fromStatus: true,
              toStatus: true,
              comment: true,
              createdAt: true,
              operator: { select: { id: true, name: true } },
            },
          },
        },
      },
      policyChecks: {
        orderBy: [{ result: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          itemId: true,
          result: true,
          message: true,
          createdAt: true,
          policy: { select: { id: true, code: true, name: true } },
          rule: { select: { id: true, code: true, name: true, action: true } },
        },
      },
      budgetChecks: {
        orderBy: [{ result: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          itemId: true,
          result: true,
          message: true,
          createdAt: true,
          budget: { select: { id: true, code: true, name: true } },
        },
      },
      budgetOccupations: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          itemId: true,
          status: true,
          fiscalPeriod: true,
          occupiedCents: true,
          approvedCents: true,
          actualCents: true,
          releasedCents: true,
          budget: { select: { id: true, code: true, name: true } },
        },
      },
      financeReviews: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          action: true,
          fromStatus: true,
          toStatus: true,
          comment: true,
          createdAt: true,
          operator: { select: { id: true, name: true } },
        },
      },
      payments: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          status: true,
          method: true,
          amountCents: true,
          currency: true,
          paidAt: true,
          paymentReference: true,
          payerAccount: true,
          payeeAccount: true,
          failureReason: true,
          comment: true,
          fromStatus: true,
          toStatus: true,
          createdAt: true,
          batch: { select: { id: true, batchNo: true, status: true } },
          operator: { select: { id: true, name: true } },
        },
      },
    } satisfies Prisma.ExpenseReportSelect;
  }

  private attachmentSelect() {
    return {
      id: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      storageBucket: true,
      storageKey: true,
      category: true,
      createdAt: true,
      uploadedBy: { select: { id: true, name: true } },
    } satisfies Prisma.ExpenseAttachmentSelect;
  }

  private invoiceSelect() {
    return {
      id: true,
      itemId: true,
      invoiceCode: true,
      invoiceNo: true,
      issuedAt: true,
      sellerName: true,
      sellerTaxNo: true,
      buyerName: true,
      buyerTaxNo: true,
      amountCents: true,
      taxAmountCents: true,
      deductibleTaxCents: true,
      totalAmountCents: true,
      currency: true,
      duplicateStatus: true,
      duplicateOfId: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
    } satisfies Prisma.ExpenseInvoiceSelect;
  }
}
