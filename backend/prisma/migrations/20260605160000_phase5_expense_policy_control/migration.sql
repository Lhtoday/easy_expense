CREATE TYPE "ExpensePolicyStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "ExpensePolicyAction" AS ENUM ('WARNING', 'BLOCK', 'ESCALATE');
CREATE TYPE "ExpensePolicyCheckResult" AS ENUM ('PASS', 'WARNING', 'BLOCK', 'ESCALATE');

CREATE TABLE "md_expense_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "default_account_subject_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "md_expense_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exp_policies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ExpensePolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "exp_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exp_policy_rules" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "expense_type_code" TEXT,
    "city" TEXT,
    "job_level" TEXT,
    "max_amount_cents" INTEGER,
    "requires_invoice" BOOLEAN NOT NULL DEFAULT false,
    "requires_pre_approval" BOOLEAN NOT NULL DEFAULT false,
    "action" "ExpensePolicyAction" NOT NULL DEFAULT 'WARNING',
    "status" "ExpensePolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exp_policy_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exp_policy_checks" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "item_id" TEXT,
    "policy_id" TEXT,
    "rule_id" TEXT,
    "result" "ExpensePolicyCheckResult" NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_policy_checks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "md_expense_types_code_key" ON "md_expense_types"("code");
CREATE UNIQUE INDEX "exp_policies_code_key" ON "exp_policies"("code");
CREATE UNIQUE INDEX "exp_policy_rules_policy_id_code_key" ON "exp_policy_rules"("policy_id", "code");
CREATE INDEX "exp_policy_rules_expense_type_code_idx" ON "exp_policy_rules"("expense_type_code");
CREATE INDEX "exp_policy_checks_report_id_result_idx" ON "exp_policy_checks"("report_id", "result");
CREATE INDEX "exp_policy_checks_item_id_idx" ON "exp_policy_checks"("item_id");
CREATE INDEX "exp_policy_checks_rule_id_idx" ON "exp_policy_checks"("rule_id");

ALTER TABLE "exp_policy_rules" ADD CONSTRAINT "exp_policy_rules_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "exp_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exp_policy_checks" ADD CONSTRAINT "exp_policy_checks_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "exp_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exp_policy_checks" ADD CONSTRAINT "exp_policy_checks_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "exp_report_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exp_policy_checks" ADD CONSTRAINT "exp_policy_checks_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "exp_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exp_policy_checks" ADD CONSTRAINT "exp_policy_checks_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "exp_policy_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "md_expense_types" ("id", "code", "name", "description", "default_account_subject_code", "created_at", "updated_at")
VALUES
  (concat('etype_', md5('TRAVEL')), 'TRAVEL', 'Travel', 'Travel related expenses such as transport, lodging and allowance.', '660201', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('etype_', md5('TRANSPORT')), 'TRANSPORT', 'Transport', 'Local transport, taxi and public transit expenses.', '660202', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('etype_', md5('ENTERTAINMENT')), 'ENTERTAINMENT', 'Entertainment', 'Customer reception and business meal expenses.', '660203', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('etype_', md5('OFFICE')), 'OFFICE', 'Office', 'Office supplies and low-value consumable expenses.', '660204', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('etype_', md5('OTHER')), 'OTHER', 'Other', 'Expenses outside standard categories.', '660299', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "default_account_subject_code" = EXCLUDED."default_account_subject_code",
  "status" = 'ACTIVE',
  "deleted_at" = NULL,
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "exp_policies" ("id", "code", "name", "description", "status", "created_at", "updated_at")
VALUES (
  concat('policy_', md5('MVP_EXPENSE_POLICY')),
  'MVP_EXPENSE_POLICY',
  'MVP Expense Policy',
  'Phase 5 default expense controls for invoice requirements, single-item limits and escalation.',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "status" = EXCLUDED."status",
  "deleted_at" = NULL,
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "exp_policy_rules" (
  "id", "policy_id", "code", "name", "description", "expense_type_code", "max_amount_cents",
  "requires_invoice", "requires_pre_approval", "action", "status", "created_at", "updated_at"
)
SELECT concat('prule_', md5(r."code")), p."id", r."code", r."name", r."description", r."expense_type_code", r."max_amount_cents",
       r."requires_invoice", r."requires_pre_approval", r."action"::"ExpensePolicyAction", 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "exp_policies" p
CROSS JOIN (
  VALUES
    ('TRAVEL_INVOICE_REQUIRED', 'Travel invoice required', 'Travel items must link at least one invoice before submission.', 'TRAVEL', NULL::INTEGER, true, false, 'BLOCK'),
    ('ENTERTAINMENT_SINGLE_LIMIT', 'Entertainment single-item limit', 'Entertainment reimbursable amount above CNY 1000 requires escalated approval.', 'ENTERTAINMENT', 100000, false, false, 'ESCALATE'),
    ('OFFICE_SINGLE_LIMIT', 'Office single-item limit', 'Office reimbursable amount above CNY 5000 is blocked from submission.', 'OFFICE', 500000, false, false, 'BLOCK'),
    ('OTHER_PRE_APPROVAL_REQUIRED', 'Other pre-approval required', 'Other expenses should provide pre-approval support and trigger a warning when missing.', 'OTHER', NULL::INTEGER, false, true, 'WARNING')
) AS r("code", "name", "description", "expense_type_code", "max_amount_cents", "requires_invoice", "requires_pre_approval", "action")
WHERE p."code" = 'MVP_EXPENSE_POLICY'
ON CONFLICT ("policy_id", "code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "expense_type_code" = EXCLUDED."expense_type_code",
  "max_amount_cents" = EXCLUDED."max_amount_cents",
  "requires_invoice" = EXCLUDED."requires_invoice",
  "requires_pre_approval" = EXCLUDED."requires_pre_approval",
  "action" = EXCLUDED."action",
  "status" = EXCLUDED."status",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "exp_approval_flow_configs" ("id", "code", "name", "description", "approver_role_code", "status", "created_at", "updated_at")
VALUES (
  concat('flow_', md5('ESCALATED_EXPENSE_APPROVAL')),
  'ESCALATED_EXPENSE_APPROVAL',
  'Escalated Expense Approval',
  'Approval flow created when expense policy escalation rules are matched. MVP assigns it to ADMIN.',
  'ADMIN',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "approver_role_code" = EXCLUDED."approver_role_code",
  "status" = EXCLUDED."status",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "iam_permissions" ("id", "code", "name", "description", "created_at", "updated_at")
VALUES
  (concat('perm_', md5('exp:policy:read')), 'exp:policy:read', 'Read expense policies', 'View expense types, policies and rules.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('perm_', md5('exp:policy:write')), 'exp:policy:write', 'Manage expense policies', 'Manage expense types, policies and rules.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "iam_role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "iam_roles" r
CROSS JOIN "iam_permissions" p
WHERE r."code" = 'ADMIN'
  AND p."code" IN ('exp:policy:read', 'exp:policy:write')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
