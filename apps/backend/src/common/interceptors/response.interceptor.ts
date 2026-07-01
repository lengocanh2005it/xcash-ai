import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { ApiResponse } from '@paypilot/shared-types';
import type { Request } from 'express';
import { map, Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request & { requestId?: string }>();

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: data ?? null,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: request.requestId ?? 'unknown',
        },
        error: null,
      })),
    );
  }
}
