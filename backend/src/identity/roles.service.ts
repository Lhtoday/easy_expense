import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PageResult } from '../shared/api-response';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './role.dto';
import { DEFAULT_PERMISSIONS } from './identity.types';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, pageSize = 20, keyword?: string): Promise<PageResult<unknown>> {
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

  async create(dto: CreateRoleDto) {
    await this.ensurePermissions();
    return this.prisma.role.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        permissions: this.permissionCreate(dto.permissionCodes),
        dataScopes: this.dataScopeCreate(dto.dataScopes),
      },
      select: this.roleSelect(),
    });
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.ensureExists(id);
    await this.ensurePermissions();
    return this.prisma.$transaction(async (tx) => {
      if (dto.permissionCodes) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
      }
      if (dto.dataScopes) {
        await tx.dataScope.deleteMany({ where: { roleId: id } });
      }

      return tx.role.update({
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
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.role.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: this.roleSelect(),
    });
  }

  permissions() {
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
    const role = await this.prisma.role.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!role) {
      throw new NotFoundException('角色不存在');
    }
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
      createdAt: true,
      permissions: { select: { permission: { select: { code: true, name: true } } } },
      dataScopes: true,
    } satisfies Prisma.RoleSelect;
  }
}
