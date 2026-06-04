CREATE TYPE "ExpenseReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VOIDED');
CREATE TYPE "ExpenseReportAction" AS ENUM ('CREATE', 'UPDATE', 'SUBMIT', 'VOID');

CREATE TABLE "exp_reports" (
    "id" TEXT NOT NULL,
    "report_no" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "applicant_id" TEXT NOT NULL,
    "department_id" TEXT,
    "cost_center_id" TEXT,
    "project_id" TEXT,
    "status" "ExpenseReportStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "amount_cents" INTEGER NOT NULL DEFAULT 0,
    "tax_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "deductible_tax_cents" INTEGER NOT NULL DEFAULT 0,
    "reimbursable_cents" INTEGER NOT NULL DEFAULT 0,
    "paid_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "exp_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exp_report_items" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "expense_type_code" TEXT NOT NULL,
    "account_subject_code" TEXT,
    "description" TEXT NOT NULL,
    "department_id" TEXT,
    "cost_center_id" TEXT,
    "project_id" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "tax_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "deductible_tax_cents" INTEGER NOT NULL DEFAULT 0,
    "reimbursable_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exp_report_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exp_report_logs" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "action" "ExpenseReportAction" NOT NULL,
    "from_status" "ExpenseReportStatus",
    "to_status" "ExpenseReportStatus" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_report_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exp_reports_report_no_key" ON "exp_reports"("report_no");
CREATE INDEX "exp_reports_applicant_id_status_idx" ON "exp_reports"("applicant_id", "status");
CREATE INDEX "exp_reports_department_id_idx" ON "exp_reports"("department_id");
CREATE INDEX "exp_reports_cost_center_id_idx" ON "exp_reports"("cost_center_id");
CREATE INDEX "exp_reports_project_id_idx" ON "exp_reports"("project_id");
CREATE INDEX "exp_report_items_report_id_idx" ON "exp_report_items"("report_id");
CREATE INDEX "exp_report_logs_report_id_idx" ON "exp_report_logs"("report_id");
CREATE INDEX "exp_report_logs_operator_id_idx" ON "exp_report_logs"("operator_id");

ALTER TABLE "exp_reports" ADD CONSTRAINT "exp_reports_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exp_reports" ADD CONSTRAINT "exp_reports_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "iam_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exp_reports" ADD CONSTRAINT "exp_reports_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "md_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exp_reports" ADD CONSTRAINT "exp_reports_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "md_cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exp_reports" ADD CONSTRAINT "exp_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "md_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exp_report_items" ADD CONSTRAINT "exp_report_items_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "exp_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exp_report_items" ADD CONSTRAINT "exp_report_items_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "md_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exp_report_items" ADD CONSTRAINT "exp_report_items_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "md_cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exp_report_items" ADD CONSTRAINT "exp_report_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "md_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exp_report_logs" ADD CONSTRAINT "exp_report_logs_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "exp_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exp_report_logs" ADD CONSTRAINT "exp_report_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "iam_permissions" ("id", "code", "name", "description", "created_at", "updated_at")
VALUES
  (concat('perm_', md5('exp:report:read')), 'exp:report:read', '查看报销单', '查看报销单列表和详情', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('perm_', md5('exp:report:write')), 'exp:report:write', '维护报销单', '创建、编辑、提交和作废报销单', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "iam_role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "iam_roles" r
CROSS JOIN "iam_permissions" p
WHERE r."code" = 'ADMIN'
  AND p."code" IN ('exp:report:read', 'exp:report:write')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
