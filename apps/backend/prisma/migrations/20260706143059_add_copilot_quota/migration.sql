-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'copilot_quota_warning';
ALTER TYPE "NotificationType" ADD VALUE 'copilot_quota_exceeded';

-- AlterTable
ALTER TABLE "plan_pricing" ADD COLUMN "copilot_quota" INTEGER NOT NULL DEFAULT -1;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "copilot_used_this_cycle" INTEGER NOT NULL DEFAULT 0;
