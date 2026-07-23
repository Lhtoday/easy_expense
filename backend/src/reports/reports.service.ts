import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  BudgetCheckResult,
  ExpensePolicyCheckResult,
  ExpenseReportStatus,
  InvoiceDuplicateStatus,
  Prisma,
} from '@prisma/client';
import { AuthenticatedUser } from '../identity/identity.types';
import { PrismaService } from '../prisma/prisma.service';
import { PageResult } from '../shared/api-response';
import { AuditReportQueryDto, ReportQueryDto } from './report.dto';

type DimensionRow = {
  key: string;
  code: string;
  name: string;
  reportCount: number;
  itemCount: number;
  amountCents: number;
  reimbursableCents: number;
  paidAmountCents: number;
};

type ReportItemRow = {
  amountCents: number;
  reimbursableCents: number;
  report: { id: string; paidAmountCents: number; department?: DimensionValue | null; costCenter?: DimensionValue | null; project?: DimensionValue | null };
  department?: DimensionValue | null;
  costCenter?: DimensionValue | null;
  project?: DimensionValue | null;
};

type DimensionValue = { id: string; code: string; name: string };

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(user: AuthenticatedUser, query: ReportQueryDto) {
    this.ensurePermission(user, 'report:dashboard:read');
    const submittedAt = this.dateRange(query);
    const reportWhere: Prisma.ExpenseReportWhereInput = {
      deletedAt: null,
      status: { notIn: [ExpenseReportStatus.DRAFT, ExpenseReportStatus.VOIDED] },
      submittedAt,
    };
    const itemWhere: Prisma.ExpenseReportItemWhereInput = { report: reportWhere };

    const [reports, items, budgets, completedTasks, policyChecks, budgetChecks, duplicateInvoices, unlinkedInvoices, auditCount] =
      await this.prisma.$transaction([
        this.prisma.expenseReport.findMany({
          where: reportWhere,
          select: {
            id: true,
            status: true,
            reimbursableCents: true,
            paidAmountCents: true,
            submittedAt: true,
            department: { select: this.dimensionSelect() },
            costCenter: { select: this.dimensionSelect() },
            project: { select: this.dimensionSelect() },
          },
        }),
        this.prisma.expenseReportItem.findMany({
          where: itemWhere,
          select: {
            amountCents: true,
            reimbursableCents: true,
            department: { select: this.dimensionSelect() },
            costCenter: { select: this.dimensionSelect() },
            project: { select: this.dimensionSelect() },
            report: {
              select: {
                id: true,
                paidAmountCents: true,
                department: { select: this.dimensionSelect() },
                costCenter: { select: this.dimensionSelect() },
                project: { select: this.dimensionSelect() },
              },
            },
          },
        }),
        this.prisma.budget.findMany({
          where: { deletedAt: null },
          orderBy: [{ fiscalPeriod: 'desc' }, { code: 'asc' }],
          take: 100,
          select: {
            id: true,
            code: true,
            name: true,
            fiscalPeriod: true,
            totalCents: true,
            inTransitCents: true,
            approvedCents: true,
            actualCents: true,
            warningThresholdBps: true,
            controlMode: true,
            status: true,
            department: { select: this.dimensionSelect() },
            costCenter: { select: this.dimensionSelect() },
            project: { select: this.dimensionSelect() },
          },
        }),
        this.prisma.expenseApprovalTask.findMany({
          where: { completedAt: { not: null }, createdAt: submittedAt },
          select: { nodeCode: true, nodeName: true, createdAt: true, completedAt: true },
        }),
        this.prisma.expensePolicyCheck.findMany({
          where: { result: { not: ExpensePolicyCheckResult.PASS }, report: reportWhere },
          select: { result: true, message: true },
        }),
        this.prisma.expenseBudgetCheck.findMany({
          where: { result: { not: BudgetCheckResult.PASS }, report: reportWhere },
          select: { result: true, message: true },
        }),
        this.prisma.expenseInvoice.findMany({
          where: { deletedAt: null, duplicateStatus: InvoiceDuplicateStatus.DUPLICATE, report: reportWhere },
          select: { id: true, sellerName: true, totalAmountCents: true },
        }),
        this.prisma.expenseInvoice.findMany({
          where: { deletedAt: null, itemId: null, report: reportWhere },
          select: { id: true, sellerName: true, totalAmountCents: true },
        }),
        this.prisma.systemAuditLog.count({ where: { createdAt: submittedAt } }),
      ]);

    return {
      summary: this.summary(reports, auditCount),
      byDepartment: this.dimensionRows(items, 'department'),
      byCostCenter: this.dimensionRows(items, 'costCenter'),
      byProject: this.dimensionRows(items, 'project'),
      budgetExecution: budgets.map((budget) => {
        const usedCents = budget.inTransitCents + budget.approvedCents + budget.actualCents;
        return {
          ...budget,
          usedCents,
          availableCents: budget.totalCents - usedCents,
          executionBps: budget.totalCents > 0 ? Math.round((usedCents / budget.totalCents) * 10000) : 0,
        };
      }),
      approvalLatency: this.approvalLatency(completedTasks),
      exceptions: {
        policy: this.exceptionRows(policyChecks),
        budget: this.exceptionRows(budgetChecks),
        duplicateInvoiceCount: duplicateInvoices.length,
        duplicateInvoiceAmountCents: duplicateInvoices.reduce((sum, invoice) => sum + invoice.totalAmountCents, 0),
        unlinkedInvoiceCount: unlinkedInvoices.length,
        unlinkedInvoiceAmountCents: unlinkedInvoices.reduce((sum, invoice) => sum + invoice.totalAmountCents, 0),
      },
    };
  }

  async auditChain(user: AuthenticatedUser, query: AuditReportQueryDto): Promise<PageResult<unknown>> {
    this.ensurePermission(user, 'sys:audit:read');
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.SystemAuditLogWhereInput = { createdAt: this.dateRange(query) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.systemAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          actorEmail: true,
          comment: true,
          success: true,
          createdAt: true,
          operator: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.systemAuditLog.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }

  private summary(
    reports: Array<{ id: string; status: ExpenseReportStatus; reimbursableCents: number; paidAmountCents: number }>,
    auditCount: number,
  ) {
    const byStatus = reports.reduce<Record<string, { count: number; reimbursableCents: number }>>((acc, report) => {
      const current = acc[report.status] ?? { count: 0, reimbursableCents: 0 };
      current.count += 1;
      current.reimbursableCents += report.reimbursableCents;
      acc[report.status] = current;
      return acc;
    }, {});
    return {
      reportCount: reports.length,
      reimbursableCents: reports.reduce((sum, report) => sum + report.reimbursableCents, 0),
      paidAmountCents: reports.reduce((sum, report) => sum + report.paidAmountCents, 0),
      pendingPaymentCents: reports.reduce((sum, report) => sum + Math.max(report.reimbursableCents - report.paidAmountCents, 0), 0),
      voucherConfirmedCount: reports.filter((report) => report.status === ExpenseReportStatus.VOUCHER_CONFIRMED).length,
      auditCount,
      byStatus,
    };
  }

  private dimensionRows(items: ReportItemRow[], key: 'department' | 'costCenter' | 'project'): DimensionRow[] {
    const rows = new Map<string, DimensionRow & { reportIds: Set<string> }>();
    items.forEach((item) => {
      const dimension = item[key] ?? item.report[key];
      const id = dimension?.id ?? 'UNASSIGNED';
      const row = rows.get(id) ?? {
        key: id,
        code: dimension?.code ?? '-',
        name: dimension?.name ?? '未分配',
        reportCount: 0,
        itemCount: 0,
        amountCents: 0,
        reimbursableCents: 0,
        paidAmountCents: 0,
        reportIds: new Set<string>(),
      };
      row.itemCount += 1;
      row.amountCents += item.amountCents;
      row.reimbursableCents += item.reimbursableCents;
      if (!row.reportIds.has(item.report.id)) {
        row.reportCount += 1;
        row.paidAmountCents += item.report.paidAmountCents;
        row.reportIds.add(item.report.id);
      }
      rows.set(id, row);
    });
    return [...rows.values()]
      .map((row) => ({
        key: row.key,
        code: row.code,
        name: row.name,
        reportCount: row.reportCount,
        itemCount: row.itemCount,
        amountCents: row.amountCents,
        reimbursableCents: row.reimbursableCents,
        paidAmountCents: row.paidAmountCents,
      }))
      .sort((a, b) => b.reimbursableCents - a.reimbursableCents)
      .slice(0, 20);
  }

  private approvalLatency(tasks: Array<{ nodeCode: string; nodeName: string; createdAt: Date; completedAt: Date | null }>) {
    const rows = new Map<string, { nodeCode: string; nodeName: string; taskCount: number; totalHours: number; maxHours: number }>();
    tasks.forEach((task) => {
      if (!task.completedAt) {
        return;
      }
      const hours = Math.max(0, (task.completedAt.getTime() - task.createdAt.getTime()) / 3_600_000);
      const row = rows.get(task.nodeCode) ?? { nodeCode: task.nodeCode, nodeName: task.nodeName, taskCount: 0, totalHours: 0, maxHours: 0 };
      row.taskCount += 1;
      row.totalHours += hours;
      row.maxHours = Math.max(row.maxHours, hours);
      rows.set(task.nodeCode, row);
    });
    return [...rows.values()].map((row) => ({ ...row, averageHours: row.taskCount ? Math.round((row.totalHours / row.taskCount) * 10) / 10 : 0 }));
  }

  private exceptionRows(rows: Array<{ result: string; message: string }>) {
    const grouped = new Map<string, { result: string; message: string; count: number }>();
    rows.forEach((row) => {
      const key = `${row.result}:${row.message}`;
      const current = grouped.get(key) ?? { result: row.result, message: row.message, count: 0 };
      current.count += 1;
      grouped.set(key, current);
    });
    return [...grouped.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }

  private dateRange(query: ReportQueryDto): Prisma.DateTimeFilter | undefined {
    const range: Prisma.DateTimeFilter = {};
    if (query.startDate) {
      range.gte = this.parseDate(query.startDate, 'startDate');
    }
    if (query.endDate) {
      const end = this.parseDate(query.endDate, 'endDate');
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    return Object.keys(range).length ? range : undefined;
  }

  private parseDate(value: string, label: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${label} is not a valid date.`);
    }
    return date;
  }

  private dimensionSelect() {
    return { id: true, code: true, name: true } satisfies Prisma.DepartmentSelect;
  }

  private ensurePermission(user: AuthenticatedUser, permission: string) {
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenException('Missing report permission.');
    }
  }
}
