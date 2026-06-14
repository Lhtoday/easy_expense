import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  ApprovalAction,
  ApprovalInstanceStatus,
  ApprovalTaskStatus,
  ExpenseReportAction,
  ExpenseReportStatus,
  Prisma,
} from '@prisma/client';
import { BudgetsService } from '../budgets/budgets.service';
import { AuthenticatedUser } from '../identity/identity.types';
import { PrismaService } from '../prisma/prisma.service';
import { PageResult } from '../shared/api-response';
import { ApprovalTaskListQueryDto } from './approval.dto';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly budgets?: BudgetsService,
  ) {}

  async listTasks(user: AuthenticatedUser, query: ApprovalTaskListQueryDto): Promise<PageResult<unknown>> {
    this.ensurePermission(user, 'exp:approval:read');
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ExpenseApprovalTaskWhereInput = {
      assigneeId: user.id,
      status: query.status,
      report: query.keyword
        ? {
            OR: [
              { reportNo: { contains: query.keyword, mode: 'insensitive' } },
              { title: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.expenseApprovalTask.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.taskSelect(),
      }),
      this.prisma.expenseApprovalTask.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  approve(user: AuthenticatedUser, taskId: string, comment?: string) {
    return this.handleTask(user, taskId, ApprovalTaskStatus.APPROVED, ExpenseReportStatus.BUSINESS_APPROVED, ExpenseReportAction.APPROVE, comment);
  }

  reject(user: AuthenticatedUser, taskId: string, comment?: string) {
    return this.handleTask(user, taskId, ApprovalTaskStatus.REJECTED, ExpenseReportStatus.REJECTED, ExpenseReportAction.REJECT, comment);
  }

  private async handleTask(
    user: AuthenticatedUser,
    taskId: string,
    taskStatus: ApprovalTaskStatus,
    reportStatus: ExpenseReportStatus,
    reportAction: ExpenseReportAction,
    comment?: string,
  ) {
    this.ensurePermission(user, 'exp:approval:approve');

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.expenseApprovalTask.findFirst({
        where: { id: taskId },
        select: {
          id: true,
          instanceId: true,
          reportId: true,
          assigneeId: true,
          status: true,
          report: { select: { status: true } },
        },
      });

      if (!task) {
        throw new NotFoundException('审批任务不存在');
      }
      if (task.assigneeId !== user.id) {
        throw new ForbiddenException('只能处理分配给自己的审批任务');
      }
      if (task.status !== ApprovalTaskStatus.PENDING || task.report.status !== ExpenseReportStatus.SUBMITTED) {
        throw new BadRequestException('只有待处理的审批任务可以操作');
      }

      const now = new Date();
      await tx.expenseApprovalTask.update({
        where: { id: task.id },
        data: { status: taskStatus, comment, completedAt: now },
      });
      await tx.expenseApprovalInstance.update({
        where: { id: task.instanceId },
        data: {
          status: taskStatus === ApprovalTaskStatus.APPROVED ? ApprovalInstanceStatus.APPROVED : ApprovalInstanceStatus.REJECTED,
          completedAt: now,
        },
      });
      await tx.expenseApprovalLog.create({
        data: {
          instanceId: task.instanceId,
          taskId: task.id,
          operatorId: user.id,
          action: taskStatus === ApprovalTaskStatus.APPROVED ? ApprovalAction.APPROVE : ApprovalAction.REJECT,
          fromStatus: ApprovalTaskStatus.PENDING,
          toStatus: taskStatus,
          comment,
        },
      });
      await tx.expenseReportLog.create({
        data: {
          reportId: task.reportId,
          operatorId: user.id,
          action: reportAction,
          fromStatus: ExpenseReportStatus.SUBMITTED,
          toStatus: reportStatus,
          comment,
        },
      });
      if (this.budgets && taskStatus === ApprovalTaskStatus.REJECTED) {
        await this.budgets.releaseReport(tx, task.reportId, user.id, comment ?? '审批驳回释放预算占用');
      }
      await tx.expenseReport.update({
        where: { id: task.reportId },
        data: { status: reportStatus, updatedById: user.id },
      });

      return tx.expenseApprovalTask.findUnique({ where: { id: task.id }, select: this.taskSelect() });
    });
  }

  private ensurePermission(user: AuthenticatedUser, permission: string) {
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenException('缺少审批操作权限');
    }
  }

  private taskSelect() {
    return {
      id: true,
      nodeCode: true,
      nodeName: true,
      status: true,
      comment: true,
      createdAt: true,
      completedAt: true,
      assignee: { select: { id: true, name: true } },
      report: {
        select: {
          id: true,
          reportNo: true,
          title: true,
          status: true,
          currency: true,
          reimbursableCents: true,
          submittedAt: true,
          applicant: { select: { id: true, name: true, employeeNo: true } },
          department: { select: { id: true, name: true, code: true } },
          costCenter: { select: { id: true, name: true, code: true } },
          project: { select: { id: true, name: true, code: true } },
        },
      },
    } satisfies Prisma.ExpenseApprovalTaskSelect;
  }
}
