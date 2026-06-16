import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseReportAction, ExpenseReportStatus, FinanceReviewAction, Prisma } from '@prisma/client';
import { BudgetsService } from '../budgets/budgets.service';
import { AuthenticatedUser } from '../identity/identity.types';
import { PrismaService } from '../prisma/prisma.service';
import { PageResult } from '../shared/api-response';
import { AdjustFinanceReviewItemDto, FinanceReviewListQueryDto } from './finance-review.dto';

export type FinanceReviewCheckSeverity = 'PASS' | 'WARNING' | 'BLOCK';
export type FinanceReviewCheckCategory = 'ACCOUNTING_DIMENSION' | 'TAX' | 'INVOICE';

export interface FinanceReviewCheck {
  code: string;
  category: FinanceReviewCheckCategory;
  severity: FinanceReviewCheckSeverity;
  message: string;
  itemId?: string;
  invoiceId?: string;
}

@Injectable()
export class FinanceReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budgets: BudgetsService,
  ) {}

  async listReports(user: AuthenticatedUser, query: FinanceReviewListQueryDto): Promise<PageResult<unknown>> {
    this.ensurePermission(user, 'exp:finance-review:read');
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ExpenseReportWhereInput = {
      deletedAt: null,
      status: query.status ?? { in: [ExpenseReportStatus.BUSINESS_APPROVED, ExpenseReportStatus.FINANCE_APPROVED, ExpenseReportStatus.FINANCE_REJECTED] },
      OR: query.keyword
        ? [{ reportNo: { contains: query.keyword, mode: 'insensitive' } }, { title: { contains: query.keyword, mode: 'insensitive' } }]
        : undefined,
    };

    const [reports, total] = await this.prisma.$transaction([
      this.prisma.expenseReport.findMany({
        where,
        orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.reportSelect(),
      }),
      this.prisma.expenseReport.count({ where }),
    ]);

    const items = reports.map((report) => this.withFinanceReviewChecks(report));
    return { items, page, pageSize, total };
  }

  async getReport(user: AuthenticatedUser, reportId: string) {
    this.ensurePermission(user, 'exp:finance-review:read');
    const report = await this.prisma.expenseReport.findFirst({
      where: { id: reportId, deletedAt: null },
      select: this.reportSelect(),
    });
    if (!report) {
      throw new NotFoundException('Finance review report does not exist.');
    }
    return this.withFinanceReviewChecks(report);
  }

  approve(user: AuthenticatedUser, reportId: string, comment?: string) {
    return this.handle(user, reportId, FinanceReviewAction.APPROVE, ExpenseReportStatus.FINANCE_APPROVED, ExpenseReportAction.FINANCE_APPROVE, comment);
  }

  returnSupplement(user: AuthenticatedUser, reportId: string, comment?: string) {
    return this.handle(user, reportId, FinanceReviewAction.RETURN, ExpenseReportStatus.FINANCE_REJECTED, ExpenseReportAction.FINANCE_RETURN, comment);
  }

  reject(user: AuthenticatedUser, reportId: string, comment?: string) {
    return this.handle(user, reportId, FinanceReviewAction.REJECT, ExpenseReportStatus.REJECTED, ExpenseReportAction.FINANCE_REJECT, comment);
  }

  async adjustItem(user: AuthenticatedUser, reportId: string, itemId: string, dto: AdjustFinanceReviewItemDto) {
    this.ensurePermission(user, 'exp:finance-review:review');

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.expenseReport.findFirst({
        where: { id: reportId, deletedAt: null },
        select: {
          id: true,
          status: true,
          currency: true,
          items: {
            where: { id: itemId },
            select: {
              id: true,
              accountSubjectCode: true,
              costCenterId: true,
              projectId: true,
              taxAmountCents: true,
              deductibleTaxCents: true,
            },
          },
        },
      });
      if (!report) {
        throw new NotFoundException('Finance review report does not exist.');
      }
      if (report.status !== ExpenseReportStatus.BUSINESS_APPROVED) {
        throw new BadRequestException('Only business-approved reports can be adjusted by finance review.');
      }
      const item = report.items[0];
      if (!item) {
        throw new NotFoundException('Finance review item does not exist.');
      }

      const nextTaxAmountCents = dto.taxAmountCents ?? item.taxAmountCents;
      const nextDeductibleTaxCents = dto.deductibleTaxCents ?? item.deductibleTaxCents;
      if (nextDeductibleTaxCents > nextTaxAmountCents) {
        throw new BadRequestException('Deductible tax amount cannot exceed tax amount.');
      }

      const updateData: Prisma.ExpenseReportItemUpdateInput = {};
      if (dto.accountSubjectCode !== undefined) {
        updateData.accountSubjectCode = this.optionalString(dto.accountSubjectCode);
      }
      if (dto.costCenterId !== undefined) {
        updateData.costCenter = dto.costCenterId.trim() ? { connect: { id: dto.costCenterId.trim() } } : { disconnect: true };
      }
      if (dto.projectId !== undefined) {
        updateData.project = dto.projectId.trim() ? { connect: { id: dto.projectId.trim() } } : { disconnect: true };
      }
      if (dto.taxAmountCents !== undefined) {
        updateData.taxAmountCents = dto.taxAmountCents;
      }
      if (dto.deductibleTaxCents !== undefined) {
        updateData.deductibleTaxCents = dto.deductibleTaxCents;
      }
      if (!Object.keys(updateData).length) {
        throw new BadRequestException('No finance review adjustment fields were provided.');
      }

      await tx.expenseReportItem.update({
        where: { id: itemId },
        data: updateData,
      });

      const items = await tx.expenseReportItem.findMany({
        where: { reportId },
        select: { amountCents: true, taxAmountCents: true, deductibleTaxCents: true, reimbursableCents: true },
      });
      const totals = items.reduce(
        (result, current) => ({
          amountCents: result.amountCents + current.amountCents,
          taxAmountCents: result.taxAmountCents + current.taxAmountCents,
          deductibleTaxCents: result.deductibleTaxCents + current.deductibleTaxCents,
          reimbursableCents: result.reimbursableCents + current.reimbursableCents,
        }),
        { amountCents: 0, taxAmountCents: 0, deductibleTaxCents: 0, reimbursableCents: 0 },
      );
      const comment = dto.comment?.trim() || this.adjustmentComment(item, {
        accountSubjectCode: dto.accountSubjectCode,
        costCenterId: dto.costCenterId,
        projectId: dto.projectId,
        taxAmountCents: dto.taxAmountCents,
        deductibleTaxCents: dto.deductibleTaxCents,
      });

      await tx.expenseFinanceReview.create({
        data: {
          reportId,
          operatorId: user.id,
          action: FinanceReviewAction.ADJUST,
          fromStatus: report.status,
          toStatus: report.status,
          comment,
        },
      });
      await tx.expenseReportLog.create({
        data: {
          reportId,
          operatorId: user.id,
          action: ExpenseReportAction.FINANCE_ADJUST,
          fromStatus: report.status,
          toStatus: report.status,
          comment,
        },
      });

      return tx.expenseReport.update({
        where: { id: reportId },
        data: { ...totals, updatedById: user.id },
        select: this.reportSelect(),
      }).then((updatedReport) => this.withFinanceReviewChecks(updatedReport));
    });
  }

  private async handle(
    user: AuthenticatedUser,
    reportId: string,
    action: FinanceReviewAction,
    toStatus: ExpenseReportStatus,
    reportAction: ExpenseReportAction,
    comment?: string,
  ) {
    this.ensurePermission(user, 'exp:finance-review:review');

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.expenseReport.findFirst({
        where: { id: reportId, deletedAt: null },
        select: this.reportSelect(),
      });
      if (!report) {
        throw new NotFoundException('Finance review report does not exist.');
      }
      if (report.status !== ExpenseReportStatus.BUSINESS_APPROVED) {
        throw new BadRequestException('Only business-approved reports can be handled by finance review.');
      }

      const checks = this.buildFinanceReviewChecks(report);
      const blockingChecks = checks.filter((check) => check.severity === 'BLOCK');
      if (action === FinanceReviewAction.APPROVE && blockingChecks.length) {
        throw new BadRequestException(`Finance review has blocking issues: ${blockingChecks.map((check) => check.message).join('; ')}`);
      }

      await tx.expenseFinanceReview.create({
        data: {
          reportId,
          operatorId: user.id,
          action,
          fromStatus: report.status,
          toStatus,
          comment,
        },
      });
      await tx.expenseReportLog.create({
        data: {
          reportId,
          operatorId: user.id,
          action: reportAction,
          fromStatus: report.status,
          toStatus,
          comment,
        },
      });

      if (action === FinanceReviewAction.APPROVE) {
        await this.budgets.confirmApproved(tx, reportId, user.id);
      } else {
        await this.budgets.releaseReport(tx, reportId, user.id, comment ?? 'Finance review returned or rejected the report.');
      }

      return tx.expenseReport.update({
        where: { id: reportId },
        data: { status: toStatus, updatedById: user.id },
        select: this.reportSelect(),
      }).then((updatedReport) => this.withFinanceReviewChecks(updatedReport));
    });
  }

  private ensurePermission(user: AuthenticatedUser, permission: string) {
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenException('Missing finance review permission.');
    }
  }

  private optionalString(value: string) {
    const trimmed = value.trim();
    return trimmed || null;
  }

  private adjustmentComment(
    previous: {
      accountSubjectCode?: string | null;
      costCenterId?: string | null;
      projectId?: string | null;
      taxAmountCents: number;
      deductibleTaxCents: number;
    },
    next: {
      accountSubjectCode?: string;
      costCenterId?: string;
      projectId?: string;
      taxAmountCents?: number;
      deductibleTaxCents?: number;
    },
  ) {
    const changes = [
      next.accountSubjectCode !== undefined && `accountSubjectCode: ${previous.accountSubjectCode ?? '-'} -> ${this.optionalString(next.accountSubjectCode) ?? '-'}`,
      next.costCenterId !== undefined && `costCenterId: ${previous.costCenterId ?? '-'} -> ${this.optionalString(next.costCenterId) ?? '-'}`,
      next.projectId !== undefined && `projectId: ${previous.projectId ?? '-'} -> ${this.optionalString(next.projectId) ?? '-'}`,
      next.taxAmountCents !== undefined && `taxAmountCents: ${previous.taxAmountCents} -> ${next.taxAmountCents}`,
      next.deductibleTaxCents !== undefined && `deductibleTaxCents: ${previous.deductibleTaxCents} -> ${next.deductibleTaxCents}`,
    ].filter(Boolean);
    return `Finance review adjustment. ${changes.join('; ')}`;
  }

  private reportSelect() {
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
          department: { select: { id: true, name: true, code: true } },
          costCenter: { select: { id: true, name: true, code: true } },
          project: { select: { id: true, name: true, code: true } },
        },
      },
      invoices: {
        where: { deletedAt: null },
        select: {
          id: true,
          itemId: true,
          invoiceCode: true,
          invoiceNo: true,
          issuedAt: true,
          sellerName: true,
          sellerTaxNo: true,
          buyerName: true,
          buyerTaxNo: true,
          duplicateStatus: true,
          amountCents: true,
          taxAmountCents: true,
          totalAmountCents: true,
          deductibleTaxCents: true,
          currency: true,
          duplicateOfId: true,
          createdAt: true,
          createdBy: { select: { id: true, name: true } },
        },
      },
      policyChecks: {
        orderBy: [{ result: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, result: true, message: true, createdAt: true },
      },
      budgetChecks: {
        orderBy: [{ result: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, result: true, message: true, createdAt: true },
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
    } satisfies Prisma.ExpenseReportSelect;
  }

  private withFinanceReviewChecks<T extends { items?: unknown[]; invoices?: unknown[]; amountCents: number; taxAmountCents: number; deductibleTaxCents: number; currency?: string; submittedAt?: Date | string | null }>(report: T) {
    return { ...report, financeReviewChecks: this.buildFinanceReviewChecks(report) };
  }

  private buildFinanceReviewChecks(report: { items?: unknown[]; invoices?: unknown[]; amountCents: number; taxAmountCents: number; deductibleTaxCents: number; currency?: string; submittedAt?: Date | string | null }): FinanceReviewCheck[] {
    const checks: FinanceReviewCheck[] = [];
    const items = (report.items ?? []) as Array<{
      id: string;
      description: string;
      accountSubjectCode?: string | null;
      costCenterId?: string | null;
      projectId?: string | null;
      amountCents: number;
      taxAmountCents: number;
      deductibleTaxCents: number;
      reimbursableCents: number;
    }>;
    const invoices = (report.invoices ?? []) as Array<{
      id: string;
      itemId?: string | null;
      invoiceCode?: string | null;
      invoiceNo: string;
      issuedAt?: Date | string;
      sellerName: string;
      sellerTaxNo?: string | null;
      buyerName?: string | null;
      buyerTaxNo?: string | null;
      duplicateStatus: 'UNIQUE' | 'DUPLICATE';
      amountCents: number;
      taxAmountCents: number;
      totalAmountCents: number;
      deductibleTaxCents: number;
      currency?: string;
    }>;

    const itemAmountCents = items.reduce((sum, item) => sum + item.amountCents, 0);
    const itemTaxCents = items.reduce((sum, item) => sum + item.taxAmountCents, 0);
    const itemDeductibleTaxCents = items.reduce((sum, item) => sum + item.deductibleTaxCents, 0);
    const submittedAt = report.submittedAt ? new Date(report.submittedAt) : null;

    if (itemAmountCents !== report.amountCents || itemTaxCents !== report.taxAmountCents || itemDeductibleTaxCents !== report.deductibleTaxCents) {
      checks.push({
        code: 'REPORT_ITEM_TOTAL_MISMATCH',
        category: 'TAX',
        severity: 'BLOCK',
        message: '报销单汇总金额、税额或可抵扣税额与明细合计不一致。',
      });
    }

    items.forEach((item, index) => {
      const lineName = item.description || `第 ${index + 1} 行明细`;
      if (!item.accountSubjectCode) {
        checks.push({
          code: 'MISSING_ACCOUNT_SUBJECT',
          category: 'ACCOUNTING_DIMENSION',
          severity: 'BLOCK',
          itemId: item.id,
          message: `${lineName} 缺少会计科目。`,
        });
      }
      if (!item.costCenterId) {
        checks.push({
          code: 'MISSING_COST_CENTER',
          category: 'ACCOUNTING_DIMENSION',
          severity: 'BLOCK',
          itemId: item.id,
          message: `${lineName} 缺少成本中心。`,
        });
      }
      if (!item.projectId) {
        checks.push({
          code: 'MISSING_PROJECT',
          category: 'ACCOUNTING_DIMENSION',
          severity: 'WARNING',
          itemId: item.id,
          message: `${lineName} 未填写项目维度，请确认是否适用。`,
        });
      }
      if (item.deductibleTaxCents > item.taxAmountCents) {
        checks.push({
          code: 'ITEM_DEDUCTIBLE_TAX_OVER_TAX',
          category: 'TAX',
          severity: 'BLOCK',
          itemId: item.id,
          message: `${lineName} 可抵扣税额大于税额。`,
        });
      }
    });

    invoices.forEach((invoice) => {
      const invoiceLabel = this.invoiceLabel(invoice);
      if (invoice.duplicateStatus === 'DUPLICATE') {
        checks.push({
          code: 'DUPLICATE_INVOICE',
          category: 'INVOICE',
          severity: 'BLOCK',
          invoiceId: invoice.id,
          message: `${invoiceLabel} 存在重复。`,
        });
      }
      if (!invoice.itemId) {
        checks.push({
          code: 'UNLINKED_INVOICE',
          category: 'INVOICE',
          severity: 'WARNING',
          invoiceId: invoice.id,
          message: `${invoiceLabel} 未关联报销明细。`,
        });
      }
      if (invoice.currency && report.currency && invoice.currency !== report.currency) {
        checks.push({
          code: 'INVOICE_CURRENCY_MISMATCH',
          category: 'INVOICE',
          severity: 'BLOCK',
          invoiceId: invoice.id,
          message: `${invoiceLabel} 币种 ${invoice.currency} 与报销单币种 ${report.currency} 不一致。`,
        });
      }
      if (invoice.amountCents + invoice.taxAmountCents !== invoice.totalAmountCents) {
        checks.push({
          code: 'INVOICE_TOTAL_MISMATCH',
          category: 'INVOICE',
          severity: 'BLOCK',
          invoiceId: invoice.id,
          message: `${invoiceLabel} 的金额与价税合计不一致。`,
        });
      }
      if (invoice.deductibleTaxCents > invoice.taxAmountCents) {
        checks.push({
          code: 'INVOICE_DEDUCTIBLE_TAX_OVER_TAX',
          category: 'TAX',
          severity: 'BLOCK',
          invoiceId: invoice.id,
          message: `${invoiceLabel} 可抵扣税额大于税额。`,
        });
      }
      if (!invoice.sellerTaxNo) {
        checks.push({
          code: 'INVOICE_MISSING_SELLER_TAX_NO',
          category: 'INVOICE',
          severity: 'WARNING',
          invoiceId: invoice.id,
          message: `${invoiceLabel} 缺少销方税号，请人工确认票据合规性。`,
        });
      }
      if (!invoice.buyerName || !invoice.buyerTaxNo) {
        checks.push({
          code: 'INVOICE_MISSING_BUYER_INFO',
          category: 'INVOICE',
          severity: 'WARNING',
          invoiceId: invoice.id,
          message: `${invoiceLabel} 缺少购方名称或税号，请确认是否为公司抬头。`,
        });
      }
      if (submittedAt && invoice.issuedAt && new Date(invoice.issuedAt) > submittedAt) {
        checks.push({
          code: 'INVOICE_ISSUED_AFTER_SUBMIT',
          category: 'INVOICE',
          severity: 'WARNING',
          invoiceId: invoice.id,
          message: `${invoiceLabel} 开票日期晚于报销提交时间。`,
        });
      }
    });

    const invoiceAmountByItem = new Map<string, number>();
    const invoiceTaxByItem = new Map<string, number>();
    const invoiceDeductibleTaxByItem = new Map<string, number>();
    invoices.forEach((invoice) => {
      if (!invoice.itemId || invoice.duplicateStatus === 'DUPLICATE') {
        return;
      }
      invoiceAmountByItem.set(invoice.itemId, (invoiceAmountByItem.get(invoice.itemId) ?? 0) + invoice.totalAmountCents);
      invoiceTaxByItem.set(invoice.itemId, (invoiceTaxByItem.get(invoice.itemId) ?? 0) + invoice.taxAmountCents);
      invoiceDeductibleTaxByItem.set(invoice.itemId, (invoiceDeductibleTaxByItem.get(invoice.itemId) ?? 0) + invoice.deductibleTaxCents);
    });
    items.forEach((item) => {
      const linkedInvoiceTotal = invoiceAmountByItem.get(item.id) ?? 0;
      const linkedInvoiceTax = invoiceTaxByItem.get(item.id) ?? 0;
      const linkedInvoiceDeductibleTax = invoiceDeductibleTaxByItem.get(item.id) ?? 0;
      if (linkedInvoiceTotal === 0) {
        checks.push({
          code: 'ITEM_WITHOUT_INVOICE',
          category: 'INVOICE',
          severity: 'WARNING',
          itemId: item.id,
          message: `${item.description} 尚未关联有效发票。`,
        });
      } else if (linkedInvoiceTotal < item.amountCents) {
        checks.push({
          code: 'ITEM_INVOICE_AMOUNT_SHORT',
          category: 'INVOICE',
          severity: 'WARNING',
          itemId: item.id,
          message: `${item.description} 关联发票价税合计小于费用金额。`,
        });
      } else if (linkedInvoiceTotal > item.amountCents) {
        checks.push({
          code: 'ITEM_INVOICE_AMOUNT_OVER',
          category: 'INVOICE',
          severity: 'WARNING',
          itemId: item.id,
          message: `${item.description} 关联发票价税合计大于费用金额，请确认是否存在多开或关联错误。`,
        });
      }
      if (item.taxAmountCents > linkedInvoiceTax) {
        checks.push({
          code: 'ITEM_INVOICE_TAX_SHORT',
          category: 'TAX',
          severity: 'BLOCK',
          itemId: item.id,
          message: `${item.description} 明细税额大于关联发票税额合计。`,
        });
      }
      if (item.deductibleTaxCents > linkedInvoiceDeductibleTax) {
        checks.push({
          code: 'ITEM_INVOICE_DEDUCTIBLE_TAX_SHORT',
          category: 'TAX',
          severity: 'BLOCK',
          itemId: item.id,
          message: `${item.description} 明细可抵扣税额大于关联发票可抵扣税额合计。`,
        });
      }
    });

    if (!checks.length) {
      checks.push({
        code: 'FINANCE_REVIEW_PASS',
        category: 'ACCOUNTING_DIMENSION',
        severity: 'PASS',
        message: '会计维度、税额和发票复核未发现异常。',
      });
    }

    return checks;
  }

  private invoiceLabel(invoice: { invoiceCode?: string | null; invoiceNo: string }) {
    return `发票 ${invoice.invoiceCode ? `${invoice.invoiceCode}-` : ''}${invoice.invoiceNo}`;
  }
}
