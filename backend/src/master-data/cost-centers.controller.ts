import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUserGuard } from '../identity/current-user.guard';
import { CostCentersService } from './cost-centers.service';
import { CreateCostCenterDto, UpdateCostCenterDto } from './master-data.dto';

@Controller('cost-centers')
@UseGuards(CurrentUserGuard)
export class CostCentersController {
  constructor(private readonly service: CostCentersService) {}

  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('keyword') keyword?: string) {
    return this.service.list(Number(page ?? 1), Number(pageSize ?? 20), keyword);
  }

  @Post()
  create(@Body() dto: CreateCostCenterDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCostCenterDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
