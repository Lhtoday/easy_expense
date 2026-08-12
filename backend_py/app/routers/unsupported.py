from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.errors import BusinessError
from app.security import CurrentUser, require_current_user


router = APIRouter(tags=["migration-guard"])


def pending(action: str):
    raise BusinessError(501, "PYTHON_MIGRATION_PENDING", f"{action} has not been migrated to FastAPI yet")


@router.post("/expense-reports/{report_id}/submit")
@router.post("/expense-reports/{report_id}/withdraw")
@router.post("/expense-reports")
@router.patch("/expense-reports/{report_id}")
@router.delete("/expense-reports/{report_id}")
@router.post("/expense-reports/{report_id}/attachments")
@router.post("/expense-reports/{report_id}/attachments/upload")
@router.get("/expense-reports/{report_id}/attachments/{attachment_id}/download")
@router.get("/expense-reports/{report_id}/attachments/{attachment_id}/preview")
@router.delete("/expense-reports/{report_id}/attachments/{attachment_id}")
@router.post("/expense-reports/{report_id}/invoices")
@router.patch("/expense-reports/{report_id}/invoices/{invoice_id}")
@router.delete("/expense-reports/{report_id}/invoices/{invoice_id}")
@router.post("/approvals/tasks/{task_id}/approve")
@router.post("/approvals/tasks/{task_id}/reject")
@router.post("/finance-reviews/reports/{report_id}/approve")
@router.post("/finance-reviews/reports/{report_id}/return")
@router.post("/finance-reviews/reports/{report_id}/reject")
@router.patch("/finance-reviews/reports/{report_id}/items/{item_id}")
@router.post("/payments/reports/{report_id}/register")
@router.post("/payments/reports/{report_id}/fail")
@router.post("/vouchers/reports/{report_id}/generate")
@router.post("/vouchers/reports/{report_id}/void-drafts")
@router.post("/vouchers/{voucher_id}/confirm")
@router.post("/budgets/reconcile-paid-report/{report_id}")
def guarded_mutation(user: CurrentUser = Depends(require_current_user)):
    _ = user
    pending("This financial workflow action")


@router.get("/approvals/tasks")
def approval_tasks(user: CurrentUser = Depends(require_current_user)):
    _ = user
    return {"success": True, "data": {"items": [], "page": 1, "pageSize": 20, "total": 0}}


@router.get("/vouchers/reports/{report_id}/preview")
def voucher_preview(user: CurrentUser = Depends(require_current_user)):
    _ = user
    pending("Voucher preview")
