import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseReportAction, ExpenseReportStatus, FinanceReviewAction, Prisma } from '@prisma/client';
import { BudgetsService } from '../budgets/budgets.service';
import { AuthenticatedUser } from '../identity/identity.types';
import { PrismaService } from '../prisma/prisma.service';
import { PageResult } from '../shared/api-response';
import { FinanceReviewListQueryDto } from './finance-review.dto';

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

  private withFinanceReviewChecks<T extends { items?: unknown[]; invoices?: unknown[]; amountCents: number; taxAmountCents: number; deductibleTaxCents: number }>(report: T) {
    return { ...report, financeReviewChecks: this.buildFinanceReviewChecks(report) };
  }

  private buildFinanceReviewChecks(report: { items?: unknown[]; invoices?: unknown[]; amountCents: number; taxAmountCents: number; deductibleTaxCents: number }): FinanceReviewCheck[] {
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
      invoiceNo: string;
      duplicateStatus: 'UNIQUE' | 'DUPLICATE';
      amountCents: number;
      taxAmountCents: number;
      totalAmountCents: number;
      deductibleTaxCents: number;
    }>;

    const itemAmountCents = items.reduce((sum, item) => sum + item.amountCents, 0);
    const itemTaxCents = items.reduce((sum, item) => sum + item.taxAmountCents, 0);
    const itemDeductibleTaxCents = items.reduce((sum, item) => sum + item.deductibleTaxCents, 0);

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
      if (invoice.duplicateStatus === 'DUPLICATE') {
        checks.push({
          code: 'DUPLICATE_INVOICE',
          category: 'INVOICE',
          severity: 'BLOCK',
          invoiceId: invoice.id,
          message: `发票 ${invoice.invoiceNo} 存在重复。`,
        });
      }
      if (!invoice.itemId) {
        checks.push({
          code: 'UNLINKED_INVOICE',
          category: 'INVOICE',
          severity: 'WARNING',
          invoiceId: invoice.id,
          message: `发票 ${invoice.invoiceNo} 未关联报销明细。`,
        });
      }
      if (invoice.amountCents + invoice.taxAmountCents !== invoice.totalAmountCents) {
        checks.push({
          code: 'INVOICE_TOTAL_MISMATCH',
          category: 'INVOICE',
          severity: 'BLOCK',
          invoiceId: invoice.id,
          message: `发票 ${invoice.invoiceNo} 的金额与价税合计不一致。`,
        });
      }
      if (invoice.deductibleTaxCents > invoice.taxAmountCents) {
        checks.push({
          code: 'INVOICE_DEDUCTIBLE_TAX_OVER_TAX',
          category: 'TAX',
          severity: 'BLOCK',
          invoiceId: invoice.id,
          message: `发票 ${invoice.invoiceNo} 可抵扣税额大于税额。`,
        });
      }
    });

    const invoiceAmountByItem = new Map<string, number>();
    invoices.forEach((invoice) => {
      if (!invoice.itemId || invoice.duplicateStatus === 'DUPLICATE') {
        return;
      }
      invoiceAmountByItem.set(invoice.itemId, (invoiceAmountByItem.get(invoice.itemId) ?? 0) + invoice.totalAmountCents);
    });
    items.forEach((item) => {
      const linkedInvoiceTotal = invoiceAmountByItem.get(item.id) ?? 0;
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
}
