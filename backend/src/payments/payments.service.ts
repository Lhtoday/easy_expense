import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ExpenseReportAction,
  ExpenseReportStatus,
  PaymentBatchStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { BudgetsService } from '../budgets/budgets.service';
import { AuthenticatedUser } from '../identity/identity.types';
import { PrismaService } from '../prisma/prisma.service';
import { PageResult } from '../shared/api-response';
import { PaymentReportListQueryDto, RegisterPaymentDto, RegisterPaymentFailureDto } from './payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budgets: BudgetsService,
  ) {}

  async listReports(user: AuthenticatedUser, query: PaymentReportListQueryDto): Promise<PageResult<unknown>> {
    this.ensurePermission(user, 'exp:payment:read');
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ExpenseReportWhereInput = {
      deletedAt: null,
      status: query.status ?? { in: [ExpenseReportStatus.FINANCE_APPROVED, ExpenseReportStatus.PAID] },
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
        select: this.reportSelect(),
      }),
      this.prisma.expenseReport.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async getReport(user: AuthenticatedUser, reportId: string) {
    this.ensurePermission(user, 'exp:payment:read');
    const report = await this.prisma.expenseReport.findFirst({
      where: { id: reportId, deletedAt: null },
      select: this.reportSelect(),
    });
    if (!report) {
      throw new NotFoundException('Payment report does not exist.');
    }
    return report;
  }

  register(user: AuthenticatedUser, reportId: string, dto: RegisterPaymentDto) {
    this.ensurePermission(user, 'exp:payment:pay');

    return this.prisma.$transaction(async (tx) => {
      const report = await this.ensurePayable(tx, reportId);
      const remainingCents = report.reimbursableCents - report.paidAmountCents;
      if (dto.amountCents !== remainingCents) {
        throw new BadRequestException('Payment amount must equal the remaining payable amount in Phase 8 MVP.');
      }

      const batch = await tx.expensePaymentBatch.create({
        data: {
          batchNo: await this.nextBatchNo(tx),
          name: `${report.reportNo} payment`,
          status: PaymentBatchStatus.COMPLETED,
          totalAmountCents: dto.amountCents,
          currency: report.currency,
          operatorId: user.id,
          comment: dto.comment,
          completedAt: new Date(),
          reportId,
        },
        select: { id: true },
      });

      const toStatus = ExpenseReportStatus.PAID;
      const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
      await tx.expensePayment.create({
        data: {
          reportId,
          batchId: batch.id,
          operatorId: user.id,
          status: PaymentStatus.SUCCESS,
          method: dto.method ?? PaymentMethod.BANK_TRANSFER,
          amountCents: dto.amountCents,
          currency: report.currency,
          paidAt,
          paymentReference: this.optionalString(dto.paymentReference),
          payerAccount: this.optionalString(dto.payerAccount),
          payeeAccount: this.optionalString(dto.payeeAccount),
          comment: dto.comment,
          fromStatus: report.status,
          toStatus,
        },
      });
      await tx.expenseReportLog.create({
        data: {
          reportId,
          operatorId: user.id,
          action: ExpenseReportAction.PAYMENT_REGISTER,
          fromStatus: report.status,
          toStatus,
          comment: dto.comment ?? `Payment registered: ${dto.amountCents} cents.`,
        },
      });
      await this.budgets.transferActual(tx, reportId, user.id, dto.amountCents);

      return tx.expenseReport.update({
        where: { id: reportId },
        data: {
          status: toStatus,
          paidAmountCents: report.paidAmountCents + dto.amountCents,
          updatedById: user.id,
        },
        select: this.reportSelect(),
      });
    });
  }

  fail(user: AuthenticatedUser, reportId: string, dto: RegisterPaymentFailureDto) {
    this.ensurePermission(user, 'exp:payment:pay');

    return this.prisma.$transaction(async (tx) => {
      const report = await this.ensurePayable(tx, reportId);
      const remainingCents = report.reimbursableCents - report.paidAmountCents;
      if (dto.amountCents > remainingCents) {
        throw new BadRequestException('Failed payment amount cannot exceed the remaining payable amount.');
      }

      const batch = await tx.expensePaymentBatch.create({
        data: {
          batchNo: await this.nextBatchNo(tx),
          name: `${report.reportNo} failed payment`,
          status: PaymentBatchStatus.PARTIAL_FAILED,
          totalAmountCents: dto.amountCents,
          currency: report.currency,
          operatorId: user.id,
          comment: dto.comment ?? dto.failureReason,
          completedAt: new Date(),
          reportId,
        },
        select: { id: true },
      });

      await tx.expensePayment.create({
        data: {
          reportId,
          batchId: batch.id,
          operatorId: user.id,
          status: PaymentStatus.FAILED,
          method: dto.method ?? PaymentMethod.BANK_TRANSFER,
          amountCents: dto.amountCents,
          currency: report.currency,
          paymentReference: this.optionalString(dto.paymentReference),
          failureReason: dto.failureReason,
          comment: dto.comment,
          fromStatus: report.status,
          toStatus: report.status,
        },
      });
      await tx.expenseReportLog.create({
        data: {
          reportId,
          operatorId: user.id,
          action: ExpenseReportAction.PAYMENT_FAIL,
          fromStatus: report.status,
          toStatus: report.status,
          comment: dto.comment ?? dto.failureReason,
        },
      });

      return tx.expenseReport.findUnique({ where: { id: reportId }, select: this.reportSelect() });
    });
  }

  private async ensurePayable(tx: Prisma.TransactionClient, reportId: string) {
    const report = await tx.expenseReport.findFirst({
      where: { id: reportId, deletedAt: null },
      select: {
        id: true,
        reportNo: true,
        status: true,
        currency: true,
        reimbursableCents: true,
        paidAmountCents: true,
      },
    });
    if (!report) {
      throw new NotFoundException('Payment report does not exist.');
    }
    if (report.status !== ExpenseReportStatus.FINANCE_APPROVED) {
      throw new BadRequestException('Only finance-approved reports can be paid.');
    }
    if (report.reimbursableCents <= report.paidAmountCents) {
      throw new BadRequestException('This report has no remaining payable amount.');
    }
    return report;
  }

  private async nextBatchNo(tx: Prisma.TransactionClient) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const prefix = `PAY${year}${month}${day}`;
    const count = await tx.expensePaymentBatch.count({ where: { batchNo: { startsWith: prefix } } });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private optionalString(value?: string) {
    const trimmed = value?.trim();
    return trimmed || undefined;
  }

  private ensurePermission(user: AuthenticatedUser, permission: string) {
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenException('Missing payment permission.');
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
      attachments: {
        where: { deletedAt: null, category: 'PAYMENT_PROOF' },
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
