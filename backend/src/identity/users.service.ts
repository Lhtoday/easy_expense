import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SystemAuditAction } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PageResult } from '../shared/api-response';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './identity.types';
import { CreateUserDto, UpdateUserDto } from './user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly audit: AuditService,
  ) {}

  async list(operator: AuthenticatedUser, page = 1, pageSize = 20, keyword?: string): Promise<PageResult<unknown>> {
    this.ensurePermission(operator, 'iam:user:read');
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      OR: keyword ? [{ name: { contains: keyword, mode: 'insensitive' } }, { email: { contains: keyword, mode: 'insensitive' } }] : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.userSelect(),
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  create(operator: AuthenticatedUser, dto: CreateUserDto) {
    this.ensurePermission(operator, 'iam:user:write');
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          employeeNo: dto.employeeNo,
          email: dto.email,
          name: dto.name,
          passwordHash: this.authService.hashPassword(dto.password),
          departmentId: dto.departmentId,
          costCenterId: dto.costCenterId,
          roles: dto.roleIds?.length ? { create: dto.roleIds.map((roleId) => ({ roleId })) } : undefined,
        },
        select: this.userSelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator,
        action: SystemAuditAction.USER_CREATE,
        entityType: 'iam-user',
        entityId: user.id,
        after: this.auditUser(user),
      });
      if (dto.roleIds?.length) {
        await this.audit.recordWithClient(tx, {
          operator,
          action: SystemAuditAction.USER_ROLE_UPDATE,
          entityType: 'iam-user',
          entityId: user.id,
          before: { roleIds: [] },
          after: { roleIds: dto.roleIds, roles: user.roles },
          comment: 'Assign roles when creating user.',
        });
      }
      return user;
    });
  }

  async update(operator: AuthenticatedUser, id: string, dto: UpdateUserDto) {
    this.ensurePermission(operator, 'iam:user:write');
    const before = await this.ensureExists(id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
      }

      const user = await tx.user.update({
        where: { id },
        data: {
          email: dto.email,
          name: dto.name,
          passwordHash: dto.password ? this.authService.hashPassword(dto.password) : undefined,
          status: dto.status,
          departmentId: dto.departmentId,
          costCenterId: dto.costCenterId,
          roles: dto.roleIds ? { create: dto.roleIds.map((roleId) => ({ roleId })) } : undefined,
        },
        select: this.userSelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator,
        action: SystemAuditAction.USER_UPDATE,
        entityType: 'iam-user',
        entityId: id,
        before: this.auditUser(before),
        after: this.auditUser(user),
      });
      if (dto.roleIds) {
        await this.audit.recordWithClient(tx, {
          operator,
          action: SystemAuditAction.USER_ROLE_UPDATE,
          entityType: 'iam-user',
          entityId: id,
          before: { roles: before.roles },
          after: { roles: user.roles },
        });
      }
      return user;
    });
  }

  async remove(operator: AuthenticatedUser, id: string) {
    this.ensurePermission(operator, 'iam:user:write');
    const before = await this.ensureExists(id);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: this.userSelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator,
        action: SystemAuditAction.USER_DISABLE,
        entityType: 'iam-user',
        entityId: id,
        before: this.auditUser(before),
        after: this.auditUser(user),
      });
      return user;
    });
  }

  private async ensureExists(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: this.userSelect() });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }

  private ensurePermission(user: AuthenticatedUser, permission: string) {
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenException('缺少用户管理权限');
    }
  }

  private auditUser(data: {
    id: string;
    employeeNo: string;
    email: string;
    name: string;
    status: string;
    departmentId: string | null;
    costCenterId: string | null;
    deletedAt?: Date | null;
    roles: unknown[];
  }) {
    return {
      id: data.id,
      employeeNo: data.employeeNo,
      email: data.email,
      name: data.name,
      status: data.status,
      departmentId: data.departmentId,
      costCenterId: data.costCenterId,
      deletedAt: data.deletedAt,
      roles: data.roles,
    };
  }

  private userSelect() {
    return {
      id: true,
      employeeNo: true,
      email: true,
      name: true,
      status: true,
      departmentId: true,
      costCenterId: true,
      createdAt: true,
      deletedAt: true,
      roles: { select: { role: { select: { id: true, code: true, name: true } } } },
    } satisfies Prisma.UserSelect;
  }
}
