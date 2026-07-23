import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentUserGuard, RequestWithUser } from '../identity/current-user.guard';
import { AuditReportQueryDto, ReportQueryDto } from './report.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(CurrentUserGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  dashboard(@Req() request: RequestWithUser, @Query() query: ReportQueryDto) {
    return this.reports.dashboard(request.user, query);
  }

  @Get('audit-chain')
  auditChain(@Req() request: RequestWithUser, @Query() query: AuditReportQueryDto) {
    return this.reports.auditChain(request.user, query);
  }
}
