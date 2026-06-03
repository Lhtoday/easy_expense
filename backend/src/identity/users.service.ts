import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PageResult } from '../shared/api-response';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { CreateUserDto, UpdateUserDto } from './user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async list(page = 1, pageSize = 20, keyword?: string): Promise<PageResult<unknown>> {
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

  create(dto: CreateUserDto) {
    return this.prisma.user.create({
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
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.ensureExists(id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
      }

      return tx.user.update({
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
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: this.userSelect(),
    });
  }

  private async ensureExists(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
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
      roles: { select: { role: { select: { id: true, code: true, name: true } } } },
    } satisfies Prisma.UserSelect;
  }
}
