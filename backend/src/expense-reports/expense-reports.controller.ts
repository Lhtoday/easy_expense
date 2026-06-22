import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUserGuard, RequestWithUser } from '../identity/current-user.guard';
import {
  ExpenseReportListQueryDto,
  RegisterExpenseAttachmentDto,
  RegisterExpenseInvoiceDto,
  SaveExpenseReportDto,
  SubmitExpenseReportDto,
  UploadExpenseAttachmentDto,
} from './expense-report.dto';
import { ExpenseReportsService } from './expense-reports.service';

type UploadedAttachmentFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
};

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

  @Post(':id/withdraw')
  withdraw(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: SubmitExpenseReportDto) {
    return this.service.withdraw(request.user, id, dto.comment);
  }

  @Post(':id/attachments')
  registerAttachment(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: RegisterExpenseAttachmentDto) {
    return this.service.registerAttachment(request.user, id, dto);
  }

  @Post(':id/attachments/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  uploadAttachment(
    @Req() request: RequestWithUser,
    @Param('id') id: string,
    @UploadedFile() file: UploadedAttachmentFile,
    @Body() dto: UploadExpenseAttachmentDto,
  ) {
    return this.service.uploadAttachment(request.user, id, file, dto);
  }

  @Get(':id/attachments/:attachmentId/download')
  async downloadAttachment(
    @Req() request: RequestWithUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { attachment, stream } = await this.service.openAttachment(request.user, id, attachmentId, 'DOWNLOAD');
    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader('Content-Length', String(attachment.sizeBytes));
    response.setHeader('Content-Disposition', this.contentDisposition('attachment', attachment.fileName));
    return new StreamableFile(stream);
  }

  @Get(':id/attachments/:attachmentId/preview')
  async previewAttachment(
    @Req() request: RequestWithUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { attachment, stream } = await this.service.openAttachment(request.user, id, attachmentId, 'PREVIEW');
    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader('Content-Length', String(attachment.sizeBytes));
    response.setHeader('Content-Disposition', this.contentDisposition('inline', attachment.fileName));
    return new StreamableFile(stream);
  }

  @Delete(':id/attachments/:attachmentId')
  removeAttachment(@Req() request: RequestWithUser, @Param('id') id: string, @Param('attachmentId') attachmentId: string) {
    return this.service.removeAttachment(request.user, id, attachmentId);
  }

  @Post(':id/invoices')
  registerInvoice(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: RegisterExpenseInvoiceDto) {
    return this.service.registerInvoice(request.user, id, dto);
  }

  @Patch(':id/invoices/:invoiceId')
  updateInvoice(@Req() request: RequestWithUser, @Param('id') id: string, @Param('invoiceId') invoiceId: string, @Body() dto: RegisterExpenseInvoiceDto) {
    return this.service.updateInvoice(request.user, id, invoiceId, dto);
  }

  @Delete(':id/invoices/:invoiceId')
  removeInvoice(@Req() request: RequestWithUser, @Param('id') id: string, @Param('invoiceId') invoiceId: string) {
    return this.service.removeInvoice(request.user, id, invoiceId);
  }

  @Delete(':id')
  remove(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.service.void(request.user, id);
  }

  private contentDisposition(disposition: 'attachment' | 'inline', fileName: string) {
    const fallback = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
  }
}
