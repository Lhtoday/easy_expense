INSERT INTO "iam_permissions" ("id", "code", "name", "description", "created_at", "updated_at")
VALUES
  ('perm_report_dashboard_read', 'report:dashboard:read', '查看经营看板', '查看费用趋势、预算执行、审批耗时和异常分析', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "iam_role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "iam_roles" r
JOIN "iam_permissions" p ON p."code" = 'report:dashboard:read'
WHERE r."code" = 'ADMIN'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
