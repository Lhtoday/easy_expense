ALTER TYPE "ExpenseReportStatus" ADD VALUE IF NOT EXISTS 'BUSINESS_APPROVED';
ALTER TYPE "ExpenseReportStatus" ADD VALUE IF NOT EXISTS 'FINANCE_APPROVED';
ALTER TYPE "ExpenseReportStatus" ADD VALUE IF NOT EXISTS 'FINANCE_REJECTED';

ALTER TYPE "ExpenseReportAction" ADD VALUE IF NOT EXISTS 'FINANCE_APPROVE';
ALTER TYPE "ExpenseReportAction" ADD VALUE IF NOT EXISTS 'FINANCE_RETURN';
ALTER TYPE "ExpenseReportAction" ADD VALUE IF NOT EXISTS 'FINANCE_REJECT';

CREATE TYPE "FinanceReviewAction" AS ENUM ('APPROVE', 'RETURN', 'REJECT');

CREATE TABLE "exp_finance_reviews" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "action" "FinanceReviewAction" NOT NULL,
    "from_status" "ExpenseReportStatus" NOT NULL,
    "to_status" "ExpenseReportStatus" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_finance_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exp_finance_reviews_report_id_idx" ON "exp_finance_reviews"("report_id");
CREATE INDEX "exp_finance_reviews_operator_id_idx" ON "exp_finance_reviews"("operator_id");

ALTER TABLE "exp_finance_reviews" ADD CONSTRAINT "exp_finance_reviews_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "exp_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exp_finance_reviews" ADD CONSTRAINT "exp_finance_reviews_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "iam_permissions" ("id", "code", "name", "description", "created_at", "updated_at")
VALUES
  (concat('perm_', md5('exp:finance-review:read')), 'exp:finance-review:read', '查看财务审核', '查看待财务审核、已审核报销单和财务审核记录', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('perm_', md5('exp:finance-review:review')), 'exp:finance-review:review', '处理财务审核', '执行财务审核通过、退回补充或拒绝', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "iam_role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "iam_roles" r
JOIN "iam_permissions" p ON p."code" IN ('exp:finance-review:read', 'exp:finance-review:review')
WHERE r."code" = 'ADMIN'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
