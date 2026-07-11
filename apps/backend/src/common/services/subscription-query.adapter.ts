import { Injectable } from '@nestjs/common';
import type { SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const DEFAULT_COPILOT_QUOTA = -1;

const CACHE_TTL_SECONDS = 60;

export interface ActiveSubscription {
  id: string;
  plan: SubscriptionPlan;
  status: string;
  pricePerMonth: number;
  transactionQuota: number;
  transactionUsedThisCycle: number;
  copilotUsedThisCycle: number;
  copilotQuota: number;
  currentCycleStart: Date;
  currentCycleEnd: Date;
}

export interface ActivePlanInfo {
  subscriptionId: string;
  plan: SubscriptionPlan;
}

/**
 * Single seam for "active subscription by tenant" queries.
 * Replaces the duplicated `prisma.subscription.findFirst({ where: { tenantId, status: 'active' } })`
 * pattern across guards, billing, settings, and auth modules.
 */
@Injectable()
export class SubscriptionQueryAdapter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Fetch the full active subscription for a tenant.
   * Cached 60s in Redis. Returns null if no active subscription.
   */
  async findActive(tenantId: string): Promise<ActiveSubscription | null> {
    const cacheKey = `sub:active:${tenantId}`;
    try {
      const raw = await this.redis.get(cacheKey);
      if (raw) return JSON.parse(raw) as ActiveSubscription;
    } catch {
      // cache miss
    }

    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId, status: 'active' },
      orderBy: { startedAt: 'desc' },
    });

    if (!sub) return null;

    const pricing = await this.prisma.planPricing.findUnique({
      where: { plan: sub.plan },
      select: { copilotQuota: true },
    });

    const dto: ActiveSubscription = {
      id: sub.id,
      plan: sub.plan,
      status: sub.status,
      pricePerMonth: Number(sub.pricePerMonth),
      transactionQuota: sub.transactionQuota,
      transactionUsedThisCycle: sub.transactionUsedThisCycle,
      copilotUsedThisCycle: sub.copilotUsedThisCycle,
      copilotQuota: pricing?.copilotQuota ?? DEFAULT_COPILOT_QUOTA,
      currentCycleStart: sub.currentCycleStart,
      currentCycleEnd: sub.currentCycleEnd,
    };

    try {
      await this.redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(dto));
    } catch {
      // non-critical
    }

    return dto;
  }

  /**
   * Fetch only plan + subscriptionId for guards/settings/token checks.
   * Shares the same cache as findActive() — reads from sub:active:{tenantId}
   * so that a preceding findActive() or findActivePlan() warm the cache for both.
   * Returns null if no active subscription.
   */
  async findActivePlan(tenantId: string): Promise<ActivePlanInfo | null> {
    const cacheKey = `sub:active:${tenantId}`;
    try {
      const raw = await this.redis.get(cacheKey);
      if (raw) {
        const full = JSON.parse(raw) as ActiveSubscription;
        return { subscriptionId: full.id, plan: full.plan };
      }
    } catch {
      // cache miss
    }

    const full = await this.findActive(tenantId);
    if (!full) return null;

    return { subscriptionId: full.id, plan: full.plan };
  }

  /**
   * Invalidate cached subscription data for a tenant.
   * Must be called after upgrade, partner plan change, or suspend/activate.
   */
  async invalidateCache(tenantId: string): Promise<void> {
    try {
      await this.redis.del(`sub:active:${tenantId}`);
    } catch {
      // non-critical
    }
  }
}
