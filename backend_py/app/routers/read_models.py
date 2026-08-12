from __future__ import annotations

from datetime import date, datetime, time
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
def dashboard(
    startDate: Optional[date] = None,
    endDate: Optional[date] = None,
    user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    require_permission(user, "report:dashboard:read")
    reports = table("exp_reports")
    active_reports = report_dashboard_conditions(reports, startDate, endDate)
    report_summary = db.execute(
        select(
            func.count().label("report_count"),
            func.coalesce(func.sum(reports.c.reimbursable_cents), 0).label("reimbursable_cents"),
            func.coalesce(func.sum(reports.c.paid_amount_cents), 0).label("paid_amount_cents"),
        ).where(*active_reports)
    ).first()
    status_rows = db.execute(
        select(
            reports.c.status,
            func.count().label("count"),
            func.coalesce(func.sum(reports.c.reimbursable_cents), 0).label("reimbursable_cents"),
        )
        .where(*active_reports)
        .group_by(reports.c.status)
    ).all()
    by_status = {status: {"count": int(count), "reimbursableCents": int(reimbursable_cents)} for status, count, reimbursable_cents in status_rows}

    vouchers = table("gl_vouchers")
    voucher_confirmed_count = db.execute(
        select(func.count()).select_from(vouchers).where(vouchers.c.status == "CONFIRMED")
    ).scalar_one()
    audit_count = db.execute(select(func.count()).select_from(table("sys_audit_logs"))).scalar_one()

    reimbursable_cents = int(report_summary.reimbursable_cents or 0)
    paid_amount_cents = int(report_summary.paid_amount_cents or 0)
    data = {
        "summary": {
            "reportCount": int(report_summary.report_count or 0),
            "reimbursableCents": reimbursable_cents,
            "paidAmountCents": paid_amount_cents,
            "pendingPaymentCents": max(reimbursable_cents - paid_amount_cents, 0),
            "voucherConfirmedCount": int(voucher_confirmed_count or 0),
            "auditCount": int(audit_count or 0),
            "byStatus": by_status,
        },
        "byDepartment": dimension_summary(db, "department", startDate, endDate),
        "byCostCenter": dimension_summary(db, "costCenter", startDate, endDate),
        "byProject": dimension_summary(db, "project", startDate, endDate),
        "budgetExecution": budget_execution(db),
        "approvalLatency": [],
        "exceptions": exception_summary(db),
    }
    return {"success": True, "data": data}


@router.get("/reports/dimension-drilldown")
def dimension_drilldown(
    dimension: str = Query(..., pattern="^(department|costCenter|project)$"),
    key: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=50),
    startDate: Optional[date] = None,
    endDate: Optional[date] = None,
    user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    require_permission(user, "report:dashboard:read")
    rows = dimension_item_rows(db, dimension, startDate, endDate)
    filtered = [row for row in rows if row["dimensionKey"] == key]
    total = len(filtered)
    page_items = filtered[(page - 1) * pageSize : page * pageSize]
    return {"success": True, "data": page_result(page_items, page, pageSize, total)}


@router.get("/reports/audit-chain")
def audit_chain(page: int = Query(1, ge=1), pageSize: int = Query(20, ge=1, le=100), user: CurrentUser = Depends(require_current_user), db: Session = Depends(get_db)):
    require_permission(user, "report:dashboard:read")
    logs = table("exp_report_logs")
    total = db.execute(select(func.count()).select_from(logs)).scalar_one()
    rows = db.execute(select(logs).order_by(logs.c.created_at.desc()).offset((page - 1) * pageSize).limit(pageSize)).all()
    return {"success": True, "data": page_result([row_to_dict(row._mapping) for row in rows], page, pageSize, total)}


def report_dashboard_conditions(reports, start_date: Optional[date], end_date: Optional[date]) -> list:
    conditions = [
        reports.c.deleted_at.is_(None),
        reports.c.status.notin_(["DRAFT", "VOIDED"]),
    ]
    if start_date:
        conditions.append(reports.c.submitted_at >= datetime.combine(start_date, time.min))
    if end_date:
        conditions.append(reports.c.submitted_at <= datetime.combine(end_date, time.max))
    return conditions


DIMENSION_CONFIG = {
    "department": ("department_id", "md_departments"),
    "costCenter": ("cost_center_id", "md_cost_centers"),
    "project": ("project_id", "md_projects"),
}


def dimension_item_rows(db: Session, dimension: str, start_date: Optional[date], end_date: Optional[date]) -> list[dict]:
    column_name, dimension_table_name = DIMENSION_CONFIG[dimension]
    reports = table("exp_reports")
    items = table("exp_report_items")
    dimension_table = table(dimension_table_name)
    dimension_id = func.coalesce(getattr(items.c, column_name), getattr(reports.c, column_name)).label("dimension_id")
    query = (
        select(
            reports.c.id.label("report_id"),
            reports.c.report_no,
            reports.c.title.label("report_title"),
            reports.c.status.label("report_status"),
            reports.c.currency,
            reports.c.applicant_id,
            reports.c.submitted_at,
            reports.c.reimbursable_cents.label("report_reimbursable_cents"),
            reports.c.paid_amount_cents.label("report_paid_amount_cents"),
            items.c.id.label("item_id"),
            items.c.description.label("item_description"),
            items.c.occurred_at,
            items.c.expense_type_code,
            items.c.account_subject_code,
            items.c.amount_cents,
            items.c.tax_amount_cents,
            items.c.deductible_tax_cents,
            items.c.reimbursable_cents,
            dimension_id,
            dimension_table.c.code.label("dimension_code"),
            dimension_table.c.name.label("dimension_name"),
        )
        .select_from(
            items.join(reports, items.c.report_id == reports.c.id).outerjoin(
                dimension_table,
                dimension_table.c.id == func.coalesce(getattr(items.c, column_name), getattr(reports.c, column_name)),
            )
        )
        .where(*report_dashboard_conditions(reports, start_date, end_date))
        .order_by(reports.c.submitted_at.desc(), reports.c.report_no.asc(), items.c.occurred_at.asc())
    )
    rows = db.execute(query).all()
    return [dimension_drilldown_row(row_to_dict(row._mapping, camel_case=False)) for row in rows]


def dimension_drilldown_row(row: dict) -> dict:
    dimension_id = row.get("dimension_id")
    report_reimbursable = int(row.get("report_reimbursable_cents") or 0)
    item_reimbursable = int(row.get("reimbursable_cents") or 0)
    paid_amount = int(row.get("report_paid_amount_cents") or 0)
    allocated_paid = int(round(paid_amount * item_reimbursable / report_reimbursable)) if report_reimbursable else 0
    return {
        "key": row["item_id"],
        "dimensionKey": dimension_id or "__missing__",
        "dimensionCode": row.get("dimension_code") or "未归集",
        "dimensionName": row.get("dimension_name") or "未归集",
        "reportId": row["report_id"],
        "reportNo": row["report_no"],
        "reportTitle": row["report_title"],
        "reportStatus": row["report_status"],
        "applicantId": row.get("applicant_id"),
        "submittedAt": row.get("submitted_at"),
        "currency": row.get("currency"),
        "itemId": row["item_id"],
        "itemDescription": row["item_description"],
        "occurredAt": row.get("occurred_at"),
        "expenseTypeCode": row.get("expense_type_code"),
        "accountSubjectCode": row.get("account_subject_code"),
        "amountCents": int(row.get("amount_cents") or 0),
        "taxAmountCents": int(row.get("tax_amount_cents") or 0),
        "deductibleTaxCents": int(row.get("deductible_tax_cents") or 0),
        "reimbursableCents": item_reimbursable,
        "paidAmountCents": allocated_paid,
    }


def dimension_summary(db: Session, dimension: str, start_date: Optional[date], end_date: Optional[date]) -> list[dict]:
    rows = dimension_item_rows(db, dimension, start_date, end_date)
    grouped: dict[str, dict] = {}
    report_ids_by_key: dict[str, set[str]] = {}
    for row in rows:
        key = row["dimensionKey"]
        if key not in grouped:
            grouped[key] = {
                "key": key,
                "code": row["dimensionCode"],
                "name": row["dimensionName"],
                "reportCount": 0,
                "itemCount": 0,
                "amountCents": 0,
                "reimbursableCents": 0,
                "paidAmountCents": 0,
            }
            report_ids_by_key[key] = set()
        grouped[key]["itemCount"] += 1
        grouped[key]["amountCents"] += row["amountCents"]
        grouped[key]["reimbursableCents"] += row["reimbursableCents"]
        grouped[key]["paidAmountCents"] += row["paidAmountCents"]
        report_ids_by_key[key].add(row["reportId"])
    for key, report_ids in report_ids_by_key.items():
        grouped[key]["reportCount"] = len(report_ids)
    return sorted(grouped.values(), key=lambda row: row["reimbursableCents"], reverse=True)[:10]


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


def budget_execution(db: Session) -> list[dict]:
    budgets = table("bud_budgets")
    rows = db.execute(
        select(
            budgets.c.id,
            budgets.c.code,
            budgets.c.name,
            budgets.c.fiscal_period,
            budgets.c.department_id,
            budgets.c.cost_center_id,
            budgets.c.project_id,
            budgets.c.expense_type_code,
            budgets.c.account_subject_code,
            budgets.c.currency,
            budgets.c.total_cents,
            budgets.c.in_transit_cents,
            budgets.c.approved_cents,
            budgets.c.actual_cents,
            budgets.c.warning_threshold_bps,
            budgets.c.control_mode,
            budgets.c.status,
            budgets.c.created_at,
        )
        .where(budgets.c.deleted_at.is_(None))
        .order_by(budgets.c.fiscal_period.desc(), budgets.c.code.asc())
        .limit(20)
    ).all()
    items = []
    for row in rows:
        item = row_to_dict(row)
        used_cents = int(item.get("inTransitCents") or 0) + int(item.get("approvedCents") or 0) + int(item.get("actualCents") or 0)
        total_cents = int(item.get("totalCents") or 0)
        item["usedCents"] = used_cents
        item["availableCents"] = max(total_cents - used_cents, 0)
        item["executionBps"] = int(used_cents * 10000 / total_cents) if total_cents else 0
        items.append(item)
    return items


def exception_summary(db: Session) -> dict:
    invoices = table("exp_invoices")
    duplicate_count, duplicate_amount = db.execute(
        select(func.count(), func.coalesce(func.sum(invoices.c.total_amount_cents), 0)).where(
            invoices.c.deleted_at.is_(None),
            invoices.c.duplicate_status == "DUPLICATE",
        )
    ).first()
    unlinked_count, unlinked_amount = db.execute(
        select(func.count(), func.coalesce(func.sum(invoices.c.total_amount_cents), 0)).where(
            invoices.c.deleted_at.is_(None),
            invoices.c.item_id.is_(None),
        )
    ).first()
    return {
        "policy": grouped_exceptions(db, "exp_policy_checks", ["WARNING", "BLOCK", "ESCALATE"]),
        "budget": grouped_exceptions(db, "bud_checks", ["WARNING", "BLOCK"]),
        "duplicateInvoiceCount": int(duplicate_count or 0),
        "duplicateInvoiceAmountCents": int(duplicate_amount or 0),
        "unlinkedInvoiceCount": int(unlinked_count or 0),
        "unlinkedInvoiceAmountCents": int(unlinked_amount or 0),
    }


def grouped_exceptions(db: Session, table_name: str, results: list[str]) -> list[dict]:
    model = table(table_name)
    rows = db.execute(
        select(model.c.result, model.c.message, func.count().label("count"))
        .where(model.c.result.in_(results))
        .group_by(model.c.result, model.c.message)
        .order_by(func.count().desc())
        .limit(10)
    ).all()
    return [{"result": result, "message": message, "count": int(count)} for result, message, count in rows]
