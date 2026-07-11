import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/node';
import type { ApiResponse } from '@xcash/shared-types';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const mapped = this.mapException(exception);

    const status =
      mapped instanceof HttpException ? mapped.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const { message, code } =
      mapped instanceof HttpException
        ? this.extractError(mapped)
        : { message: 'Đã xảy ra lỗi hệ thống', code: undefined };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      Sentry.captureException(
        exception instanceof Error ? exception : new Error(String(exception)),
      );
    }

    const body: ApiResponse<null> = {
      success: false,
      data: null,
      meta: {
        timestamp: new Date().toISOString(),
        request_id: request.requestId ?? 'unknown',
      },
      error: {
        code: code ?? HttpStatus[status] ?? 'INTERNAL_SERVER_ERROR',
        message,
      },
    };

    response.status(status).json(body);
  }

  private mapException(exception: unknown): unknown {
    if (exception instanceof HttpException) return exception;

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return new ConflictException('Dữ liệu đã tồn tại trong hệ thống');
        case 'P2025':
          return new NotFoundException('Không tìm thấy bản ghi yêu cầu');
        case 'P2003':
          return new ConflictException('Dữ liệu tham chiếu không hợp lệ');
        default:
          return exception;
      }
    }

    return exception;
  }

  private extractError(exception: HttpException): { message: string; code?: string } {
    const response = exception.getResponse();
    if (typeof response === 'string') {
      return { message: response };
    }
    if (typeof response === 'object' && response !== null) {
      const obj = response as { message?: string | string[]; code?: string };
      const message = Array.isArray(obj.message)
        ? obj.message.join(', ')
        : (obj.message ?? exception.message);
      return { message, code: obj.code };
    }
    return { message: exception.message };
  }
}
