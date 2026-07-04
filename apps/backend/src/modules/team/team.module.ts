import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { EMAIL_QUEUE, QueueModule } from '../../queue/queue.module';
import { RedisModule } from '../../redis/redis.module';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { TeamInviteService } from './team-invite.service';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    QueueModule,
    ConfigModule,
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
  ],
  controllers: [TeamController],
  providers: [TeamService, TeamInviteService],
  exports: [TeamInviteService],
})
export class TeamModule {}
