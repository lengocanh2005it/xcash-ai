-- Seed copilot_quota per plan (spec: Free=0, Starter=200, Pro=1000, Enterprise=-1).
-- Column was added with DEFAULT -1 in 20260706143059_add_copilot_quota without per-plan UPDATE.

UPDATE "plan_pricing" SET "copilot_quota" = 0 WHERE "plan" = 'free';
UPDATE "plan_pricing" SET "copilot_quota" = 200 WHERE "plan" = 'starter';
UPDATE "plan_pricing" SET "copilot_quota" = 1000 WHERE "plan" = 'pro';
UPDATE "plan_pricing" SET "copilot_quota" = -1 WHERE "plan" = 'enterprise';
