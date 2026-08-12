from __future__ import annotations

from datetime import datetime
from uuid import uuid4
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.core.errors import BusinessError
from app.core.response import page_result
from app.db import get_db, row_to_dict, table
from app.security import CurrentUser, require_current_user, require_permission


class GenericPayload(BaseModel):
    class Config:
        extra = "allow"


def new_id() -> str:
    return f"py_{uuid4().hex}"


RESOURCE_CONFIG = {
    "departments": {
        "table": "md_departments",
        "read": "md:department:read",
        "write": "md:department:write",
        "columns": ["id", "code", "name", "parent_id", "status", "created_at"],
        "create": ["code", "name", "parent_id"],
        "update": ["name", "parent_id", "status"],
        "audit_entity": "department",
        "audit": {},
    },
    "cost-centers": {
        "table": "md_cost_centers",
        "read": "md:cost-center:read",
        "write": "md:cost-center:write",
        "columns": ["id", "code", "name", "department_id", "status", "created_at"],
        "create": ["code", "name", "department_id"],
        "update": ["name", "department_id", "status"],
        "audit_entity": "cost-center",
        "audit": {},
    },
    "projects": {
        "table": "md_projects",
        "read": "md:project:read",
        "write": "md:project:write",
        "columns": ["id", "code", "name", "owner_user_id", "department_id", "cost_center_id", "status", "created_at"],
        "create": ["code", "name", "owner_user_id", "department_id", "cost_center_id"],
        "update": ["name", "owner_user_id", "department_id", "cost_center_id", "status"],
        "audit_entity": "project",
        "audit": {},
    },
    "expense-types": {
        "table": "md_expense_types",
        "read": "exp:policy:read",
        "write": "exp:policy:write",
        "columns": ["id", "code", "name", "description", "default_account_subject_code", "status", "created_at"],
        "create": ["code", "name", "description", "default_account_subject_code"],
        "update": ["name", "description", "default_account_subject_code", "status"],
        "audit_entity": "expense-type",
        "audit": {"create": "EXPENSE_TYPE_CREATE", "update": "EXPENSE_TYPE_UPDATE", "delete": "EXPENSE_TYPE_DISABLE"},
    },
    "account-subjects": {
        "table": "gl_account_subjects",
        "read": "gl:account:read",
        "write": "gl:account:write",
        "columns": ["id", "code", "name", "category", "normal_balance", "description", "status", "created_at"],
        "create": ["code", "name", "category", "normal_balance", "description"],
        "update": ["name", "category", "normal_balance", "description", "status"],
        "audit_entity": "gl-account-subject",
        "audit": {"create": "ACCOUNT_SUBJECT_CREATE", "update": "ACCOUNT_SUBJECT_UPDATE", "delete": "ACCOUNT_SUBJECT_DISABLE"},
    },
    "account-mappings": {
        "table": "gl_account_mappings",
        "read": "gl:account:read",
        "write": "gl:account:write",
        "columns": [
            "id",
            "purpose",
            "expense_type_code",
            "applicant_id",
            "payment_method",
            "payer_account",
            "department_id",
            "cost_center_id",
            "project_id",
            "account_subject_code",
            "priority",
            "status",
            "effective_from",
            "effective_to",
            "created_at",
        ],
        "create": [
            "purpose",
            "expense_type_code",
            "applicant_id",
            "payment_method",
            "payer_account",
            "department_id",
            "cost_center_id",
            "project_id",
            "account_subject_code",
            "priority",
            "effective_from",
            "effective_to",
        ],
        "update": [
            "purpose",
            "expense_type_code",
            "applicant_id",
            "payment_method",
            "payer_account",
            "department_id",
            "cost_center_id",
            "project_id",
            "account_subject_code",
            "priority",
            "status",
            "effective_from",
            "effective_to",
        ],
        "audit_entity": "gl-account-mapping",
        "audit": {"create": "ACCOUNT_MAPPING_CREATE", "update": "ACCOUNT_MAPPING_UPDATE", "delete": "ACCOUNT_MAPPING_DISABLE"},
    },
    "expense-policies": {
        "table": "exp_policies",
        "read": "exp:policy:read",
        "write": "exp:policy:write",
        "columns": ["id", "code", "name", "description", "status", "effective_from", "effective_to", "created_at"],
        "create": ["code", "name", "description", "effective_from", "effective_to"],
        "update": ["name", "description", "status", "effective_from", "effective_to"],
        "audit_entity": "expense-policy",
        "audit": {"create": "POLICY_CREATE", "update": "POLICY_UPDATE", "delete": "POLICY_DISABLE"},
    },
    "budgets": {
        "table": "bud_budgets",
        "read": "exp:budget:read",
        "write": "exp:budget:write",
        "columns": [
            "id",
            "code",
            "name",
            "fiscal_period",
            "department_id",
            "cost_center_id",
            "project_id",
            "expense_type_code",
            "account_subject_code",
            "currency",
            "total_cents",
            "in_transit_cents",
            "approved_cents",
            "actual_cents",
            "warning_threshold_bps",
            "control_mode",
            "status",
            "created_at",
        ],
        "create": [
            "code",
            "name",
            "fiscal_period",
            "department_id",
            "cost_center_id",
            "project_id",
            "expense_type_code",
            "account_subject_code",
            "currency",
            "total_cents",
            "warning_threshold_bps",
            "control_mode",
        ],
        "update": [
            "name",
            "department_id",
            "cost_center_id",
            "project_id",
            "expense_type_code",
            "account_subject_code",
            "total_cents",
            "warning_threshold_bps",
            "control_mode",
            "status",
        ],
        "audit_entity": "budget",
        "audit": {"create": "BUDGET_CREATE", "update": "BUDGET_UPDATE", "delete": "BUDGET_DISABLE"},
    },
}


def payload_dict(body: GenericPayload) -> dict:
    data = body.dict(exclude_unset=True)
    return {key: (None if value == "" else value) for key, value in data.items()}


def snake(name: str) -> str:
    out = []
    for char in name:
        if char.isupper():
            out.extend(["_", char.lower()])
        else:
            out.append(char)
    return "".join(out)


def select_columns(model, names: list[str]):
    return [model.c[name] for name in names if name in model.c]


def find_row(db: Session, model, item_id: str, columns: list[str]) -> dict:
    row = db.execute(select(*select_columns(model, columns)).where(model.c.id == item_id)).first()
    if not row:
        raise BusinessError(404, "NOT_FOUND", "Resource does not exist")
    return row_to_dict(row)


def add_crud_routes(router: APIRouter, resource: str, config: dict) -> None:
    @router.get(f"/{resource}")
    def list_items(
        page: int = Query(1, ge=1),
        pageSize: int = Query(20, ge=1, le=100),
        keyword: Optional[str] = None,
        user: CurrentUser = Depends(require_current_user),
        db: Session = Depends(get_db),
    ):
        model = table(config["table"])
        require_permission(user, config["read"])
        conditions = []
        if "deleted_at" in model.c:
            conditions.append(model.c.deleted_at.is_(None))
        if keyword:
            search_columns = [model.c[name] for name in ("code", "name", "email") if name in model.c]
            conditions.append(or_(*[column.ilike(f"%{keyword}%") for column in search_columns]))
        where_clause = and_(*conditions) if conditions else None
        count_query = select(func.count()).select_from(model)
        item_query = select(*select_columns(model, config["columns"])).offset((page - 1) * pageSize).limit(pageSize)
        if where_clause is not None:
            count_query = count_query.where(where_clause)
            item_query = item_query.where(where_clause)
        if "code" in model.c:
            item_query = item_query.order_by(model.c.code.asc())
        else:
            item_query = item_query.order_by(model.c.created_at.desc())
        total = db.execute(count_query).scalar_one()
        items = [row_to_dict(row) for row in db.execute(item_query).all()]
        return {"success": True, "data": page_result(items, page, pageSize, total)}

    @router.post(f"/{resource}")
    def create_item(body: GenericPayload, user: CurrentUser = Depends(require_current_user), db: Session = Depends(get_db)):
        model = table(config["table"])
        require_permission(user, config["write"])
        values = {snake(key): value for key, value in payload_dict(body).items() if snake(key) in config["create"]}
        values["id"] = new_id()
        if "created_by" in model.c:
            values["created_by"] = user.id
        if "created_by_id" in model.c:
            values["created_by"] = user.id
        if "updated_at" in model.c:
            values["updated_at"] = datetime.utcnow()
        row = db.execute(model.insert().values(**values).returning(*select_columns(model, config["columns"]))).first()
        item = row_to_dict(row)
        if config["audit"].get("create"):
            record_audit(db, operator=user, action=config["audit"]["create"], entity_type=config["audit_entity"], entity_id=item["id"], after=item)
        db.commit()
        return {"success": True, "data": item}

    @router.patch(f"/{resource}/{{item_id}}")
    def update_item(item_id: str, body: GenericPayload, user: CurrentUser = Depends(require_current_user), db: Session = Depends(get_db)):
        model = table(config["table"])
        require_permission(user, config["write"])
        before = find_row(db, model, item_id, config["columns"])
        values = {snake(key): value for key, value in payload_dict(body).items() if snake(key) in config["update"]}
        if "updated_at" in model.c:
            values["updated_at"] = datetime.utcnow()
        row = db.execute(model.update().where(model.c.id == item_id).values(**values).returning(*select_columns(model, config["columns"]))).first()
        item = row_to_dict(row)
        if config["audit"].get("update"):
            record_audit(db, operator=user, action=config["audit"]["update"], entity_type=config["audit_entity"], entity_id=item_id, before=before, after=item)
        db.commit()
        return {"success": True, "data": item}

    @router.delete(f"/{resource}/{{item_id}}")
    def remove_item(item_id: str, user: CurrentUser = Depends(require_current_user), db: Session = Depends(get_db)):
        model = table(config["table"])
        require_permission(user, config["write"])
        before = find_row(db, model, item_id, config["columns"])
        if "deleted_at" in model.c:
            row = db.execute(model.update().where(model.c.id == item_id).values(deleted_at=datetime.utcnow()).returning(*select_columns(model, config["columns"]))).first()
        elif "status" in model.c:
            row = db.execute(model.update().where(model.c.id == item_id).values(status="DISABLED").returning(*select_columns(model, config["columns"]))).first()
        else:
            row = db.execute(model.delete().where(model.c.id == item_id).returning(*select_columns(model, config["columns"]))).first()
        item = row_to_dict(row)
        if config["audit"].get("delete"):
            record_audit(db, operator=user, action=config["audit"]["delete"], entity_type=config["audit_entity"], entity_id=item_id, before=before, after=item)
        db.commit()
        return {"success": True, "data": item}


router = APIRouter(tags=["crud"])
for route_resource, route_config in RESOURCE_CONFIG.items():
    add_crud_routes(router, route_resource, route_config)
