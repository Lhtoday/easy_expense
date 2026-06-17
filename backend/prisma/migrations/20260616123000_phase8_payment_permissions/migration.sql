INSERT INTO "iam_permissions" ("id", "code", "name", "description", "created_at", "updated_at")
VALUES
  ('perm_exp_payment_read', 'exp:payment:read', '查看出纳付款', '查看待付款报销单、付款批次和付款记录', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_exp_payment_pay', 'exp:payment:pay', '登记出纳付款', '登记付款成功、付款失败和重新付款', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "iam_role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "iam_roles" r
JOIN "iam_permissions" p ON p."code" IN ('exp:payment:read', 'exp:payment:pay')
WHERE r."code" = 'ADMIN'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
