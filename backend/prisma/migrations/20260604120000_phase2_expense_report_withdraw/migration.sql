ALTER TYPE "ExpenseReportAction" ADD VALUE IF NOT EXISTS 'WITHDRAW';

INSERT INTO "iam_permissions" ("id", "code", "name", "description", "created_at", "updated_at")
VALUES
  (concat('perm_', md5('exp:report:withdraw')), 'exp:report:withdraw', '撤回报销单', '撤回本人已提交且尚未进入审批处理的报销单', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "iam_role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "iam_roles" r
CROSS JOIN "iam_permissions" p
WHERE r."code" = 'ADMIN'
  AND p."code" = 'exp:report:withdraw'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
