import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BudgetAction,
  BudgetCheckResult,
  BudgetControlMode,
  BudgetOccupationStatus,
  BudgetStatus,
  ExpenseReportStatus,
  Prisma,
} from '@prisma/client';
import { AuthenticatedUser } from '../identity/identity.types';
import { PrismaService } from '../prisma/prisma.service';
import { PageResult } from '../shared/api-response';
import { BudgetListQueryDto, CreateBudgetDto, UpdateBudgetDto } from './budget.dto';

type BudgetSnapshot = {
  id: string;
  departmentId: string | null;
  costCenterId: string | null;
  projectId: string | null;
  expenseTypeCode: string | null;
  accountSubjectCode: string | null;
  totalCents: number;
  inTransitCents: number;
  approvedCents: number;
  actualCents: number;
  controlMode: BudgetControlMode;
  warningThresholdBps: number;
};

type ReportBudgetItem = {
  id: string;
  occurredAt: Date;
  departmentId: string | null;
  costCenterId: string | null;
  projectId: string | null;
  expenseTypeCode: string;
  accountSubjectCode: string | null;
  reimbursableCents: number;
};

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, query: BudgetListQueryDto): Promise<PageResult<unknown>> {
    this.ensurePermission(user, 'exp:budget:read');
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.BudgetWhereInput = {
      fiscalPeriod: query.fiscalPeriod,
      status: query.status,
      OR: query.keyword
        ? [{ code: { contains: query.keyword, mode: 'insensitive' } }, { name: { contains: query.keyword, mode: 'insensitive' } }]
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.budget.findMany({
        where,
        orderBy: [{ fiscalPeriod: 'desc' }, { code: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.budgetSelect(),
      }),
      this.prisma.budget.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }

  create(user: AuthenticatedUser, dto: CreateBudgetDto) {
    this.ensurePermission(user, 'exp:budget:write');
    this.validateBudgetAmount(dto.totalCents);
    return this.prisma.budget.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name,
        fiscalPeriod: dto.fiscalPeriod,
        departmentId: dto.departmentId,
        costCenterId: dto.costCenterId,
        projectId: dto.projectId,
        expenseTypeCode: dto.expenseTypeCode?.trim().toUpperCase(),
        accountSubjectCode: dto.accountSubjectCode?.trim(),
        currency: dto.currency ?? 'CNY',
        totalCents: dto.totalCents,
        warningThresholdBps: dto.warningThresholdBps ?? 9000,
        controlMode: dto.controlMode ?? BudgetControlMode.WARNING,
        createdById: user.id,
      },
      select: this.budgetSelect(),
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateBudgetDto) {
    this.ensurePermission(user, 'exp:budget:write');
    const existing = await this.prisma.budget.findFirst({ where: { id, deletedAt: null }, select: { id: true, totalCents: true } });
    if (!existing) {
      throw new NotFoundException('预算不存在');
    }
    if (dto.totalCents !== undefined) {
      this.validateBudgetAmount(dto.totalCents);
    }
    return this.prisma.budget.update({
      where: { id },
      data: {
        name: dto.name,
        departmentId: dto.departmentId,
        costCenterId: dto.costCenterId,
        projectId: dto.projectId,
        expenseTypeCode: dto.expenseTypeCode?.trim().toUpperCase(),
        accountSubjectCode: dto.accountSubjectCode?.trim(),
        totalCents: dto.totalCents,
        warningThresholdBps: dto.warningThresholdBps,
        controlMode: dto.controlMode,
        status: dto.status,
        updatedById: user.id,
      },
      select: this.budgetSelect(),
    });
  }

  disable(user: AuthenticatedUser, id: string) {
    this.ensurePermission(user, 'exp:budget:write');
    return this.prisma.budget.update({
      where: { id },
      data: { status: BudgetStatus.DISABLED, updatedById: user.id },
      select: this.budgetSelect(),
    });
  }

  enable(user: AuthenticatedUser, id: string) {
    this.ensurePermission(user, 'exp:budget:write');
    return this.prisma.budget.update({
      where: { id },
      data: { status: BudgetStatus.ACTIVE, deletedAt: null, updatedById: user.id },
      select: this.budgetSelect(),
    });
  }

  async reconcilePaidReport(user: AuthenticatedUser, reportId: string) {
    this.ensurePermission(user, 'exp:budget:write');

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.expenseReport.findFirst({
        where: { id: reportId, deletedAt: null },
        select: {
          id: true,
          reportNo: true,
          status: true,
          currency: true,
          paidAmountCents: true,
          items: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              occurredAt: true,
              departmentId: true,
              costCenterId: true,
              projectId: true,
              expenseTypeCode: true,
              accountSubjectCode: true,
              reimbursableCents: true,
            },
          },
        },
      });
      if (!report) {
        throw new NotFoundException('鎶ラ攢鍗曚笉瀛樺湪');
      }
      if (report.status !== ExpenseReportStatus.PAID) {
        throw new BadRequestException('Only paid reports can be reconciled into budget actual amount.');
      }
      if (report.paidAmountCents <= 0) {
        throw new BadRequestException('Paid report has no paid amount to reconcile.');
      }

      await this.transferActual(tx, reportId, user.id, report.paidAmountCents);
      const actualOccupations = await tx.budgetOccupation.findMany({
        where: { reportId, status: BudgetOccupationStatus.ACTUAL },
        select: { itemId: true, actualCents: true },
      });
      const actualItemIds = new Set(actualOccupations.filter((occupation) => occupation.actualCents > 0).map((occupation) => occupation.itemId));
      const reconciled: Array<{ itemId: string; budgetId: string; amountCents: number }> = [];
      const skipped: Array<{ itemId: string; reason: string }> = [];

      for (const item of report.items) {
        if (item.reimbursableCents <= 0) {
          skipped.push({ itemId: item.id, reason: 'Item has no reimbursable amount.' });
          continue;
        }
        if (actualItemIds.has(item.id)) {
          skipped.push({ itemId: item.id, reason: 'Item already has actual budget occupation.' });
          continue;
        }

        const period = this.periodOf(item.occurredAt);
        const budget = await this.resolveBudget(tx, item, period, report.currency);
        if (!budget) {
          await tx.expenseBudgetCheck.create({
            data: {
              reportId,
              itemId: item.id,
              result: BudgetCheckResult.WARNING,
              message: `${period} has no matching active budget for paid-report actual reconciliation.`,
            },
          });
          skipped.push({ itemId: item.id, reason: 'No matching active budget.' });
          continue;
        }

        await this.lockBudget(tx, budget.id);
        const locked = await tx.budget.findUniqueOrThrow({ where: { id: budget.id }, select: this.budgetSnapshotSelect() });
        const occupation = await tx.budgetOccupation.create({
          data: {
            budgetId: locked.id,
            reportId,
            itemId: item.id,
            status: BudgetOccupationStatus.ACTUAL,
            fiscalPeriod: period,
            departmentId: item.departmentId,
            costCenterId: item.costCenterId,
            projectId: item.projectId,
            expenseTypeCode: item.expenseTypeCode,
            accountSubjectCode: item.accountSubjectCode,
            currency: report.currency,
            occupiedCents: 0,
            actualCents: item.reimbursableCents,
          },
          select: { id: true },
        });
        await this.adjustBudget(
          tx,
          locked,
          occupation.id,
          user.id,
          BudgetAction.ADJUST,
          0,
          0,
          item.reimbursableCents,
          `Backfill paid report ${report.reportNo} into budget actual amount.`,
        );
        reconciled.push({ itemId: item.id, budgetId: locked.id, amountCents: item.reimbursableCents });
      }

      return {
        reportId,
        reportNo: report.reportNo,
        reconciled,
        skipped,
      };
    });
  }

  async occupyOnSubmit(tx: Prisma.TransactionClient, reportId: string, operatorId: string) {
    await this.releaseReport(tx, reportId, operatorId, '重新提交前释放已有预算占用');
    await tx.expenseBudgetCheck.deleteMany({ where: { reportId } });

    const report = await tx.expenseReport.findFirst({
      where: { id: reportId, deletedAt: null },
      select: {
        id: true,
        currency: true,
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            occurredAt: true,
            departmentId: true,
            costCenterId: true,
            projectId: true,
            expenseTypeCode: true,
            accountSubjectCode: true,
            reimbursableCents: true,
          },
        },
      },
    });
    if (!report) {
      throw new NotFoundException('报销单不存在');
    }

    const checks: Prisma.ExpenseBudgetCheckCreateManyInput[] = [];
    for (const item of report.items) {
      const period = this.periodOf(item.occurredAt);
      const budget = await this.resolveBudget(tx, item, period, report.currency);
      if (!budget) {
        checks.push({
          reportId,
          itemId: item.id,
          result: BudgetCheckResult.WARNING,
          message: `${period} 未配置匹配预算，系统记录提醒但不阻断提交`,
        });
        continue;
      }

      await this.lockBudget(tx, budget.id);
      const locked = await tx.budget.findUniqueOrThrow({ where: { id: budget.id }, select: this.budgetSnapshotSelect() });
      const available = locked.totalCents - locked.inTransitCents - locked.approvedCents - locked.actualCents;
      if (available < item.reimbursableCents && locked.controlMode === BudgetControlMode.BLOCK) {
        checks.push({
          reportId,
          itemId: item.id,
          budgetId: locked.id,
          result: BudgetCheckResult.BLOCK,
          message: `${period} 预算不足：可用 ${this.formatMoney(available)}，本次占用 ${this.formatMoney(item.reimbursableCents)}`,
        });
        continue;
      }

      const occupation = await tx.budgetOccupation.create({
        data: {
          budgetId: locked.id,
          reportId,
          itemId: item.id,
          fiscalPeriod: period,
          departmentId: item.departmentId,
          costCenterId: item.costCenterId,
          projectId: item.projectId,
          expenseTypeCode: item.expenseTypeCode,
          accountSubjectCode: item.accountSubjectCode,
          currency: report.currency,
          occupiedCents: item.reimbursableCents,
        },
        select: { id: true },
      });
      await this.adjustBudget(tx, locked, occupation.id, operatorId, BudgetAction.OCCUPY_IN_TRANSIT, item.reimbursableCents, 0, 0, '提交报销单占用在途预算');

      const nextAvailable = available - item.reimbursableCents;
      const result = available < item.reimbursableCents ? BudgetCheckResult.WARNING : BudgetCheckResult.PASS;
      const thresholdAmount = Math.floor((locked.totalCents * locked.warningThresholdBps) / 10000);
      const thresholdWarning = locked.totalCents - nextAvailable >= thresholdAmount;
      checks.push({
        reportId,
        itemId: item.id,
        budgetId: locked.id,
        result: result === BudgetCheckResult.PASS && thresholdWarning ? BudgetCheckResult.WARNING : result,
        message:
          result === BudgetCheckResult.WARNING
            ? `${period} 预算超额提醒：可用 ${this.formatMoney(available)}，本次占用 ${this.formatMoney(item.reimbursableCents)}`
            : thresholdWarning
              ? `${period} 预算使用率达到预警阈值`
              : `${period} 预算检查通过`,
      });
    }

    if (checks.length) {
      await tx.expenseBudgetCheck.createMany({ data: checks });
    }

    const blocking = checks.filter((check) => check.result === BudgetCheckResult.BLOCK);
    if (blocking.length) {
      throw new BadRequestException(blocking.map((check) => check.message).join('；'));
    }
  }

  async releaseReport(tx: Prisma.TransactionClient, reportId: string, operatorId: string, comment: string) {
    const occupations = await tx.budgetOccupation.findMany({
      where: { reportId, status: { in: [BudgetOccupationStatus.IN_TRANSIT, BudgetOccupationStatus.APPROVED] } },
      select: {
        id: true,
        budgetId: true,
        status: true,
        occupiedCents: true,
        approvedCents: true,
      },
    });

    for (const occupation of occupations) {
      await this.lockBudget(tx, occupation.budgetId);
      const budget = await tx.budget.findUniqueOrThrow({ where: { id: occupation.budgetId }, select: this.budgetSnapshotSelect() });
      const inTransitDelta = occupation.status === BudgetOccupationStatus.IN_TRANSIT ? -occupation.occupiedCents : 0;
      const approvedDelta = occupation.status === BudgetOccupationStatus.APPROVED ? -occupation.approvedCents : 0;
      await this.adjustBudget(tx, budget, occupation.id, operatorId, BudgetAction.RELEASE, inTransitDelta, approvedDelta, 0, comment);
      await tx.budgetOccupation.update({
        where: { id: occupation.id },
        data: {
          status: BudgetOccupationStatus.RELEASED,
          releasedCents: occupation.status === BudgetOccupationStatus.APPROVED ? occupation.approvedCents : occupation.occupiedCents,
          releasedAt: new Date(),
        },
      });
    }
  }

  async confirmApproved(tx: Prisma.TransactionClient, reportId: string, operatorId: string) {
    const occupations = await tx.budgetOccupation.findMany({
      where: { reportId, status: BudgetOccupationStatus.IN_TRANSIT },
      select: { id: true, budgetId: true, occupiedCents: true },
    });

    for (const occupation of occupations) {
      await this.lockBudget(tx, occupation.budgetId);
      const budget = await tx.budget.findUniqueOrThrow({ where: { id: occupation.budgetId }, select: this.budgetSnapshotSelect() });
      await this.adjustBudget(
        tx,
        budget,
        occupation.id,
        operatorId,
        BudgetAction.CONFIRM_APPROVED,
        -occupation.occupiedCents,
        occupation.occupiedCents,
        0,
        '审批通过后确认预算占用',
      );
      await tx.budgetOccupation.update({
        where: { id: occupation.id },
        data: { status: BudgetOccupationStatus.APPROVED, approvedCents: occupation.occupiedCents },
      });
    }
  }

  async transferActual(tx: Prisma.TransactionClient, reportId: string, operatorId: string, paidAmountCents?: number) {
    const occupations = await tx.budgetOccupation.findMany({
      where: { reportId, status: BudgetOccupationStatus.APPROVED },
      orderBy: { createdAt: 'asc' },
      select: { id: true, budgetId: true, approvedCents: true },
    });
    let remaining = paidAmountCents;

    for (const occupation of occupations) {
      const amount = remaining === undefined ? occupation.approvedCents : Math.min(occupation.approvedCents, Math.max(remaining, 0));
      if (amount <= 0) {
        continue;
      }
      remaining = remaining === undefined ? undefined : remaining - amount;
      await this.lockBudget(tx, occupation.budgetId);
      const budget = await tx.budget.findUniqueOrThrow({ where: { id: occupation.budgetId }, select: this.budgetSnapshotSelect() });
      await this.adjustBudget(tx, budget, occupation.id, operatorId, BudgetAction.TRANSFER_ACTUAL, 0, -amount, amount, '付款后转为实际发生');
      await tx.budgetOccupation.update({
        where: { id: occupation.id },
        data: { status: BudgetOccupationStatus.ACTUAL, approvedCents: occupation.approvedCents - amount, actualCents: amount },
      });
    }
  }

  private async resolveBudget(tx: Prisma.TransactionClient, item: ReportBudgetItem, fiscalPeriod: string, currency: string) {
    const candidates = await tx.budget.findMany({
      where: {
        deletedAt: null,
        status: BudgetStatus.ACTIVE,
        fiscalPeriod,
        currency,
        OR: [{ departmentId: item.departmentId }, { departmentId: null }],
        AND: [
          { OR: [{ costCenterId: item.costCenterId }, { costCenterId: null }] },
          { OR: [{ projectId: item.projectId }, { projectId: null }] },
          { OR: [{ expenseTypeCode: item.expenseTypeCode }, { expenseTypeCode: null }] },
          { OR: [{ accountSubjectCode: item.accountSubjectCode }, { accountSubjectCode: null }] },
        ],
      },
      select: this.budgetSnapshotSelect(),
    });
    return candidates.sort((left, right) => this.budgetSpecificity(right) - this.budgetSpecificity(left))[0] ?? null;
  }

  private budgetSpecificity(budget: BudgetSnapshot) {
    const dimensions = ['departmentId', 'costCenterId', 'projectId', 'expenseTypeCode', 'accountSubjectCode'] as const;
    return dimensions.reduce((score, dimension) => score + (budget[dimension] ? 1 : 0), 0);
  }

  private async lockBudget(tx: Prisma.TransactionClient, budgetId: string) {
    await tx.$queryRaw`SELECT id FROM "bud_budgets" WHERE id = ${budgetId} FOR UPDATE`;
  }

  private async adjustBudget(
    tx: Prisma.TransactionClient,
    budget: BudgetSnapshot,
    occupationId: string | null,
    operatorId: string,
    action: BudgetAction,
    inTransitDelta: number,
    approvedDelta: number,
    actualDelta: number,
    comment: string,
  ) {
    const afterInTransit = budget.inTransitCents + inTransitDelta;
    const afterApproved = budget.approvedCents + approvedDelta;
    const afterActual = budget.actualCents + actualDelta;
    if (afterInTransit < 0 || afterApproved < 0 || afterActual < 0) {
      throw new BadRequestException('预算占用释放金额异常，请刷新后重试');
    }

    await tx.budget.update({
      where: { id: budget.id },
      data: {
        inTransitCents: afterInTransit,
        approvedCents: afterApproved,
        actualCents: afterActual,
      },
    });
    await tx.budgetOperationLog.create({
      data: {
        budgetId: budget.id,
        occupationId,
        operatorId,
        action,
        amountCents: Math.abs(inTransitDelta || approvedDelta || actualDelta),
        beforeInTransitCents: budget.inTransitCents,
        afterInTransitCents: afterInTransit,
        beforeApprovedCents: budget.approvedCents,
        afterApprovedCents: afterApproved,
        beforeActualCents: budget.actualCents,
        afterActualCents: afterActual,
        comment,
      },
    });
  }

  private validateBudgetAmount(totalCents: number) {
    if (!Number.isInteger(totalCents) || totalCents < 0) {
      throw new BadRequestException('预算金额必须为非负整数分');
    }
  }

  private periodOf(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private formatMoney(cents: number) {
    return `${(cents / 100).toFixed(2)} 元`;
  }

  private ensurePermission(user: AuthenticatedUser, permission: string) {
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenException('缺少预算操作权限');
    }
  }

  private budgetSnapshotSelect() {
    return {
      id: true,
      departmentId: true,
      costCenterId: true,
      projectId: true,
      expenseTypeCode: true,
      accountSubjectCode: true,
      totalCents: true,
      inTransitCents: true,
      approvedCents: true,
      actualCents: true,
      controlMode: true,
      warningThresholdBps: true,
    } satisfies Prisma.BudgetSelect;
  }

  private budgetSelect() {
    return {
      id: true,
      code: true,
      name: true,
      fiscalPeriod: true,
      departmentId: true,
      costCenterId: true,
      projectId: true,
      expenseTypeCode: true,
      accountSubjectCode: true,
      currency: true,
      totalCents: true,
      inTransitCents: true,
      approvedCents: true,
      actualCents: true,
      warningThresholdBps: true,
      controlMode: true,
      status: true,
      createdAt: true,
      department: { select: { id: true, code: true, name: true } },
      costCenter: { select: { id: true, code: true, name: true } },
      project: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
      logs: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          action: true,
          amountCents: true,
          beforeInTransitCents: true,
          afterInTransitCents: true,
          beforeApprovedCents: true,
          afterApprovedCents: true,
          beforeActualCents: true,
          afterActualCents: true,
          comment: true,
          createdAt: true,
          operator: { select: { id: true, name: true } },
        },
      },
    } satisfies Prisma.BudgetSelect;
  }
}
