from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import BusinessError
from app.core.response import page_result
from app.db import get_db, row_to_dict, table
from app.security import CurrentUser, require_current_user, require_permission


router = APIRouter(tags=["read-models"])


REPORT_PERMISSIONS = {
    "/expense-reports": "exp:report:read",
    "/finance-reviews/reports": "exp:finance-review:read",
    "/payments/reports": "exp:payment:read",
    "/vouchers/reports": "gl:voucher:read",
}


@router.get("/audit-logs")
def audit_logs(page: int = Query(1, ge=1), pageSize: int = Query(20, ge=1, le=100), user: CurrentUser = Depends(require_current_user), db: Session = Depends(get_db)):
    require_permission(user, "sys:audit:read")
    logs = table("sys_audit_logs")
    total = db.execute(select(func.count()).select_from(logs)).scalar_one()
    rows = db.execute(select(logs).order_by(logs.c.created_at.desc()).offset((page - 1) * pageSize).limit(pageSize)).all()
    return {"success": True, "data": page_result([row_to_dict(row._mapping) for row in rows], page, pageSize, total)}


@router.get("/expense-reports")
@router.get("/finance-reviews/reports")
@router.get("/payments/reports")
@router.get("/vouchers/reports")
def report_list(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = None,
    status: Optional[str] = None,
    user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    require_permission(user, "exp:report:read")
    reports = table("exp_reports")
    conditions = [reports.c.deleted_at.is_(None)]
    if keyword:
        conditions.append(or_(reports.c.report_no.ilike(f"%{keyword}%"), reports.c.title.ilike(f"%{keyword}%")))
    if status:
        conditions.append(reports.c.status == status)
    where_clause = and_(*conditions)
    total = db.execute(select(func.count()).select_from(reports).where(where_clause)).scalar_one()
    rows = db.execute(select(reports).where(where_clause).order_by(reports.c.created_at.desc()).offset((page - 1) * pageSize).limit(pageSize)).all()
    return {"success": True, "data": page_result([hydrate_report(db, row_to_dict(row._mapping)) for row in rows], page, pageSize, total)}


@router.get("/expense-reports/{report_id}")
@router.get("/finance-reviews/reports/{report_id}")
@router.get("/payments/reports/{report_id}")
@router.get("/vouchers/reports/{report_id}")
def report_detail(report_id: str, user: CurrentUser = Depends(require_current_user), db: Session = Depends(get_db)):
    require_permission(user, "exp:report:read")
    reports = table("exp_reports")
    row = db.execute(select(reports).where(reports.c.id == report_id, reports.c.deleted_at.is_(None))).first()
    if not row:
        raise BusinessError(404, "NOT_FOUND", "Expense report does not exist")
    return {"success": True, "data": hydrate_report(db, row_to_dict(row._mapping), detail=True)}


@router.get("/reports/dashboard")
def dashboard(user: CurrentUser = Depends(require_current_user), db: Session = Depends(get_db)):
    require_permission(user, "report:dashboard:read")
    reports = table("exp_reports")
    total_reports = db.execute(select(func.count()).select_from(reports).where(reports.c.deleted_at.is_(None))).scalar_one()
    total_amount = db.execute(select(func.coalesce(func.sum(reports.c.reimbursable_cents), 0)).where(reports.c.deleted_at.is_(None))).scalar_one()
    return {"success": True, "data": {"totalReports": total_reports, "totalReimbursableCents": int(total_amount), "statusSummary": []}}


@router.get("/reports/audit-chain")
def audit_chain(page: int = Query(1, ge=1), pageSize: int = Query(20, ge=1, le=100), user: CurrentUser = Depends(require_current_user), db: Session = Depends(get_db)):
    require_permission(user, "report:dashboard:read")
    logs = table("exp_report_logs")
    total = db.execute(select(func.count()).select_from(logs)).scalar_one()
    rows = db.execute(select(logs).order_by(logs.c.created_at.desc()).offset((page - 1) * pageSize).limit(pageSize)).all()
    return {"success": True, "data": page_result([row_to_dict(row._mapping) for row in rows], page, pageSize, total)}


def child_rows(db: Session, table_name: str, report_id: str) -> list[dict]:
    model = table(table_name)
    if "deleted_at" in model.c:
        rows = db.execute(select(model).where(model.c.report_id == report_id, model.c.deleted_at.is_(None))).all()
    else:
        rows = db.execute(select(model).where(model.c.report_id == report_id)).all()
    return [row_to_dict(row._mapping) for row in rows]


def hydrate_report(db: Session, report: dict, detail: bool = False) -> dict:
    report_id = report["id"]
    report["items"] = child_rows(db, "exp_report_items", report_id)
    report["logs"] = child_rows(db, "exp_report_logs", report_id)
    report["payments"] = child_rows(db, "exp_payments", report_id)
    report["vouchers"] = child_rows(db, "gl_vouchers", report_id)
    if detail:
        report["attachments"] = child_rows(db, "exp_attachments", report_id)
        report["invoices"] = child_rows(db, "exp_invoices", report_id)
        report["financeReviews"] = child_rows(db, "exp_finance_reviews", report_id)
        report["budgetChecks"] = child_rows(db, "bud_checks", report_id)
        report["budgetOccupations"] = child_rows(db, "bud_occupations", report_id)
    return report
