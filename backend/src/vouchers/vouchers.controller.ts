import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentUserGuard, RequestWithUser } from '../identity/current-user.guard';
import {
  AccountMappingListQueryDto,
  AccountSubjectListQueryDto,
  ConfirmVoucherDto,
  CreateAccountMappingDto,
  CreateAccountSubjectDto,
  GenerateVoucherDto,
  UpdateAccountMappingDto,
  UpdateAccountSubjectDto,
} from './voucher.dto';
import { VouchersService } from './vouchers.service';

@Controller()
@UseGuards(CurrentUserGuard)
export class VouchersController {
  constructor(private readonly service: VouchersService) {}

  @Get('account-subjects')
  listSubjects(@Req() request: RequestWithUser, @Query() query: AccountSubjectListQueryDto) {
    return this.service.listSubjects(request.user, query);
  }

  @Post('account-subjects')
  createSubject(@Req() request: RequestWithUser, @Body() dto: CreateAccountSubjectDto) {
    return this.service.createSubject(request.user, dto);
  }

  @Patch('account-subjects/:id')
  updateSubject(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: UpdateAccountSubjectDto) {
    return this.service.updateSubject(request.user, id, dto);
  }

  @Delete('account-subjects/:id')
  disableSubject(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.disableSubject(request.user, id);
  }

  @Get('account-mappings')
  listMappings(@Req() request: RequestWithUser, @Query() query: AccountMappingListQueryDto) {
    return this.service.listMappings(request.user, query);
  }

  @Post('account-mappings')
  createMapping(@Req() request: RequestWithUser, @Body() dto: CreateAccountMappingDto) {
    return this.service.createMapping(request.user, dto);
  }

  @Patch('account-mappings/:id')
  updateMapping(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: UpdateAccountMappingDto) {
    return this.service.updateMapping(request.user, id, dto);
  }

  @Delete('account-mappings/:id')
  disableMapping(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.disableMapping(request.user, id);
  }

  @Get('vouchers/reports/:reportId/preview')
  previewReport(@Req() request: RequestWithUser, @Param('reportId') reportId: string) {
    return this.service.previewReport(request.user, reportId);
  }

  @Post('vouchers/reports/:reportId/generate')
  generateReport(@Req() request: RequestWithUser, @Param('reportId') reportId: string, @Body() dto: GenerateVoucherDto) {
    return this.service.generateReportVouchers(request.user, reportId, dto.comment);
  }

  @Get('vouchers/:id')
  detail(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.detail(request.user, id);
  }

  @Post('vouchers/:id/confirm')
  confirm(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: ConfirmVoucherDto) {
    return this.service.confirm(request.user, id, dto.comment);
  }
}
