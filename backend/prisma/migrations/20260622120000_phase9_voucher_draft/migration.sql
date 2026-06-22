-- AlterEnum
ALTER TYPE "ExpenseReportStatus" ADD VALUE IF NOT EXISTS 'VOUCHER_DRAFTED';
ALTER TYPE "ExpenseReportStatus" ADD VALUE IF NOT EXISTS 'VOUCHER_CONFIRMED';

-- AlterEnum
ALTER TYPE "ExpenseReportAction" ADD VALUE IF NOT EXISTS 'VOUCHER_DRAFT';
ALTER TYPE "ExpenseReportAction" ADD VALUE IF NOT EXISTS 'VOUCHER_CONFIRM';

-- CreateEnum
CREATE TYPE "GlStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- AlterEnum
ALTER TYPE "SystemAuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_SUBJECT_CREATE';
ALTER TYPE "SystemAuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_SUBJECT_UPDATE';
ALTER TYPE "SystemAuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_SUBJECT_DISABLE';
ALTER TYPE "SystemAuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_MAPPING_CREATE';
ALTER TYPE "SystemAuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_MAPPING_UPDATE';
ALTER TYPE "SystemAuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_MAPPING_DISABLE';

-- CreateEnum
CREATE TYPE "GlAccountCategory" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'TAX');

-- CreateEnum
CREATE TYPE "GlNormalBalance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "GlAccountMappingPurpose" AS ENUM ('EXPENSE_TYPE', 'EMPLOYEE_PAYABLE', 'INPUT_TAX', 'BANK_PAYMENT');

-- CreateEnum
CREATE TYPE "GlVoucherType" AS ENUM ('EXPENSE_ACCRUAL', 'PAYMENT');

-- CreateEnum
CREATE TYPE "GlVoucherStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'VOIDED');

-- CreateEnum
CREATE TYPE "GlVoucherLineDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "GlVoucherAction" AS ENUM ('GENERATE', 'CONFIRM', 'VOID');

-- CreateTable
CREATE TABLE "gl_account_subjects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "GlAccountCategory" NOT NULL,
    "normal_balance" "GlNormalBalance" NOT NULL,
    "description" TEXT,
    "status" "GlStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "gl_account_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_account_mappings" (
    "id" TEXT NOT NULL,
    "purpose" "GlAccountMappingPurpose" NOT NULL,
    "expense_type_code" TEXT,
    "applicant_id" TEXT,
    "payment_method" "PaymentMethod",
    "payer_account" TEXT,
    "department_id" TEXT,
    "cost_center_id" TEXT,
    "project_id" TEXT,
    "account_subject_code" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "status" "GlStatus" NOT NULL DEFAULT 'ACTIVE',
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "gl_account_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_vouchers" (
    "id" TEXT NOT NULL,
    "voucher_no" TEXT NOT NULL,
    "voucher_type" "GlVoucherType" NOT NULL,
    "status" "GlVoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "report_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "total_debit_cents" INTEGER NOT NULL,
    "total_credit_cents" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "generated_by" TEXT NOT NULL,
    "confirmed_by" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gl_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_voucher_lines" (
    "id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "direction" "GlVoucherLineDirection" NOT NULL,
    "account_subject_code" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "summary" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "item_id" TEXT,
    "payment_id" TEXT,
    "department_id" TEXT,
    "cost_center_id" TEXT,
    "project_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gl_voucher_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_voucher_logs" (
    "id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "action" "GlVoucherAction" NOT NULL,
    "from_status" "GlVoucherStatus",
    "to_status" "GlVoucherStatus" NOT NULL,
    "comment" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gl_voucher_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gl_account_subjects_code_key" ON "gl_account_subjects"("code");
CREATE INDEX "gl_account_subjects_category_status_idx" ON "gl_account_subjects"("category", "status");
CREATE INDEX "gl_account_mappings_purpose_status_idx" ON "gl_account_mappings"("purpose", "status");
CREATE INDEX "gl_account_mappings_expense_type_code_idx" ON "gl_account_mappings"("expense_type_code");
CREATE INDEX "gl_account_mappings_applicant_id_idx" ON "gl_account_mappings"("applicant_id");
CREATE INDEX "gl_account_mappings_account_subject_code_idx" ON "gl_account_mappings"("account_subject_code");
CREATE UNIQUE INDEX "gl_vouchers_voucher_no_key" ON "gl_vouchers"("voucher_no");
CREATE UNIQUE INDEX "gl_vouchers_report_id_voucher_type_payment_id_key" ON "gl_vouchers"("report_id", "voucher_type", "payment_id");
CREATE UNIQUE INDEX "gl_vouchers_report_accrual_once_idx" ON "gl_vouchers"("report_id", "voucher_type") WHERE "voucher_type" = 'EXPENSE_ACCRUAL';
CREATE INDEX "gl_vouchers_report_id_status_idx" ON "gl_vouchers"("report_id", "status");
CREATE INDEX "gl_vouchers_voucher_type_status_idx" ON "gl_vouchers"("voucher_type", "status");
CREATE UNIQUE INDEX "gl_voucher_lines_voucher_id_line_no_key" ON "gl_voucher_lines"("voucher_id", "line_no");
CREATE INDEX "gl_voucher_lines_report_id_idx" ON "gl_voucher_lines"("report_id");
CREATE INDEX "gl_voucher_lines_item_id_idx" ON "gl_voucher_lines"("item_id");
CREATE INDEX "gl_voucher_lines_payment_id_idx" ON "gl_voucher_lines"("payment_id");
CREATE INDEX "gl_voucher_lines_account_subject_code_idx" ON "gl_voucher_lines"("account_subject_code");
CREATE INDEX "gl_voucher_logs_voucher_id_idx" ON "gl_voucher_logs"("voucher_id");
CREATE INDEX "gl_voucher_logs_operator_id_idx" ON "gl_voucher_logs"("operator_id");

-- AddForeignKey
ALTER TABLE "gl_account_subjects" ADD CONSTRAINT "gl_account_subjects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gl_account_subjects" ADD CONSTRAINT "gl_account_subjects_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "iam_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gl_account_mappings" ADD CONSTRAINT "gl_account_mappings_account_subject_code_fkey" FOREIGN KEY ("account_subject_code") REFERENCES "gl_account_subjects"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gl_account_mappings" ADD CONSTRAINT "gl_account_mappings_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "iam_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gl_account_mappings" ADD CONSTRAINT "gl_account_mappings_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "md_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gl_account_mappings" ADD CONSTRAINT "gl_account_mappings_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "md_cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gl_account_mappings" ADD CONSTRAINT "gl_account_mappings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "md_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gl_account_mappings" ADD CONSTRAINT "gl_account_mappings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gl_account_mappings" ADD CONSTRAINT "gl_account_mappings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "iam_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gl_vouchers" ADD CONSTRAINT "gl_vouchers_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "exp_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gl_vouchers" ADD CONSTRAINT "gl_vouchers_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "exp_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gl_vouchers" ADD CONSTRAINT "gl_vouchers_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gl_vouchers" ADD CONSTRAINT "gl_vouchers_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "iam_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gl_voucher_lines" ADD CONSTRAINT "gl_voucher_lines_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "gl_vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gl_voucher_lines" ADD CONSTRAINT "gl_voucher_lines_account_subject_code_fkey" FOREIGN KEY ("account_subject_code") REFERENCES "gl_account_subjects"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gl_voucher_lines" ADD CONSTRAINT "gl_voucher_lines_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "exp_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gl_voucher_lines" ADD CONSTRAINT "gl_voucher_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "exp_report_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gl_voucher_lines" ADD CONSTRAINT "gl_voucher_lines_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "exp_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gl_voucher_lines" ADD CONSTRAINT "gl_voucher_lines_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "md_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gl_voucher_lines" ADD CONSTRAINT "gl_voucher_lines_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "md_cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gl_voucher_lines" ADD CONSTRAINT "gl_voucher_lines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "md_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gl_voucher_logs" ADD CONSTRAINT "gl_voucher_logs_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "gl_vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gl_voucher_logs" ADD CONSTRAINT "gl_voucher_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
