import { Injectable, NotFoundException } from '@nestjs/common';
import { MasterDataStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PageResult } from '../shared/api-response';
import { CreateCostCenterDto, UpdateCostCenterDto } from './master-data.dto';

@Injectable()
export class CostCentersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, pageSize = 20, keyword?: string): Promise<PageResult<unknown>> {
    const where: Prisma.CostCenterWhereInput = {
      deletedAt: null,
      OR: keyword ? [{ code: { contains: keyword, mode: 'insensitive' } }, { name: { contains: keyword, mode: 'insensitive' } }] : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.costCenter.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.select(),
      }),
      this.prisma.costCenter.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }

  create(dto: CreateCostCenterDto) {
    return this.prisma.costCenter.create({ data: dto, select: this.select() });
  }

  async update(id: string, dto: UpdateCostCenterDto) {
    await this.ensureExists(id);
    return this.prisma.costCenter.update({ where: { id }, data: dto, select: this.select() });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    const referenced = await this.hasReferences(id);
    if (!referenced) {
      return this.prisma.costCenter.delete({ where: { id }, select: this.select() });
    }
    return this.prisma.costCenter.update({ where: { id }, data: { status: MasterDataStatus.DISABLED }, select: this.select() });
  }

  private async hasReferences(id: string) {
    const [users, projects, dataScopes, reports, reportItems, budgets, accountMappings, voucherLines] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { costCenterId: id, deletedAt: null } }),
      this.prisma.project.count({ where: { costCenterId: id, deletedAt: null } }),
      this.prisma.dataScope.count({ where: { costCenterId: id } }),
      this.prisma.expenseReport.count({ where: { costCenterId: id } }),
      this.prisma.expenseReportItem.count({ where: { costCenterId: id } }),
      this.prisma.budget.count({ where: { costCenterId: id } }),
      this.prisma.glAccountMapping.count({ where: { costCenterId: id, deletedAt: null } }),
      this.prisma.glVoucherLine.count({ where: { costCenterId: id } }),
    ]);
    return [users, projects, dataScopes, reports, reportItems, budgets, accountMappings, voucherLines].some((count) => count > 0);
  }

  private async ensureExists(id: string) {
    const item = await this.prisma.costCenter.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!item) {
      throw new NotFoundException('成本中心不存在');
    }
  }

  private select() {
    return {
      id: true,
      code: true,
      name: true,
      departmentId: true,
      status: true,
      createdAt: true,
    } satisfies Prisma.CostCenterSelect;
  }
}
