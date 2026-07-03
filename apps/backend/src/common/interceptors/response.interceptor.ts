import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import type { ApiResponse } from '@xcash/shared-types';
import type { Request } from 'express';
import { map, Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | StreamableFile> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | StreamableFile> {
    const request = context.switchToHttp().getRequest<Request & { requestId?: string }>();

    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile) {
          return data;
        }

        return {
          success: true,
          data: data ?? null,
          meta: {
            timestamp: new Date().toISOString(),
            request_id: request.requestId ?? 'unknown',
          },
          error: null,
        };
      }),
    );
  }
}
