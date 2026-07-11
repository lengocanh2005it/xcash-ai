import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async set(key: string, value: string, ...args: any[]): Promise<any> {
    return this.client.set(key, value, ...args);
  }

  async setex(key: string, ttl: number, value: string): Promise<'OK'> {
    return this.client.setex(key, ttl, value);
  }

  async del(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async expire(key: string, ttl: number): Promise<number> {
    return this.client.expire(key, ttl);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sadd(key, ...members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.srem(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  pipeline(): ReturnType<Redis['pipeline']> {
    return this.client.pipeline();
  }
}
