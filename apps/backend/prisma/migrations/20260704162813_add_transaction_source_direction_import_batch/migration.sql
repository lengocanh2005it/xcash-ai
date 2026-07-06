-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('cas', 'import');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('in', 'out');

-- CreateTable
CREATE TABLE "transaction_import_batches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL,
    "imported_count" INTEGER NOT NULL,
    "skipped_count" INTEGER NOT NULL,
    "imported_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transaction_import_batches_tenant_id_created_at_idx" ON "transaction_import_batches"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "transaction_import_batches" ADD CONSTRAINT "transaction_import_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "direction" "TransactionDirection" NOT NULL DEFAULT 'in',
                           ADD COLUMN "import_batch_id" TEXT,
                           ADD COLUMN "source" "TransactionSource" NOT NULL DEFAULT 'cas';

-- CreateIndex
CREATE INDEX "transactions_tenant_id_source_idx" ON "transactions"("tenant_id", "source");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "transaction_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
