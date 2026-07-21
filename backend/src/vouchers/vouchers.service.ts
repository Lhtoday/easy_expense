import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ExpenseReportAction,
  ExpenseReportStatus,
  GlAccountMappingPurpose,
  GlStatus,
  GlVoucherAction,
  GlVoucherLineDirection,
  GlVoucherStatus,
  GlVoucherType,
  PaymentStatus,
  Prisma,
  SystemAuditAction,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../identity/identity.types';
import { PrismaService } from '../prisma/prisma.service';
import { PageResult } from '../shared/api-response';
import {
  AccountMappingListQueryDto,
  AccountSubjectListQueryDto,
  CreateAccountMappingDto,
  CreateAccountSubjectDto,
  UpdateAccountMappingDto,
  UpdateAccountSubjectDto,
  VoucherReportListQueryDto,
} from './voucher.dto';

type VoucherLineDraft = {
  direction: GlVoucherLineDirection;
  accountSubjectCode: string;
  amountCents: number;
  currency: string;
  summary: string;
  reportId: string;
  itemId?: string | null;
  paymentId?: string | null;
  departmentId?: string | null;
  costCenterId?: string | null;
  projectId?: string | null;
};

type VoucherDraft = {
  voucherType: GlVoucherType;
  paymentId?: string | null;
  currency: string;
  summary: string;
  totalDebitCents: number;
  totalCreditCents: number;
  lines: VoucherLineDraft[];
};

type VoucherReport = Awaited<ReturnType<VouchersService['loadVoucherReport']>>;

@Injectable()
export class VouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listSubjects(user: AuthenticatedUser, query: AccountSubjectListQueryDto): Promise<PageResult<unknown>> {
    this.ensurePermission(user, 'gl:account:read');
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.GlAccountSubjectWhereInput = {
      deletedAt: null,
      status: query.status,
      OR: query.keyword ? [{ code: { contains: query.keyword, mode: 'insensitive' } }, { name: { contains: query.keyword, mode: 'insensitive' } }] : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.glAccountSubject.findMany({ where, orderBy: { code: 'asc' }, skip: (page - 1) * pageSize, take: pageSize, select: this.subjectSelect() }),
      this.prisma.glAccountSubject.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }

  createSubject(user: AuthenticatedUser, dto: CreateAccountSubjectDto) {
    this.ensurePermission(user, 'gl:account:write');
    return this.prisma.$transaction(async (tx) => {
      const subject = await tx.glAccountSubject.create({
        data: {
          code: dto.code.trim(),
          name: dto.name,
          category: dto.category,
          normalBalance: dto.normalBalance,
          description: dto.description,
          createdById: user.id,
        },
        select: this.subjectSelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator: user,
        action: SystemAuditAction.ACCOUNT_SUBJECT_CREATE,
        entityType: 'gl-account-subject',
        entityId: subject.id,
        after: subject,
      });
      return subject;
    });
  }

  async updateSubject(user: AuthenticatedUser, id: string, dto: UpdateAccountSubjectDto) {
    this.ensurePermission(user, 'gl:account:write');
    const before = await this.ensureSubject(id);
    return this.prisma.$transaction(async (tx) => {
      const subject = await tx.glAccountSubject.update({
        where: { id },
        data: {
          name: dto.name,
          category: dto.category,
          normalBalance: dto.normalBalance,
          description: dto.description,
          status: dto.status,
          updatedById: user.id,
        },
        select: this.subjectSelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator: user,
        action: SystemAuditAction.ACCOUNT_SUBJECT_UPDATE,
        entityType: 'gl-account-subject',
        entityId: id,
        before,
        after: subject,
      });
      return subject;
    });
  }

  async disableSubject(user: AuthenticatedUser, id: string) {
    this.ensurePermission(user, 'gl:account:write');
    const before = await this.ensureSubject(id);
    return this.prisma.$transaction(async (tx) => {
      const referenced = await this.subjectHasReferences(tx, before.code);
      const subject = referenced
        ? await tx.glAccountSubject.update({
            where: { id },
            data: { status: GlStatus.DISABLED, updatedById: user.id },
            select: this.subjectSelect(),
          })
        : await tx.glAccountSubject.delete({ where: { id }, select: this.subjectSelect() });
      await this.audit.recordWithClient(tx, {
        operator: user,
        action: SystemAuditAction.ACCOUNT_SUBJECT_DISABLE,
        entityType: 'gl-account-subject',
        entityId: id,
        before,
        after: referenced ? subject : null,
        metadata: { physicalDeleted: !referenced },
      });
      return subject;
    });
  }

  async listMappings(user: AuthenticatedUser, query: AccountMappingListQueryDto): Promise<PageResult<unknown>> {
    this.ensurePermission(user, 'gl:account:read');
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.GlAccountMappingWhereInput = { deletedAt: null, purpose: query.purpose, status: query.status };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.glAccountMapping.findMany({ where, orderBy: [{ purpose: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }], skip: (page - 1) * pageSize, take: pageSize, select: this.mappingSelect() }),
      this.prisma.glAccountMapping.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }

  createMapping(user: AuthenticatedUser, dto: CreateAccountMappingDto) {
    this.ensurePermission(user, 'gl:account:write');
    return this.prisma.$transaction(async (tx) => {
      await this.ensureActiveSubjectByCode(tx, dto.accountSubjectCode);
      const mapping = await tx.glAccountMapping.create({
        data: this.mappingData(dto, user.id),
        select: this.mappingSelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator: user,
        action: SystemAuditAction.ACCOUNT_MAPPING_CREATE,
        entityType: 'gl-account-mapping',
        entityId: mapping.id,
        after: mapping,
      });
      return mapping;
    });
  }

  async updateMapping(user: AuthenticatedUser, id: string, dto: UpdateAccountMappingDto) {
    this.ensurePermission(user, 'gl:account:write');
    const before = await this.ensureMapping(id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.accountSubjectCode) {
        await this.ensureActiveSubjectByCode(tx, dto.accountSubjectCode);
      }
      const mapping = await tx.glAccountMapping.update({
        where: { id },
        data: { ...this.mappingUpdateData(dto), updatedById: user.id },
        select: this.mappingSelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator: user,
        action: SystemAuditAction.ACCOUNT_MAPPING_UPDATE,
        entityType: 'gl-account-mapping',
        entityId: id,
        before,
        after: mapping,
      });
      return mapping;
    });
  }

  async disableMapping(user: AuthenticatedUser, id: string) {
    this.ensurePermission(user, 'gl:account:write');
    const before = await this.ensureMapping(id);
    return this.prisma.$transaction(async (tx) => {
      const mapping = await tx.glAccountMapping.delete({
        where: { id },
        select: this.mappingSelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator: user,
        action: SystemAuditAction.ACCOUNT_MAPPING_DISABLE,
        entityType: 'gl-account-mapping',
        entityId: id,
        before,
        after: null,
        metadata: { physicalDeleted: true },
      });
      return mapping;
    });
  }

  async previewReport(user: AuthenticatedUser, reportId: string) {
    this.ensurePermission(user, 'gl:voucher:read');
    const report = await this.loadVoucherReport(this.prisma, reportId);
    this.ensureVoucherEligible(report);
    const vouchers = await this.buildVoucherDrafts(this.prisma, report);
    return { reportId, reportNo: report.reportNo, vouchers };
  }

  async listReports(user: AuthenticatedUser, query: VoucherReportListQueryDto): Promise<PageResult<unknown>> {
    this.ensurePermission(user, 'gl:voucher:read');
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ExpenseReportWhereInput = {
      deletedAt: null,
      status: query.status ?? { in: [ExpenseReportStatus.PAID, ExpenseReportStatus.VOUCHER_DRAFTED, ExpenseReportStatus.VOUCHER_CONFIRMED] },
      OR: query.keyword
        ? [{ reportNo: { contains: query.keyword, mode: 'insensitive' } }, { title: { contains: query.keyword, mode: 'insensitive' } }]
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.expenseReport.findMany({
        where,
        orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.voucherReportSelect(),
      }),
      this.prisma.expenseReport.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async getReport(user: AuthenticatedUser, reportId: string) {
    this.ensurePermission(user, 'gl:voucher:read');
    const report = await this.prisma.expenseReport.findFirst({
      where: {
        id: reportId,
        deletedAt: null,
        status: { in: [ExpenseReportStatus.PAID, ExpenseReportStatus.VOUCHER_DRAFTED, ExpenseReportStatus.VOUCHER_CONFIRMED] },
      },
      select: this.voucherReportDetailSelect(),
    });
    if (!report) {
      throw new NotFoundException('Voucher report does not exist.');
    }
    return report;
  }

  generateReportVouchers(user: AuthenticatedUser, reportId: string, comment?: string) {
    this.ensurePermission(user, 'gl:voucher:generate');
    return this.prisma.$transaction(async (tx) => {
      const report = await this.loadVoucherReport(tx, reportId);
      this.ensureVoucherEligible(report);
      const existing = await tx.glVoucher.count({ where: { reportId, status: { not: GlVoucherStatus.VOIDED } } });
      if (existing > 0) {
        throw new BadRequestException('该报销单已存在凭证草稿或已确认凭证，不能重复生成。');
      }

      const drafts = await this.buildVoucherDrafts(tx, report);
      const vouchers = [];
      for (const draft of drafts) {
        const voucher = await tx.glVoucher.create({
          data: {
            voucherNo: await this.nextVoucherNo(tx),
            voucherType: draft.voucherType,
            status: GlVoucherStatus.DRAFT,
            reportId,
            paymentId: draft.paymentId ?? undefined,
            currency: draft.currency,
            totalDebitCents: draft.totalDebitCents,
            totalCreditCents: draft.totalCreditCents,
            summary: draft.summary,
            generatedById: user.id,
            comment,
            lines: {
              create: draft.lines.map((line, index) => ({
                lineNo: index + 1,
                direction: line.direction,
                accountSubjectCode: line.accountSubjectCode,
                amountCents: line.amountCents,
                currency: line.currency,
                summary: line.summary,
                reportId: line.reportId,
                itemId: line.itemId ?? undefined,
                paymentId: line.paymentId ?? undefined,
                departmentId: line.departmentId ?? undefined,
                costCenterId: line.costCenterId ?? undefined,
                projectId: line.projectId ?? undefined,
              })),
            },
            logs: {
              create: {
                operatorId: user.id,
                action: GlVoucherAction.GENERATE,
                toStatus: GlVoucherStatus.DRAFT,
                comment,
                metadata: draft as unknown as Prisma.InputJsonValue,
              },
            },
          },
          select: this.voucherSelect(),
        });
        vouchers.push(voucher);
      }

      await tx.expenseReportLog.create({
        data: {
          reportId,
          operatorId: user.id,
          action: ExpenseReportAction.VOUCHER_DRAFT,
          fromStatus: report.status,
          toStatus: ExpenseReportStatus.VOUCHER_DRAFTED,
          comment: comment ?? '生成凭证草稿',
        },
      });
      await tx.expenseReport.update({ where: { id: reportId }, data: { status: ExpenseReportStatus.VOUCHER_DRAFTED, updatedById: user.id } });
      await this.audit.recordWithClient(tx, {
        operator: user,
        action: SystemAuditAction.VOUCHER_DRAFT_GENERATE,
        entityType: 'gl-voucher',
        entityId: reportId,
        after: vouchers,
        metadata: { reportId, reportNo: report.reportNo, voucherCount: vouchers.length },
        comment,
      });
      return vouchers;
    });
  }

  async detail(user: AuthenticatedUser, id: string) {
    this.ensurePermission(user, 'gl:voucher:read');
    const voucher = await this.prisma.glVoucher.findFirst({ where: { id }, select: this.voucherSelect() });
    if (!voucher) {
      throw new NotFoundException('凭证草稿不存在');
    }
    return voucher;
  }

  confirm(user: AuthenticatedUser, id: string, comment?: string) {
    this.ensurePermission(user, 'gl:voucher:confirm');
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.glVoucher.findFirst({
        where: { id },
        select: { id: true, status: true, reportId: true, voucherType: true, lines: { select: { direction: true, amountCents: true } } },
      });
      if (!before) {
        throw new NotFoundException('凭证草稿不存在');
      }
      if (before.status !== GlVoucherStatus.DRAFT) {
        throw new BadRequestException('只有草稿状态的凭证可以确认。');
      }
      this.ensureBalanced(before.lines);

      const voucher = await tx.glVoucher.update({
        where: { id },
        data: {
          status: GlVoucherStatus.CONFIRMED,
          confirmedById: user.id,
          confirmedAt: new Date(),
          comment,
          logs: {
            create: {
              operatorId: user.id,
              action: GlVoucherAction.CONFIRM,
              fromStatus: GlVoucherStatus.DRAFT,
              toStatus: GlVoucherStatus.CONFIRMED,
              comment,
            },
          },
        },
        select: this.voucherSelect(),
      });

      const remainingDrafts = await tx.glVoucher.count({ where: { reportId: before.reportId, status: GlVoucherStatus.DRAFT } });
      if (remainingDrafts === 0) {
        await tx.expenseReportLog.create({
          data: {
            reportId: before.reportId,
            operatorId: user.id,
            action: ExpenseReportAction.VOUCHER_CONFIRM,
            fromStatus: ExpenseReportStatus.VOUCHER_DRAFTED,
            toStatus: ExpenseReportStatus.VOUCHER_CONFIRMED,
            comment: comment ?? '确认全部凭证草稿',
          },
        });
        await tx.expenseReport.update({ where: { id: before.reportId }, data: { status: ExpenseReportStatus.VOUCHER_CONFIRMED, updatedById: user.id } });
      }

      await this.audit.recordWithClient(tx, {
        operator: user,
        action: SystemAuditAction.VOUCHER_CONFIRM,
        entityType: 'gl-voucher',
        entityId: id,
        before,
        after: voucher,
        metadata: { reportId: before.reportId, voucherType: before.voucherType },
        comment,
      });
      return voucher;
    });
  }

  voidReportDrafts(user: AuthenticatedUser, reportId: string, comment?: string) {
    this.ensurePermission(user, 'gl:voucher:confirm');
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.expenseReport.findFirst({
        where: { id: reportId, deletedAt: null },
        select: { id: true, reportNo: true, status: true },
      });
      if (!report) {
        throw new NotFoundException('报销单不存在');
      }
      if (report.status !== ExpenseReportStatus.VOUCHER_DRAFTED) {
        throw new BadRequestException('只有凭证草稿状态的报销单可以撤销草稿。');
      }

      const confirmedCount = await tx.glVoucher.count({ where: { reportId, status: GlVoucherStatus.CONFIRMED } });
      if (confirmedCount > 0) {
        throw new BadRequestException('该报销单已有确认凭证，不能撤销草稿；后续需走冲销或作废流程。');
      }

      const before = await tx.glVoucher.findMany({
        where: { reportId, status: GlVoucherStatus.DRAFT },
        orderBy: { generatedAt: 'asc' },
        select: this.voucherSelect(),
      });
      if (!before.length) {
        throw new BadRequestException('该报销单没有可撤销的凭证草稿。');
      }

      const vouchers = [];
      for (const voucher of before) {
        const updated = await tx.glVoucher.update({
          where: { id: voucher.id },
          data: {
            status: GlVoucherStatus.VOIDED,
            paymentId: null,
            comment,
            logs: {
              create: {
                operatorId: user.id,
                action: GlVoucherAction.VOID,
                fromStatus: GlVoucherStatus.DRAFT,
                toStatus: GlVoucherStatus.VOIDED,
                comment,
                metadata: { originalPaymentId: voucher.paymentId } as Prisma.InputJsonValue,
              },
            },
          },
          select: this.voucherSelect(),
        });
        vouchers.push(updated);
      }

      await tx.expenseReportLog.create({
        data: {
          reportId,
          operatorId: user.id,
          action: ExpenseReportAction.VOUCHER_VOID,
          fromStatus: ExpenseReportStatus.VOUCHER_DRAFTED,
          toStatus: ExpenseReportStatus.PAID,
          comment: comment ?? '撤销凭证草稿',
        },
      });
      await tx.expenseReport.update({ where: { id: reportId }, data: { status: ExpenseReportStatus.PAID, updatedById: user.id } });
      await this.audit.recordWithClient(tx, {
        operator: user,
        action: SystemAuditAction.VOUCHER_VOID,
        entityType: 'gl-voucher',
        entityId: reportId,
        before,
        after: vouchers,
        metadata: { reportId, reportNo: report.reportNo, voucherCount: vouchers.length, fromStatus: report.status, toStatus: ExpenseReportStatus.PAID },
        comment,
      });
      return vouchers;
    });
  }

  private async loadVoucherReport(client: PrismaService | Prisma.TransactionClient, reportId: string) {
    const report = await client.expenseReport.findFirst({
      where: { id: reportId, deletedAt: null },
      select: {
        id: true,
        reportNo: true,
        title: true,
        status: true,
        currency: true,
        reimbursableCents: true,
        paidAmountCents: true,
        applicantId: true,
        applicant: { select: { id: true, name: true, employeeNo: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            expenseTypeCode: true,
            accountSubjectCode: true,
            description: true,
            departmentId: true,
            costCenterId: true,
            projectId: true,
            reimbursableCents: true,
            deductibleTaxCents: true,
          },
        },
        payments: {
          where: { status: PaymentStatus.SUCCESS },
          orderBy: { createdAt: 'asc' },
          select: { id: true, method: true, amountCents: true, currency: true, payerAccount: true, paidAt: true },
        },
      },
    });
    if (!report) {
      throw new NotFoundException('报销单不存在');
    }
    return report;
  }

  private voucherReportSelect() {
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
      payments: {
        where: { status: PaymentStatus.SUCCESS },
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
      vouchers: {
        where: { status: { not: GlVoucherStatus.VOIDED } },
        orderBy: { generatedAt: 'asc' },
        select: this.voucherSelect(),
      },
    } satisfies Prisma.ExpenseReportSelect;
  }

  private voucherReportDetailSelect() {
    return {
      ...this.voucherReportSelect(),
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
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          storageBucket: true,
          storageKey: true,
          category: true,
          createdAt: true,
          uploadedBy: { select: { id: true, name: true } },
        },
      },
      invoices: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          itemId: true,
          invoiceCode: true,
          invoiceNo: true,
          issuedAt: true,
          amountCents: true,
          taxAmountCents: true,
          totalAmountCents: true,
          currency: true,
          sellerName: true,
          sellerTaxNo: true,
          buyerName: true,
          buyerTaxNo: true,
          duplicateStatus: true,
          duplicateOfId: true,
          createdAt: true,
          createdBy: { select: { id: true, name: true } },
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
    } satisfies Prisma.ExpenseReportSelect;
  }

  private ensureVoucherEligible(report: NonNullable<VoucherReport>) {
    if (report.status !== ExpenseReportStatus.PAID) {
      throw new BadRequestException('只有已付款报销单可以生成凭证草稿。');
    }
    if (report.paidAmountCents <= 0 || report.payments.length < 1) {
      throw new BadRequestException('已付款报销单缺少成功付款记录，不能生成凭证。');
    }
  }

  private async buildVoucherDrafts(client: PrismaService | Prisma.TransactionClient, report: NonNullable<VoucherReport>): Promise<VoucherDraft[]> {
    const expenseLines: VoucherLineDraft[] = [];
    let payableTotal = 0;
    for (const item of report.items) {
      if (item.reimbursableCents <= 0) {
        continue;
      }
      const deductibleTax = Math.min(item.deductibleTaxCents, item.reimbursableCents);
      const expenseAmount = item.reimbursableCents - deductibleTax;
      if (expenseAmount > 0) {
        const expenseAccount = item.accountSubjectCode || (await this.resolveAccount(client, GlAccountMappingPurpose.EXPENSE_TYPE, report, item));
        expenseLines.push(this.line(GlVoucherLineDirection.DEBIT, expenseAccount, expenseAmount, report.currency, `${item.description} 费用确认`, report.id, item.id, null, item));
      }
      if (deductibleTax > 0) {
        const taxAccount = await this.resolveAccount(client, GlAccountMappingPurpose.INPUT_TAX, report, item);
        expenseLines.push(this.line(GlVoucherLineDirection.DEBIT, taxAccount, deductibleTax, report.currency, `${item.description} 可抵扣进项税`, report.id, item.id, null, item));
      }
      payableTotal += item.reimbursableCents;
    }
    if (payableTotal <= 0) {
      throw new BadRequestException('报销单没有可生成凭证的可报销金额。');
    }
    const payableAccount = await this.resolveAccount(client, GlAccountMappingPurpose.EMPLOYEE_PAYABLE, report);
    expenseLines.push(this.line(GlVoucherLineDirection.CREDIT, payableAccount, payableTotal, report.currency, `${report.reportNo} 员工报销应付款`, report.id));
    const accrual = this.toDraft(GlVoucherType.EXPENSE_ACCRUAL, report.currency, `${report.reportNo} 报销确认凭证`, expenseLines);

    const paymentDrafts: VoucherDraft[] = [];
    for (const payment of report.payments) {
      const bankAccount = await this.resolveAccount(client, GlAccountMappingPurpose.BANK_PAYMENT, report, undefined, payment);
      const lines = [
        this.line(GlVoucherLineDirection.DEBIT, payableAccount, payment.amountCents, payment.currency, `${report.reportNo} 冲销员工报销应付款`, report.id, null, payment.id),
        this.line(GlVoucherLineDirection.CREDIT, bankAccount, payment.amountCents, payment.currency, `${report.reportNo} 出纳付款`, report.id, null, payment.id),
      ];
      paymentDrafts.push(this.toDraft(GlVoucherType.PAYMENT, payment.currency, `${report.reportNo} 付款凭证`, lines, payment.id));
    }
    return [accrual, ...paymentDrafts];
  }

  private async resolveAccount(
    client: PrismaService | Prisma.TransactionClient,
    purpose: GlAccountMappingPurpose,
    report: NonNullable<VoucherReport>,
    item?: NonNullable<VoucherReport>['items'][number],
    payment?: NonNullable<VoucherReport>['payments'][number],
  ) {
    const now = new Date();
    const dimensionFilters: Prisma.GlAccountMappingWhereInput[] = [
      ...this.nullableStringDimension('applicantId', purpose === GlAccountMappingPurpose.EMPLOYEE_PAYABLE ? report.applicantId : undefined),
      ...this.nullablePaymentMethodDimension(purpose === GlAccountMappingPurpose.BANK_PAYMENT ? payment?.method ?? null : undefined),
      ...this.nullableStringDimension('payerAccount', purpose === GlAccountMappingPurpose.BANK_PAYMENT ? payment?.payerAccount ?? null : undefined),
      ...this.nullableStringDimension('departmentId', item ? item.departmentId : undefined),
      ...this.nullableStringDimension('costCenterId', item ? item.costCenterId : undefined),
      ...this.nullableStringDimension('projectId', item ? item.projectId : undefined),
    ];
    const mappings = await client.glAccountMapping.findMany({
      where: {
        purpose,
        status: GlStatus.ACTIVE,
        deletedAt: null,
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
        AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }, ...dimensionFilters],
        expenseTypeCode: purpose === GlAccountMappingPurpose.EXPENSE_TYPE ? item?.expenseTypeCode : undefined,
        accountSubject: { status: GlStatus.ACTIVE, deletedAt: null },
      },
      select: {
        accountSubjectCode: true,
        priority: true,
        applicantId: true,
        paymentMethod: true,
        payerAccount: true,
        departmentId: true,
        costCenterId: true,
        projectId: true,
      },
    });
    const [best] = mappings.sort((left, right) => this.mappingScore(right, purpose, item, payment, report) - this.mappingScore(left, purpose, item, payment, report) || left.priority - right.priority);
    if (!best) {
      throw new BadRequestException(`缺少 ${purpose} 会计科目映射，不能生成凭证草稿。`);
    }
    return best.accountSubjectCode;
  }

  private mappingScore(
    mapping: { applicantId: string | null; paymentMethod: unknown | null; payerAccount: string | null; departmentId: string | null; costCenterId: string | null; projectId: string | null },
    purpose: GlAccountMappingPurpose,
    item?: NonNullable<VoucherReport>['items'][number],
    payment?: NonNullable<VoucherReport>['payments'][number],
    report?: NonNullable<VoucherReport>,
  ) {
    const dimensions = [
      item && mapping.departmentId === item.departmentId ? 1 : 0,
      item && mapping.costCenterId === item.costCenterId ? 1 : 0,
      item && mapping.projectId === item.projectId ? 1 : 0,
      purpose === GlAccountMappingPurpose.EMPLOYEE_PAYABLE && mapping.applicantId === report?.applicantId ? 1 : 0,
      purpose === GlAccountMappingPurpose.BANK_PAYMENT && payment && mapping.paymentMethod === payment.method ? 1 : 0,
      purpose === GlAccountMappingPurpose.BANK_PAYMENT && payment?.payerAccount && mapping.payerAccount === payment.payerAccount ? 1 : 0,
    ];
    return dimensions.reduce((sum, value) => sum + value, 0);
  }

  private line(
    direction: GlVoucherLineDirection,
    accountSubjectCode: string,
    amountCents: number,
    currency: string,
    summary: string,
    reportId: string,
    itemId?: string | null,
    paymentId?: string | null,
    item?: { departmentId: string | null; costCenterId: string | null; projectId: string | null },
  ): VoucherLineDraft {
    return {
      direction,
      accountSubjectCode,
      amountCents,
      currency,
      summary,
      reportId,
      itemId,
      paymentId,
      departmentId: item?.departmentId,
      costCenterId: item?.costCenterId,
      projectId: item?.projectId,
    };
  }

  private toDraft(voucherType: GlVoucherType, currency: string, summary: string, lines: VoucherLineDraft[], paymentId?: string | null): VoucherDraft {
    const totalDebitCents = lines.filter((line) => line.direction === GlVoucherLineDirection.DEBIT).reduce((sum, line) => sum + line.amountCents, 0);
    const totalCreditCents = lines.filter((line) => line.direction === GlVoucherLineDirection.CREDIT).reduce((sum, line) => sum + line.amountCents, 0);
    if (totalDebitCents !== totalCreditCents) {
      throw new BadRequestException(`${summary} 借贷不平衡，不能生成凭证草稿。`);
    }
    return { voucherType, paymentId, currency, summary, totalDebitCents, totalCreditCents, lines };
  }

  private ensureBalanced(lines: Array<{ direction: GlVoucherLineDirection; amountCents: number }>) {
    const totalDebitCents = lines.filter((line) => line.direction === GlVoucherLineDirection.DEBIT).reduce((sum, line) => sum + line.amountCents, 0);
    const totalCreditCents = lines.filter((line) => line.direction === GlVoucherLineDirection.CREDIT).reduce((sum, line) => sum + line.amountCents, 0);
    if (totalDebitCents !== totalCreditCents) {
      throw new BadRequestException('凭证明细借贷不平衡，不能确认。');
    }
  }

  private mappingData(dto: CreateAccountMappingDto, userId: string): Prisma.GlAccountMappingUncheckedCreateInput {
    return {
      purpose: dto.purpose,
      expenseTypeCode: dto.expenseTypeCode?.trim().toUpperCase(),
      applicantId: dto.applicantId,
      paymentMethod: dto.paymentMethod,
      payerAccount: dto.payerAccount?.trim(),
      departmentId: dto.departmentId,
      costCenterId: dto.costCenterId,
      projectId: dto.projectId,
      accountSubjectCode: dto.accountSubjectCode.trim(),
      priority: dto.priority ?? 100,
      effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
      createdById: userId,
    };
  }

  private mappingUpdateData(dto: UpdateAccountMappingDto): Prisma.GlAccountMappingUncheckedUpdateInput {
    return {
      purpose: dto.purpose,
      expenseTypeCode: dto.expenseTypeCode?.trim().toUpperCase(),
      applicantId: dto.applicantId,
      paymentMethod: dto.paymentMethod,
      payerAccount: dto.payerAccount?.trim(),
      departmentId: dto.departmentId,
      costCenterId: dto.costCenterId,
      projectId: dto.projectId,
      accountSubjectCode: dto.accountSubjectCode?.trim(),
      priority: dto.priority,
      status: dto.status,
      effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
    };
  }

  private nullableStringDimension(field: 'applicantId' | 'payerAccount' | 'departmentId' | 'costCenterId' | 'projectId', value: string | null | undefined): Prisma.GlAccountMappingWhereInput[] {
    if (value === undefined) {
      return [];
    }
    if (value === null) {
      return [{ [field]: null }];
    }
    return [{ OR: [{ [field]: value }, { [field]: null }] }];
  }

  private nullablePaymentMethodDimension(value: NonNullable<VoucherReport>['payments'][number]['method'] | null | undefined): Prisma.GlAccountMappingWhereInput[] {
    if (value === undefined) {
      return [];
    }
    if (value === null) {
      return [{ paymentMethod: null }];
    }
    return [{ OR: [{ paymentMethod: value }, { paymentMethod: null }] }];
  }

  private async nextVoucherNo(tx: Prisma.TransactionClient) {
    const now = new Date();
    const prefix = `VCH${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const count = await tx.glVoucher.count({ where: { voucherNo: { startsWith: prefix } } });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private async ensureSubject(id: string) {
    const subject = await this.prisma.glAccountSubject.findFirst({ where: { id, deletedAt: null }, select: this.subjectSelect() });
    if (!subject) {
      throw new NotFoundException('会计科目不存在');
    }
    return subject;
  }

  private async ensureMapping(id: string) {
    const mapping = await this.prisma.glAccountMapping.findFirst({ where: { id, deletedAt: null }, select: this.mappingSelect() });
    if (!mapping) {
      throw new NotFoundException('会计科目映射不存在');
    }
    return mapping;
  }

  private async ensureActiveSubjectByCode(client: PrismaService | Prisma.TransactionClient, code: string) {
    const subject = await client.glAccountSubject.findFirst({ where: { code, status: GlStatus.ACTIVE, deletedAt: null }, select: { id: true } });
    if (!subject) {
      throw new BadRequestException('会计科目不存在或已停用');
    }
  }

  private async subjectHasReferences(tx: Prisma.TransactionClient, code: string) {
    const [expenseTypes, reportItems, budgets, budgetOccupations, accountMappings, voucherLines] = await Promise.all([
      tx.expenseType.count({ where: { defaultAccountSubjectCode: code, deletedAt: null } }),
      tx.expenseReportItem.count({ where: { accountSubjectCode: code } }),
      tx.budget.count({ where: { accountSubjectCode: code } }),
      tx.budgetOccupation.count({ where: { accountSubjectCode: code } }),
      tx.glAccountMapping.count({ where: { accountSubjectCode: code, deletedAt: null } }),
      tx.glVoucherLine.count({ where: { accountSubjectCode: code } }),
    ]);
    return [expenseTypes, reportItems, budgets, budgetOccupations, accountMappings, voucherLines].some((count) => count > 0);
  }

  private ensurePermission(user: AuthenticatedUser, permission: string) {
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenException('缺少凭证或会计科目操作权限');
    }
  }

  private subjectSelect() {
    return {
      id: true,
      code: true,
      name: true,
      category: true,
      normalBalance: true,
      description: true,
      status: true,
      createdAt: true,
      deletedAt: true,
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
    } satisfies Prisma.GlAccountSubjectSelect;
  }

  private mappingSelect() {
    return {
      id: true,
      purpose: true,
      expenseTypeCode: true,
      applicantId: true,
      paymentMethod: true,
      payerAccount: true,
      departmentId: true,
      costCenterId: true,
      projectId: true,
      accountSubjectCode: true,
      priority: true,
      status: true,
      effectiveFrom: true,
      effectiveTo: true,
      createdAt: true,
      deletedAt: true,
      accountSubject: { select: { code: true, name: true, category: true } },
      applicant: { select: { id: true, name: true, employeeNo: true } },
      department: { select: { id: true, code: true, name: true } },
      costCenter: { select: { id: true, code: true, name: true } },
      project: { select: { id: true, code: true, name: true } },
    } satisfies Prisma.GlAccountMappingSelect;
  }

  private voucherSelect() {
    return {
      id: true,
      voucherNo: true,
      voucherType: true,
      status: true,
      reportId: true,
      paymentId: true,
      currency: true,
      totalDebitCents: true,
      totalCreditCents: true,
      summary: true,
      generatedAt: true,
      confirmedAt: true,
      comment: true,
      generatedBy: { select: { id: true, name: true } },
      confirmedBy: { select: { id: true, name: true } },
      lines: {
        orderBy: { lineNo: 'asc' },
        select: {
          id: true,
          lineNo: true,
          direction: true,
          accountSubjectCode: true,
          amountCents: true,
          currency: true,
          summary: true,
          itemId: true,
          paymentId: true,
          accountSubject: { select: { code: true, name: true, category: true } },
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
    } satisfies Prisma.GlVoucherSelect;
  }
}
