import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentUserGuard, RequestWithUser } from '../identity/current-user.guard';
import { PaymentReportListQueryDto, RegisterPaymentDto, RegisterPaymentFailureDto } from './payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(CurrentUserGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get('reports')
  listReports(@Req() request: RequestWithUser, @Query() query: PaymentReportListQueryDto) {
    return this.service.listReports(request.user, query);
  }

  @Get('reports/:id')
  getReport(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.getReport(request.user, id);
  }

  @Post('reports/:id/register')
  register(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: RegisterPaymentDto) {
    return this.service.register(request.user, id, dto);
  }

  @Post('reports/:id/fail')
  fail(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: RegisterPaymentFailureDto) {
    return this.service.fail(request.user, id, dto);
  }
}
