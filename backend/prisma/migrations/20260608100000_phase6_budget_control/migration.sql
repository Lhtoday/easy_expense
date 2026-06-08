-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "BudgetControlMode" AS ENUM ('WARNING', 'BLOCK');

-- CreateEnum
CREATE TYPE "BudgetOccupationStatus" AS ENUM ('IN_TRANSIT', 'APPROVED', 'ACTUAL', 'RELEASED');

-- CreateEnum
CREATE TYPE "BudgetAction" AS ENUM ('OCCUPY_IN_TRANSIT', 'RELEASE', 'CONFIRM_APPROVED', 'TRANSFER_ACTUAL', 'ADJUST');

-- CreateEnum
CREATE TYPE "BudgetCheckResult" AS ENUM ('PASS', 'WARNING', 'BLOCK');

-- CreateTable
CREATE TABLE "bud_budgets" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fiscal_period" TEXT NOT NULL,
    "department_id" TEXT,
    "cost_center_id" TEXT,
    "project_id" TEXT,
    "expense_type_code" TEXT,
    "account_subject_code" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "total_cents" INTEGER NOT NULL,
    "in_transit_cents" INTEGER NOT NULL DEFAULT 0,
    "approved_cents" INTEGER NOT NULL DEFAULT 0,
    "actual_cents" INTEGER NOT NULL DEFAULT 0,
    "warning_threshold_bps" INTEGER NOT NULL DEFAULT 9000,
    "control_mode" "BudgetControlMode" NOT NULL DEFAULT 'WARNING',
    "status" "BudgetStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bud_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bud_occupations" (
    "id" TEXT NOT NULL,
    "budget_id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "status" "BudgetOccupationStatus" NOT NULL DEFAULT 'IN_TRANSIT',
    "fiscal_period" TEXT NOT NULL,
    "department_id" TEXT,
    "cost_center_id" TEXT,
    "project_id" TEXT,
    "expense_type_code" TEXT NOT NULL,
    "account_subject_code" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "occupied_cents" INTEGER NOT NULL,
    "approved_cents" INTEGER NOT NULL DEFAULT 0,
    "actual_cents" INTEGER NOT NULL DEFAULT 0,
    "released_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "released_at" TIMESTAMP(3),

    CONSTRAINT "bud_occupations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bud_checks" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "item_id" TEXT,
    "budget_id" TEXT,
    "result" "BudgetCheckResult" NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bud_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bud_operation_logs" (
    "id" TEXT NOT NULL,
    "budget_id" TEXT NOT NULL,
    "occupation_id" TEXT,
    "operator_id" TEXT NOT NULL,
    "action" "BudgetAction" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "before_in_transit_cents" INTEGER NOT NULL,
    "after_in_transit_cents" INTEGER NOT NULL,
    "before_approved_cents" INTEGER NOT NULL,
    "after_approved_cents" INTEGER NOT NULL,
    "before_actual_cents" INTEGER NOT NULL,
    "after_actual_cents" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bud_operation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bud_budgets_code_key" ON "bud_budgets"("code");

-- CreateIndex
CREATE INDEX "bud_budgets_fiscal_period_status_idx" ON "bud_budgets"("fiscal_period", "status");

-- CreateIndex
CREATE INDEX "bud_budgets_department_id_idx" ON "bud_budgets"("department_id");

-- CreateIndex
CREATE INDEX "bud_budgets_cost_center_id_idx" ON "bud_budgets"("cost_center_id");

-- CreateIndex
CREATE INDEX "bud_budgets_project_id_idx" ON "bud_budgets"("project_id");

-- CreateIndex
CREATE INDEX "bud_budgets_expense_type_code_idx" ON "bud_budgets"("expense_type_code");

-- CreateIndex
CREATE UNIQUE INDEX "bud_budgets_fiscal_period_department_id_cost_center_id_project_i_key" ON "bud_budgets"("fiscal_period", "department_id", "cost_center_id", "project_id", "expense_type_code", "account_subject_code", "currency");

-- CreateIndex
CREATE INDEX "bud_occupations_budget_id_status_idx" ON "bud_occupations"("budget_id", "status");

-- CreateIndex
CREATE INDEX "bud_occupations_report_id_status_idx" ON "bud_occupations"("report_id", "status");

-- CreateIndex
CREATE INDEX "bud_occupations_item_id_idx" ON "bud_occupations"("item_id");

-- CreateIndex
CREATE INDEX "bud_checks_report_id_result_idx" ON "bud_checks"("report_id", "result");

-- CreateIndex
CREATE INDEX "bud_checks_budget_id_idx" ON "bud_checks"("budget_id");

-- CreateIndex
CREATE INDEX "bud_operation_logs_budget_id_idx" ON "bud_operation_logs"("budget_id");

-- CreateIndex
CREATE INDEX "bud_operation_logs_occupation_id_idx" ON "bud_operation_logs"("occupation_id");

-- CreateIndex
CREATE INDEX "bud_operation_logs_operator_id_idx" ON "bud_operation_logs"("operator_id");

-- AddForeignKey
ALTER TABLE "bud_budgets" ADD CONSTRAINT "bud_budgets_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "md_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bud_budgets" ADD CONSTRAINT "bud_budgets_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "md_cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bud_budgets" ADD CONSTRAINT "bud_budgets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "md_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bud_budgets" ADD CONSTRAINT "bud_budgets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bud_budgets" ADD CONSTRAINT "bud_budgets_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "iam_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bud_occupations" ADD CONSTRAINT "bud_occupations_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "bud_budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bud_occupations" ADD CONSTRAINT "bud_occupations_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "exp_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bud_occupations" ADD CONSTRAINT "bud_occupations_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "exp_report_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bud_checks" ADD CONSTRAINT "bud_checks_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "exp_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bud_checks" ADD CONSTRAINT "bud_checks_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "exp_report_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bud_checks" ADD CONSTRAINT "bud_checks_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "bud_budgets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bud_operation_logs" ADD CONSTRAINT "bud_operation_logs_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "bud_budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bud_operation_logs" ADD CONSTRAINT "bud_operation_logs_occupation_id_fkey" FOREIGN KEY ("occupation_id") REFERENCES "bud_occupations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bud_operation_logs" ADD CONSTRAINT "bud_operation_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
