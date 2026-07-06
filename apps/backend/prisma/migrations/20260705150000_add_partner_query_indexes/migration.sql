-- Partner stats + subscription lookup performance
CREATE INDEX "transaction_classifications_tenant_id_created_at_idx" ON "transaction_classifications"("tenant_id", "created_at");

CREATE INDEX "subscriptions_tenant_id_status_idx" ON "subscriptions"("tenant_id", "status");
