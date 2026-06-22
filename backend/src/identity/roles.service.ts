import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SystemAuditAction } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PageResult } from '../shared/api-response';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './role.dto';
import { AuthenticatedUser, DEFAULT_PERMISSIONS } from './identity.types';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(operator: AuthenticatedUser, page = 1, pageSize = 20, keyword?: string): Promise<PageResult<unknown>> {
    this.ensurePermission(operator, 'iam:role:read');
    await this.ensurePermissions();
    const where: Prisma.RoleWhereInput = {
      deletedAt: null,
      OR: keyword ? [{ code: { contains: keyword, mode: 'insensitive' } }, { name: { contains: keyword, mode: 'insensitive' } }] : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.role.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.roleSelect(),
      }),
      this.prisma.role.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async create(operator: AuthenticatedUser, dto: CreateRoleDto) {
    this.ensurePermission(operator, 'iam:role:write');
    await this.ensurePermissions();
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          permissions: this.permissionCreate(dto.permissionCodes),
          dataScopes: this.dataScopeCreate(dto.dataScopes),
        },
        select: this.roleSelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator,
        action: SystemAuditAction.ROLE_CREATE,
        entityType: 'iam-role',
        entityId: role.id,
        after: this.auditRole(role),
      });
      if (dto.permissionCodes?.length) {
        await this.audit.recordWithClient(tx, {
          operator,
          action: SystemAuditAction.ROLE_PERMISSION_UPDATE,
          entityType: 'iam-role',
          entityId: role.id,
          before: { permissionCodes: [] },
          after: { permissionCodes: dto.permissionCodes },
          comment: 'Assign permissions when creating role.',
        });
      }
      return role;
    });
  }

  async update(operator: AuthenticatedUser, id: string, dto: UpdateRoleDto) {
    this.ensurePermission(operator, 'iam:role:write');
    const before = await this.ensureExists(id);
    await this.ensurePermissions();
    return this.prisma.$transaction(async (tx) => {
      if (dto.permissionCodes) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
      }
      if (dto.dataScopes) {
        await tx.dataScope.deleteMany({ where: { roleId: id } });
      }

      const role = await tx.role.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          status: dto.status,
          permissions: this.permissionCreate(dto.permissionCodes),
          dataScopes: this.dataScopeCreate(dto.dataScopes),
        },
        select: this.roleSelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator,
        action: SystemAuditAction.ROLE_UPDATE,
        entityType: 'iam-role',
        entityId: id,
        before: this.auditRole(before),
        after: this.auditRole(role),
      });
      if (dto.permissionCodes || dto.dataScopes) {
        await this.audit.recordWithClient(tx, {
          operator,
          action: SystemAuditAction.ROLE_PERMISSION_UPDATE,
          entityType: 'iam-role',
          entityId: id,
          before: {
            permissions: before.permissions,
            dataScopes: before.dataScopes,
          },
          after: {
            permissions: role.permissions,
            dataScopes: role.dataScopes,
          },
        });
      }
      return role;
    });
  }

  async remove(operator: AuthenticatedUser, id: string) {
    this.ensurePermission(operator, 'iam:role:write');
    const before = await this.ensureExists(id);
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: this.roleSelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator,
        action: SystemAuditAction.ROLE_DISABLE,
        entityType: 'iam-role',
        entityId: id,
        before: this.auditRole(before),
        after: this.auditRole(role),
      });
      return role;
    });
  }

  permissions(operator: AuthenticatedUser) {
    this.ensurePermission(operator, 'iam:role:read');
    return this.ensurePermissions();
  }

  private async ensurePermissions() {
    await Promise.all(
      DEFAULT_PERMISSIONS.map((permission) =>
        this.prisma.permission.upsert({
          where: { code: permission.code },
          update: permission,
          create: permission,
        }),
      ),
    );
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
  }

  private async ensureExists(id: string) {
    const role = await this.prisma.role.findFirst({ where: { id, deletedAt: null }, select: this.roleSelect() });
    if (!role) {
      throw new NotFoundException('角色不存在');
    }
    return role;
  }

  private ensurePermission(user: AuthenticatedUser, permission: string) {
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenException('缺少角色管理权限');
    }
  }

  private auditRole(role: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    status: string;
    deletedAt?: Date | null;
    permissions: unknown[];
    dataScopes: unknown[];
  }) {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      status: role.status,
      deletedAt: role.deletedAt,
      permissions: role.permissions,
      dataScopes: role.dataScopes,
    };
  }

  private permissionCreate(permissionCodes?: string[]) {
    return permissionCodes?.length
      ? { create: permissionCodes.map((code) => ({ permission: { connect: { code } } })) }
      : undefined;
  }

  private dataScopeCreate(dataScopes?: UpdateRoleDto['dataScopes']) {
    return dataScopes?.length
      ? {
          create: dataScopes.map((scope) => ({
            resource: scope.resource,
            scopeType: scope.scopeType,
            departmentId: scope.departmentId,
            costCenterId: scope.costCenterId,
            projectId: scope.projectId,
          })),
        }
      : undefined;
  }

  private roleSelect() {
    return {
      id: true,
      code: true,
      name: true,
      description: true,
      status: true,
      deletedAt: true,
      createdAt: true,
      permissions: { select: { permission: { select: { code: true, name: true } } } },
      dataScopes: true,
    } satisfies Prisma.RoleSelect;
  }
}
