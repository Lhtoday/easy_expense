import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentUserGuard, RequestWithUser } from '../identity/current-user.guard';
import { ExpenseReportListQueryDto, SaveExpenseReportDto, SubmitExpenseReportDto } from './expense-report.dto';
import { ExpenseReportsService } from './expense-reports.service';

@Controller('expense-reports')
@UseGuards(CurrentUserGuard)
export class ExpenseReportsController {
  constructor(private readonly service: ExpenseReportsService) {}

  @Get()
  list(@Req() request: RequestWithUser, @Query() query: ExpenseReportListQueryDto) {
    return this.service.list(request.user, query);
  }

  @Get(':id')
  detail(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.detail(request.user, id);
  }

  @Post()
  create(@Req() request: RequestWithUser, @Body() dto: SaveExpenseReportDto) {
    return this.service.create(request.user, dto);
  }

  @Patch(':id')
  update(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: SaveExpenseReportDto) {
    return this.service.update(request.user, id, dto);
  }

  @Post(':id/submit')
  submit(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: SubmitExpenseReportDto) {
    return this.service.submit(request.user, id, dto.comment);
  }

  @Delete(':id')
  remove(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.void(request.user, id);
  }
}
