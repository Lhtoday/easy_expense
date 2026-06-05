import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentUserGuard, RequestWithUser } from '../identity/current-user.guard';
import { ApprovalTaskListQueryDto, HandleApprovalTaskDto } from './approval.dto';
import { ApprovalsService } from './approvals.service';

@Controller('approvals')
@UseGuards(CurrentUserGuard)
export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}

  @Get('tasks')
  listTasks(@Req() request: RequestWithUser, @Query() query: ApprovalTaskListQueryDto) {
    return this.service.listTasks(request.user, query);
  }

  @Post('tasks/:id/approve')
  approve(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: HandleApprovalTaskDto) {
    return this.service.approve(request.user, id, dto.comment);
  }

  @Post('tasks/:id/reject')
  reject(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: HandleApprovalTaskDto) {
    return this.service.reject(request.user, id, dto.comment);
  }
}
