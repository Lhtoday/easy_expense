CREATE TYPE "ExpenseAttachmentCategory" AS ENUM ('GENERAL', 'INVOICE_IMAGE', 'PAYMENT_PROOF', 'OTHER');
CREATE TYPE "InvoiceDuplicateStatus" AS ENUM ('UNIQUE', 'DUPLICATE');

CREATE TABLE "exp_attachments" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_bucket" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "category" "ExpenseAttachmentCategory" NOT NULL DEFAULT 'GENERAL',
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "exp_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exp_invoices" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "item_id" TEXT,
    "invoice_code" TEXT,
    "invoice_no" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "seller_name" TEXT NOT NULL,
    "seller_tax_no" TEXT,
    "buyer_name" TEXT,
    "buyer_tax_no" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "tax_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "deductible_tax_cents" INTEGER NOT NULL DEFAULT 0,
    "total_amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "duplicate_status" "InvoiceDuplicateStatus" NOT NULL DEFAULT 'UNIQUE',
    "duplicate_of_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "exp_invoices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exp_attachments_report_id_idx" ON "exp_attachments"("report_id");
CREATE INDEX "exp_attachments_uploaded_by_idx" ON "exp_attachments"("uploaded_by");
CREATE INDEX "exp_invoices_report_id_idx" ON "exp_invoices"("report_id");
CREATE INDEX "exp_invoices_item_id_idx" ON "exp_invoices"("item_id");
CREATE INDEX "exp_invoices_created_by_idx" ON "exp_invoices"("created_by");
CREATE INDEX "exp_invoices_invoice_code_invoice_no_issued_at_total_amount_cents_seller_name_idx"
  ON "exp_invoices"("invoice_code", "invoice_no", "issued_at", "total_amount_cents", "seller_name");

ALTER TABLE "exp_attachments" ADD CONSTRAINT "exp_attachments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "exp_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exp_attachments" ADD CONSTRAINT "exp_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exp_invoices" ADD CONSTRAINT "exp_invoices_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "exp_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exp_invoices" ADD CONSTRAINT "exp_invoices_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "exp_report_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exp_invoices" ADD CONSTRAINT "exp_invoices_duplicate_of_id_fkey" FOREIGN KEY ("duplicate_of_id") REFERENCES "exp_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exp_invoices" ADD CONSTRAINT "exp_invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "iam_permissions" ("id", "code", "name", "description", "created_at", "updated_at")
VALUES
  (concat('perm_', md5('exp:attachment:read')), 'exp:attachment:read', '查看报销附件', '查看报销单附件元数据和下载入口', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('perm_', md5('exp:attachment:write')), 'exp:attachment:write', '维护报销附件', '登记和删除报销单附件元数据', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('perm_', md5('exp:invoice:read')), 'exp:invoice:read', '查看发票信息', '查看报销单发票元数据和重复校验结果', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('perm_', md5('exp:invoice:write')), 'exp:invoice:write', '维护发票信息', '录入和删除报销单发票元数据', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "iam_role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "iam_roles" r
CROSS JOIN "iam_permissions" p
WHERE r."code" = 'ADMIN'
  AND p."code" IN ('exp:attachment:read', 'exp:attachment:write', 'exp:invoice:read', 'exp:invoice:write')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
