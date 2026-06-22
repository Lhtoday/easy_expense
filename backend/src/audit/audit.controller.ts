import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { SystemAuditAction } from '@prisma/client';
import { CurrentUserGuard, RequestWithUser } from '../identity/current-user.guard';
import { AuditService } from './audit.service';

@Controller('audit-logs')
@UseGuards(CurrentUserGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Req() request: RequestWithUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('action') action?: SystemAuditAction,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('operatorId') operatorId?: string,
    @Query('success') success?: string,
  ) {
    if (!request.user.permissions.includes('sys:audit:read')) {
      throw new ForbiddenException('缺少系统审计查看权限');
    }
    return this.audit.list({
      page: Number(page ?? 1),
      pageSize: Number(pageSize ?? 20),
      action,
      entityType,
      entityId,
      operatorId,
      success: success === undefined ? undefined : success === 'true',
    });
  }
}
