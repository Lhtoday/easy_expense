import { Injectable } from '@nestjs/common';
import { Prisma, SystemAuditAction } from '@prisma/client';
import { AuthenticatedUser } from '../identity/identity.types';
import { PrismaService } from '../prisma/prisma.service';
import { PageResult } from '../shared/api-response';

type AuditClient = PrismaService | Prisma.TransactionClient;

type AuditInput = {
  operator?: AuthenticatedUser | null;
  operatorId?: string | null;
  actorEmail?: string | null;
  action: SystemAuditAction;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  comment?: string | null;
  success?: boolean;
};

type AuditListQuery = {
  page?: number;
  pageSize?: number;
  action?: SystemAuditAction;
  entityType?: string;
  entityId?: string;
  operatorId?: string;
  success?: boolean;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: AuditInput) {
    return this.recordWithClient(this.prisma, input);
  }

  recordWithClient(client: AuditClient, input: AuditInput) {
    const operatorId = input.operator?.id ?? input.operatorId ?? null;
    const actorEmail = input.operator?.email ?? input.actorEmail ?? null;
    return client.systemAuditLog.create({
      data: {
        operatorId,
        actorEmail,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? undefined,
        beforeData: this.toJson(input.before),
        afterData: this.toJson(input.after),
        metadata: this.toJson(input.metadata),
        comment: input.comment ?? undefined,
        success: input.success ?? true,
      },
    });
  }

  async list(query: AuditListQuery): Promise<PageResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.SystemAuditLogWhereInput = {
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      operatorId: query.operatorId,
      success: query.success,
    };
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
          beforeData: true,
          afterData: true,
          metadata: true,
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

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
