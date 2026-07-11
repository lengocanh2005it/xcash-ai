import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { interval, merge, Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import type { NotificationItem, TransactionEvent } from './notification.service';

@Injectable()
export class NotificationStreamService {
  private readonly eventBus = new Subject<{ tenantId: string; notification: NotificationItem }>();
  private readonly txEventBus = new Subject<{ tenantId: string; event: TransactionEvent }>();

  constructor(private readonly jwtService: JwtService) {}

  streamForToken(token: string): Observable<{ data: NotificationItem }> {
    let tenantId: string;
    try {
      const payload = this.jwtService.verify<{ tenantId?: string }>(token);
      if (!payload.tenantId) throw new Error('no tenantId');
      tenantId = payload.tenantId;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ');
    }

    return this.eventBus.pipe(
      filter((e) => e.tenantId === tenantId),
      map((e) => ({ data: e.notification })),
    );
  }

  streamTransactionEventsForToken(token: string): Observable<{ data: TransactionEvent }> {
    let tenantId: string;
    try {
      const payload = this.jwtService.verify<{ tenantId?: string }>(token);
      if (!payload.tenantId) throw new Error('no tenantId');
      tenantId = payload.tenantId;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ');
    }

    const events$ = this.txEventBus.pipe(
      filter((e) => e.tenantId === tenantId),
      map((e) => ({ data: e.event })),
    );
    const keepalive$ = interval(25_000).pipe(
      map(() => ({ data: { type: 'keepalive' } as unknown as TransactionEvent })),
    );
    return merge(events$, keepalive$);
  }

  emitTransactionClassified(
    tenantId: string,
    transactionId: string,
    status: 'classified' | 'review',
  ): void {
    this.txEventBus.next({
      tenantId,
      event: { type: 'transaction_classified', transactionId, status },
    });
  }

  emitNotification(tenantId: string, notification: NotificationItem): void {
    this.eventBus.next({ tenantId, notification });
  }
}
