INSERT INTO "iam_permissions" ("id", "code", "name", "description", "created_at", "updated_at")
VALUES
  ('perm_exp_budget_read', 'exp:budget:read', '查看预算', '查看预算额度、占用、确认和实际发生情况', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_exp_budget_write', 'exp:budget:write', '维护预算', '维护预算额度、控制方式和预算调整入口', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "iam_role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "iam_roles" r
JOIN "iam_permissions" p ON p."code" IN ('exp:budget:read', 'exp:budget:write')
WHERE r."code" = 'ADMIN'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
