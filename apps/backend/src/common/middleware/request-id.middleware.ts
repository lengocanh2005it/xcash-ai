import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { requestId?: string }, _res: Response, next: NextFunction) {
    req.requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    next();
  }
}
