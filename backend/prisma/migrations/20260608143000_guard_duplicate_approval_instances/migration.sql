-- Prevent concurrent or manual duplicate in-progress approval instances for the same report.
CREATE UNIQUE INDEX "exp_approval_instances_one_in_progress_per_report"
ON "exp_approval_instances"("report_id")
WHERE "status" = 'IN_PROGRESS';
