import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { EMAIL_QUEUE, QueueModule } from '../../queue/queue.module';
import { RedisModule } from '../../redis/redis.module';
import { ChartOfAccountsModule } from '../chart-of-accounts/chart-of-accounts.module';
import { TeamModule } from '../team/team.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ChangePasswordService } from './change-password.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ChartOfAccountsModule,
    RedisModule,
    QueueModule,
    TeamModule,
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>(
            'JWT_ACCESS_EXPIRES_IN',
            '15m',
          ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    ChangePasswordService,
    EmailVerificationService,
    PasswordResetService,
    JwtStrategy,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
