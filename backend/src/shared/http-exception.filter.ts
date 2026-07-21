import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { ApiErrorResponse } from './api-response';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const prismaMessage = this.getPrismaMessage(exception);
    const status = prismaMessage ? HttpStatus.BAD_REQUEST : exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = prismaMessage ?? this.getMessage(payload);

    const body: ApiErrorResponse = {
      success: false,
      error: {
        code: status === HttpStatus.INTERNAL_SERVER_ERROR ? 'INTERNAL_SERVER_ERROR' : `HTTP_${status}`,
        message,
        details: typeof payload === 'object' ? payload : undefined,
      },
    };

    response.status(status).json(body);
  }

  private getMessage(payload: unknown) {
    if (typeof payload === 'string') {
      return payload;
    }

    if (payload && typeof payload === 'object' && 'message' in payload) {
      const message = (payload as { message: unknown }).message;
      return Array.isArray(message) ? message.join('; ') : String(message);
    }

    return 'Unexpected server error';
  }

  private getPrismaMessage(exception: unknown) {
    if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) {
      return undefined;
    }

    const target = Array.isArray(exception.meta?.target) ? exception.meta.target.join(', ') : String(exception.meta?.target ?? '');
    if (exception.code === 'P2020') {
      return '金额或数字过大，超出当前字段可保存范围。请调低金额或拆分数据后再保存。';
    }

    if (exception.code === 'P2003') {
      return `关联的基础资料不存在或已被删除，请重新选择后保存。${target ? `字段：${target}` : ''}`;
    }

    if (exception.code !== 'P2002') {
      return undefined;
    }

    if (target.includes('code')) {
      return '编码已存在，请更换后再保存';
    }
    if (target.includes('employee_no')) {
      return '工号已存在，请更换后再保存';
    }
    if (target.includes('email')) {
      return '邮箱已存在，请更换后再保存';
    }
    if (target.includes('report_no')) {
      return '报销单号已存在，请重试';
    }
    return '存在重复数据，请检查唯一字段';
  }
}
