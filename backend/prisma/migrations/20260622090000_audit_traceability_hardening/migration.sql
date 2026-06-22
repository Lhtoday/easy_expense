-- CreateEnum
CREATE TYPE "SystemAuditAction" AS ENUM (
    'LOGIN_SUCCESS',
    'LOGIN_FAILURE',
    'TOKEN_INVALID',
    'USER_CREATE',
    'USER_UPDATE',
    'USER_DISABLE',
    'USER_ROLE_UPDATE',
    'ROLE_CREATE',
    'ROLE_UPDATE',
    'ROLE_DISABLE',
    'ROLE_PERMISSION_UPDATE',
    'ATTACHMENT_PREVIEW',
    'ATTACHMENT_DOWNLOAD',
    'BUDGET_CREATE',
    'BUDGET_UPDATE',
    'BUDGET_ENABLE',
    'BUDGET_DISABLE',
    'EXPENSE_TYPE_CREATE',
    'EXPENSE_TYPE_UPDATE',
    'EXPENSE_TYPE_DISABLE',
    'POLICY_CREATE',
    'POLICY_UPDATE',
    'POLICY_DISABLE',
    'POLICY_RULE_CREATE',
    'POLICY_RULE_UPDATE',
    'POLICY_RULE_DISABLE',
    'VOUCHER_DRAFT_GENERATE',
    'VOUCHER_REGENERATE',
    'VOUCHER_CONFIRM',
    'VOUCHER_VOID'
);

-- CreateTable
CREATE TABLE "sys_audit_logs" (
    "id" TEXT NOT NULL,
    "operator_id" TEXT,
    "actor_email" TEXT,
    "action" "SystemAuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "before_data" JSONB,
    "after_data" JSONB,
    "metadata" JSONB,
    "comment" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sys_audit_logs_operator_id_idx" ON "sys_audit_logs"("operator_id");

-- CreateIndex
CREATE INDEX "sys_audit_logs_actor_email_idx" ON "sys_audit_logs"("actor_email");

-- CreateIndex
CREATE INDEX "sys_audit_logs_entity_type_entity_id_idx" ON "sys_audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "sys_audit_logs_action_idx" ON "sys_audit_logs"("action");

-- CreateIndex
CREATE INDEX "sys_audit_logs_created_at_idx" ON "sys_audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "sys_audit_logs" ADD CONSTRAINT "sys_audit_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "iam_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
