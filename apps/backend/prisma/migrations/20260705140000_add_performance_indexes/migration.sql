-- Performance indexes for report date filters and notification dedup
CREATE INDEX "transactions_tenant_id_transaction_date_idx" ON "transactions"("tenant_id", "transaction_date");

CREATE INDEX "notifications_tenant_id_type_created_at_idx" ON "notifications"("tenant_id", "type", "created_at");
