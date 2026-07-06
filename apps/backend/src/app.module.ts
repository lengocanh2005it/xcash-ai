import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TenantThrottlerGuard } from './common/guards/tenant-throttler.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import configuration from './config/configuration';
import { AiModule } from './modules/ai/ai.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { AuthModule } from './modules/auth/auth.module';
import { BankingModule } from './modules/banking/banking.module';
import { BillingModule } from './modules/billing/billing.module';
import { CasModule } from './modules/cas/cas.module';
import { ChartOfAccountsModule } from './modules/chart-of-accounts/chart-of-accounts.module';
import { ClassificationModule } from './modules/classification/classification.module';
import { HealthModule } from './modules/health/health.module';
import { ImportModule } from './modules/import/import.module';
import { NotificationModule } from './modules/notification/notification.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { PartnerModule } from './modules/partner/partner.module';
import { ProfileModule } from './modules/profile/profile.module';
import { ReportModule } from './modules/report/report.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TeamModule } from './modules/team/team.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: 60_000,
            limit: configService.get<number>('RATE_LIMIT_PER_MINUTE', 120),
          },
        ],
      }),
    }),
    PrismaModule,
    StorageModule,
    RedisModule,
    QueueModule,
    AuthModule,
    CasModule,
    HealthModule,
    OnboardingModule,
    BankingModule,
    AiModule,
    AuditLogModule,
    ChartOfAccountsModule,
    ClassificationModule,
    ReportModule,
    TransactionModule,
    SettingsModule,
    TeamModule,
    BillingModule,
    ImportModule,
    PartnerModule,
    NotificationModule,
    ProfileModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: TenantThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
