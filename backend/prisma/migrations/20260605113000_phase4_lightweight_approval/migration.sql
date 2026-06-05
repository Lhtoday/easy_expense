ALTER TYPE "ExpenseReportStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "ExpenseReportStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TYPE "ExpenseReportAction" ADD VALUE IF NOT EXISTS 'APPROVE';
ALTER TYPE "ExpenseReportAction" ADD VALUE IF NOT EXISTS 'REJECT';

CREATE TYPE "ApprovalFlowConfigStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "ApprovalInstanceStatus" AS ENUM ('IN_PROGRESS', 'APPROVED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "ApprovalTaskStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "ApprovalAction" AS ENUM ('CREATE', 'APPROVE', 'REJECT', 'WITHDRAW');

CREATE TABLE "exp_approval_flow_configs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "approver_role_code" TEXT NOT NULL,
    "status" "ApprovalFlowConfigStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exp_approval_flow_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exp_approval_instances" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "flow_config_id" TEXT NOT NULL,
    "status" "ApprovalInstanceStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_by" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exp_approval_instances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exp_approval_tasks" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "node_code" TEXT NOT NULL,
    "node_name" TEXT NOT NULL,
    "assignee_id" TEXT NOT NULL,
    "status" "ApprovalTaskStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "exp_approval_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exp_approval_logs" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "task_id" TEXT,
    "operator_id" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "from_status" "ApprovalTaskStatus",
    "to_status" "ApprovalTaskStatus",
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exp_approval_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exp_approval_flow_configs_code_key" ON "exp_approval_flow_configs"("code");
CREATE INDEX "exp_approval_instances_report_id_status_idx" ON "exp_approval_instances"("report_id", "status");
CREATE INDEX "exp_approval_instances_flow_config_id_idx" ON "exp_approval_instances"("flow_config_id");
CREATE INDEX "exp_approval_tasks_assignee_id_status_idx" ON "exp_approval_tasks"("assignee_id", "status");
CREATE INDEX "exp_approval_tasks_report_id_idx" ON "exp_approval_tasks"("report_id");
CREATE INDEX "exp_approval_tasks_instance_id_idx" ON "exp_approval_tasks"("instance_id");
CREATE INDEX "exp_approval_logs_instance_id_idx" ON "exp_approval_logs"("instance_id");
CREATE INDEX "exp_approval_logs_task_id_idx" ON "exp_approval_logs"("task_id");
CREATE INDEX "exp_approval_logs_operator_id_idx" ON "exp_approval_logs"("operator_id");

ALTER TABLE "exp_approval_instances" ADD CONSTRAINT "exp_approval_instances_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "exp_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exp_approval_instances" ADD CONSTRAINT "exp_approval_instances_flow_config_id_fkey" FOREIGN KEY ("flow_config_id") REFERENCES "exp_approval_flow_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exp_approval_tasks" ADD CONSTRAINT "exp_approval_tasks_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "exp_approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exp_approval_tasks" ADD CONSTRAINT "exp_approval_tasks_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "exp_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exp_approval_tasks" ADD CONSTRAINT "exp_approval_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exp_approval_logs" ADD CONSTRAINT "exp_approval_logs_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "exp_approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exp_approval_logs" ADD CONSTRAINT "exp_approval_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "exp_approval_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exp_approval_logs" ADD CONSTRAINT "exp_approval_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "exp_approval_flow_configs" ("id", "code", "name", "description", "approver_role_code", "status", "created_at", "updated_at")
VALUES (
  concat('flow_', md5('DEFAULT_EXPENSE_APPROVAL')),
  'DEFAULT_EXPENSE_APPROVAL',
  '默认报销主管审批',
  'MVP 阶段默认轻量审批流：提交后创建一个主管审批任务',
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
  (concat('perm_', md5('exp:approval:read')), 'exp:approval:read', '查看审批任务', '查看报销审批待办、已办和审批记录', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('perm_', md5('exp:approval:approve')), 'exp:approval:approve', '处理报销审批', '通过或驳回报销审批任务', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "iam_role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "iam_roles" r
CROSS JOIN "iam_permissions" p
WHERE r."code" = 'ADMIN'
  AND p."code" IN ('exp:approval:read', 'exp:approval:approve')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
