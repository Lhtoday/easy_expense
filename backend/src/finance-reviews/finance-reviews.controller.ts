import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentUserGuard, RequestWithUser } from '../identity/current-user.guard';
import { AdjustFinanceReviewItemDto, FinanceReviewListQueryDto, HandleFinanceReviewDto } from './finance-review.dto';
import { FinanceReviewsService } from './finance-reviews.service';

@Controller('finance-reviews')
@UseGuards(CurrentUserGuard)
export class FinanceReviewsController {
  constructor(private readonly service: FinanceReviewsService) {}

  @Get('reports')
  listReports(@Req() request: RequestWithUser, @Query() query: FinanceReviewListQueryDto) {
    return this.service.listReports(request.user, query);
  }

  @Get('reports/:id')
  getReport(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.getReport(request.user, id);
  }

  @Post('reports/:id/approve')
  approve(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: HandleFinanceReviewDto) {
    return this.service.approve(request.user, id, dto.comment);
  }

  @Patch('reports/:id/items/:itemId')
  adjustItem(@Req() request: RequestWithUser, @Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: AdjustFinanceReviewItemDto) {
    return this.service.adjustItem(request.user, id, itemId, dto);
  }

  @Post('reports/:id/return')
  returnSupplement(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: HandleFinanceReviewDto) {
    return this.service.returnSupplement(request.user, id, dto.comment);
  }

  @Post('reports/:id/reject')
  reject(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: HandleFinanceReviewDto) {
    return this.service.reject(request.user, id, dto.comment);
  }
}
