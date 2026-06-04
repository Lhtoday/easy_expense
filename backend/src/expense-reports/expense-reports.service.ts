import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseReportAction, ExpenseReportStatus, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../identity/identity.types';
import { PrismaService } from '../prisma/prisma.service';
import { PageResult } from '../shared/api-response';
import { ExpenseReportItemDto, ExpenseReportListQueryDto, SaveExpenseReportDto } from './expense-report.dto';

@Injectable()
export class ExpenseReportsService {
  constructor(private readonly prisma: PrismaService) {}

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

      return tx.expenseReport.update({
        where: { id },
        data: {
          status: ExpenseReportStatus.SUBMITTED,
          submittedAt: new Date(),
          updatedById: user.id,
          logs: {
            create: {
              operatorId: user.id,
              action: ExpenseReportAction.SUBMIT,
              fromStatus: ExpenseReportStatus.DRAFT,
              toStatus: ExpenseReportStatus.SUBMITTED,
              comment,
            },
          },
        },
        select: this.detailSelect(),
      });
    });
  }

  async void(user: AuthenticatedUser, id: string) {
    this.ensurePermission(user, 'exp:report:write');

    return this.prisma.$transaction(async (tx) => {
      const existing = await this.ensureEditable(tx, id);
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
    if (report.status !== ExpenseReportStatus.DRAFT) {
      throw new BadRequestException('只有草稿状态的报销单可以编辑或提交');
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
    } satisfies Prisma.ExpenseReportSelect;
  }
}
