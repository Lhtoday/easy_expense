import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentUserGuard, RequestWithUser } from '../identity/current-user.guard';
import { BudgetListQueryDto, CreateBudgetDto, UpdateBudgetDto } from './budget.dto';
import { BudgetsService } from './budgets.service';

@Controller('budgets')
@UseGuards(CurrentUserGuard)
export class BudgetsController {
  constructor(private readonly service: BudgetsService) {}

  @Get()
  list(@Req() request: RequestWithUser, @Query() query: BudgetListQueryDto) {
    return this.service.list(request.user, query);
  }

  @Post()
  create(@Req() request: RequestWithUser, @Body() dto: CreateBudgetDto) {
    return this.service.create(request.user, dto);
  }

  @Post('reconcile-paid-report/:reportId')
  reconcilePaidReport(@Req() request: RequestWithUser, @Param('reportId') reportId: string) {
    return this.service.reconcilePaidReport(request.user, reportId);
  }

  @Patch(':id/enable')
  enable(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.enable(request.user, id);
  }

  @Patch(':id')
  update(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: UpdateBudgetDto) {
    return this.service.update(request.user, id, dto);
  }

  @Delete(':id')
  disable(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.disable(request.user, id);
  }
}
