import { Injectable, NotFoundException } from '@nestjs/common';
import { MasterDataStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PageResult } from '../shared/api-response';
import { CreateDepartmentDto, UpdateDepartmentDto } from './master-data.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, pageSize = 20, keyword?: string): Promise<PageResult<unknown>> {
    const where: Prisma.DepartmentWhereInput = {
      deletedAt: null,
      OR: keyword ? [{ code: { contains: keyword, mode: 'insensitive' } }, { name: { contains: keyword, mode: 'insensitive' } }] : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.department.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.select(),
      }),
      this.prisma.department.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }

  create(dto: CreateDepartmentDto) {
    return this.prisma.department.create({ data: dto, select: this.select() });
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.ensureExists(id);
    return this.prisma.department.update({ where: { id }, data: dto, select: this.select() });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    const referenced = await this.hasReferences(id);
    if (!referenced) {
      return this.prisma.department.delete({ where: { id }, select: this.select() });
    }
    return this.prisma.department.update({ where: { id }, data: { status: MasterDataStatus.DISABLED }, select: this.select() });
  }

  private async hasReferences(id: string) {
    const [
      childDepartments,
      users,
      costCenters,
      projects,
      dataScopes,
      reports,
      reportItems,
      budgets,
      accountMappings,
      voucherLines,
    ] = await this.prisma.$transaction([
      this.prisma.department.count({ where: { parentId: id, deletedAt: null } }),
      this.prisma.user.count({ where: { departmentId: id, deletedAt: null } }),
      this.prisma.costCenter.count({ where: { departmentId: id, deletedAt: null } }),
      this.prisma.project.count({ where: { departmentId: id, deletedAt: null } }),
      this.prisma.dataScope.count({ where: { departmentId: id } }),
      this.prisma.expenseReport.count({ where: { departmentId: id } }),
      this.prisma.expenseReportItem.count({ where: { departmentId: id } }),
      this.prisma.budget.count({ where: { departmentId: id } }),
      this.prisma.glAccountMapping.count({ where: { departmentId: id, deletedAt: null } }),
      this.prisma.glVoucherLine.count({ where: { departmentId: id } }),
    ]);
    return [childDepartments, users, costCenters, projects, dataScopes, reports, reportItems, budgets, accountMappings, voucherLines].some(
      (count) => count > 0,
    );
  }

  private async ensureExists(id: string) {
    const item = await this.prisma.department.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!item) {
      throw new NotFoundException('部门不存在');
    }
  }

  private select() {
    return {
      id: true,
      code: true,
      name: true,
      parentId: true,
      status: true,
      createdAt: true,
    } satisfies Prisma.DepartmentSelect;
  }
}
