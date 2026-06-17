-- Phase 8 payment flow: cashier payment batches and audited payment records.
ALTER TYPE "ExpenseReportStatus" ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE "ExpenseReportAction" ADD VALUE IF NOT EXISTS 'PAYMENT_REGISTER';
ALTER TYPE "ExpenseReportAction" ADD VALUE IF NOT EXISTS 'PAYMENT_FAIL';

CREATE TYPE "PaymentBatchStatus" AS ENUM ('COMPLETED', 'PARTIAL_FAILED');
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCESS', 'FAILED');
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CORPORATE_CARD', 'OTHER');

CREATE TABLE "exp_payment_batches" (
  "id" TEXT NOT NULL,
  "batch_no" TEXT NOT NULL,
  "name" TEXT,
  "status" "PaymentBatchStatus" NOT NULL DEFAULT 'COMPLETED',
  "total_amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CNY',
  "operator_id" TEXT NOT NULL,
  "comment" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "report_id" TEXT,

  CONSTRAINT "exp_payment_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exp_payments" (
  "id" TEXT NOT NULL,
  "report_id" TEXT NOT NULL,
  "batch_id" TEXT,
  "operator_id" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL,
  "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
  "amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CNY',
  "paid_at" TIMESTAMP(3),
  "payment_reference" TEXT,
  "payer_account" TEXT,
  "payee_account" TEXT,
  "failure_reason" TEXT,
  "comment" TEXT,
  "from_status" "ExpenseReportStatus" NOT NULL,
  "to_status" "ExpenseReportStatus" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "exp_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exp_payment_batches_batch_no_key" ON "exp_payment_batches"("batch_no");
CREATE INDEX "exp_payment_batches_operator_id_idx" ON "exp_payment_batches"("operator_id");
CREATE INDEX "exp_payment_batches_report_id_idx" ON "exp_payment_batches"("report_id");
CREATE INDEX "exp_payment_batches_status_idx" ON "exp_payment_batches"("status");
CREATE INDEX "exp_payments_report_id_status_idx" ON "exp_payments"("report_id", "status");
CREATE INDEX "exp_payments_batch_id_idx" ON "exp_payments"("batch_id");
CREATE INDEX "exp_payments_operator_id_idx" ON "exp_payments"("operator_id");

ALTER TABLE "exp_payment_batches" ADD CONSTRAINT "exp_payment_batches_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "exp_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exp_payment_batches" ADD CONSTRAINT "exp_payment_batches_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exp_payments" ADD CONSTRAINT "exp_payments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "exp_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exp_payments" ADD CONSTRAINT "exp_payments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "exp_payment_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exp_payments" ADD CONSTRAINT "exp_payments_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
