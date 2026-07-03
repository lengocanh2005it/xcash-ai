-- Add order_type to payment_orders (default 'upgrade' for existing rows)
ALTER TABLE "payment_orders" ADD COLUMN "order_type" TEXT NOT NULL DEFAULT 'upgrade';

-- Set overage prices for starter and pro plans
UPDATE "plan_pricing" SET "overage_price_per_transaction" = 800 WHERE "plan" = 'starter';
UPDATE "plan_pricing" SET "overage_price_per_transaction" = 600 WHERE "plan" = 'pro';
