import { Injectable, NotFoundException } from '@nestjs/common';
import { MasterDataStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PageResult } from '../shared/api-response';
import { CreateProjectDto, UpdateProjectDto } from './master-data.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, pageSize = 20, keyword?: string): Promise<PageResult<unknown>> {
    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      OR: keyword ? [{ code: { contains: keyword, mode: 'insensitive' } }, { name: { contains: keyword, mode: 'insensitive' } }] : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.select(),
      }),
      this.prisma.project.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }

  create(dto: CreateProjectDto) {
    return this.prisma.project.create({ data: dto, select: this.select() });
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.ensureExists(id);
    return this.prisma.project.update({ where: { id }, data: dto, select: this.select() });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    const referenced = await this.hasReferences(id);
    if (!referenced) {
      return this.prisma.project.delete({ where: { id }, select: this.select() });
    }
    return this.prisma.project.update({ where: { id }, data: { status: MasterDataStatus.DISABLED }, select: this.select() });
  }

  private async hasReferences(id: string) {
    const [dataScopes, reports, reportItems, budgets, accountMappings, voucherLines] = await this.prisma.$transaction([
      this.prisma.dataScope.count({ where: { projectId: id } }),
      this.prisma.expenseReport.count({ where: { projectId: id } }),
      this.prisma.expenseReportItem.count({ where: { projectId: id } }),
      this.prisma.budget.count({ where: { projectId: id } }),
      this.prisma.glAccountMapping.count({ where: { projectId: id, deletedAt: null } }),
      this.prisma.glVoucherLine.count({ where: { projectId: id } }),
    ]);
    return [dataScopes, reports, reportItems, budgets, accountMappings, voucherLines].some((count) => count > 0);
  }

  private async ensureExists(id: string) {
    const item = await this.prisma.project.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!item) {
      throw new NotFoundException('项目不存在');
    }
  }

  private select() {
    return {
      id: true,
      code: true,
      name: true,
      ownerUserId: true,
      departmentId: true,
      costCenterId: true,
      status: true,
      createdAt: true,
    } satisfies Prisma.ProjectSelect;
  }
}
