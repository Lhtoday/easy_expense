from __future__ import annotations

from datetime import datetime
from uuid import uuid4
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.core.errors import BusinessError
from app.core.response import page_result
from app.db import get_db, row_to_dict, table
from app.security import CurrentUser, DEFAULT_PERMISSIONS, hash_password, require_current_user, require_permission


router = APIRouter(tags=["identity"])


class GenericPayload(BaseModel):
    class Config:
        extra = "allow"


def new_id() -> str:
    return f"py_{uuid4().hex}"


@router.get("/roles/permissions")
def permissions(user: CurrentUser = Depends(require_current_user)):
    require_permission(user, "iam:role:read")
    return {"success": True, "data": [{"code": code, "name": name} for code, name in DEFAULT_PERMISSIONS]}


@router.get("/users")
def list_users(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = None,
    user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    require_permission(user, "iam:user:read")
    users = table("iam_users")
    conditions = [users.c.deleted_at.is_(None)]
    if keyword:
        conditions.append(or_(users.c.name.ilike(f"%{keyword}%"), users.c.email.ilike(f"%{keyword}%")))
    where_clause = and_(*conditions)
    total = db.execute(select(func.count()).select_from(users).where(where_clause)).scalar_one()
    rows = db.execute(
        select(users.c.id, users.c.employee_no, users.c.email, users.c.name, users.c.status, users.c.department_id, users.c.cost_center_id, users.c.created_at, users.c.deleted_at)
        .where(where_clause)
        .order_by(users.c.created_at.desc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
    ).all()
    items = []
    for row in rows:
        item = row_to_dict(row)
        item["roles"] = user_roles(db, item["id"])
        items.append(item)
    return {"success": True, "data": page_result(items, page, pageSize, total)}


@router.post("/users")
def create_user(body: GenericPayload, operator: CurrentUser = Depends(require_current_user), db: Session = Depends(get_db)):
    require_permission(operator, "iam:user:write")
    data = body.dict(exclude_unset=True)
    item_id = new_id()
    db.execute(
        table("iam_users").insert().values(
            id=item_id,
            employee_no=data["employeeNo"],
            email=data["email"],
            name=data["name"],
            password_hash=hash_password(data["password"]),
            department_id=data.get("departmentId"),
            cost_center_id=data.get("costCenterId"),
            status=data.get("status", "ACTIVE"),
            updated_at=datetime.utcnow(),
        )
    )
    replace_user_roles(db, item_id, data.get("roleIds") or [])
    item = get_user_detail(db, item_id)
    record_audit(db, operator=operator, action="USER_CREATE", entity_type="iam-user", entity_id=item_id, after=item)
    if data.get("roleIds"):
        record_audit(db, operator=operator, action="USER_ROLE_UPDATE", entity_type="iam-user", entity_id=item_id, before={"roleIds": []}, after={"roleIds": data["roleIds"], "roles": item["roles"]})
    db.commit()
    return {"success": True, "data": item}


@router.patch("/users/{item_id}")
def update_user(item_id: str, body: GenericPayload, operator: CurrentUser = Depends(require_current_user), db: Session = Depends(get_db)):
    require_permission(operator, "iam:user:write")
    before = get_user_detail(db, item_id)
    data = body.dict(exclude_unset=True)
    values = {
        "email": data.get("email"),
        "name": data.get("name"),
        "status": data.get("status"),
        "department_id": data.get("departmentId"),
        "cost_center_id": data.get("costCenterId"),
        "updated_at": datetime.utcnow(),
    }
    if data.get("password"):
        values["password_hash"] = hash_password(data["password"])
    values = {key: value for key, value in values.items() if value is not None}
    db.execute(table("iam_users").update().where(table("iam_users").c.id == item_id).values(**values))
    if "roleIds" in data:
        replace_user_roles(db, item_id, data["roleIds"] or [])
    item = get_user_detail(db, item_id)
    record_audit(db, operator=operator, action="USER_UPDATE", entity_type="iam-user", entity_id=item_id, before=before, after=item)
    if "roleIds" in data:
        record_audit(db, operator=operator, action="USER_ROLE_UPDATE", entity_type="iam-user", entity_id=item_id, before={"roles": before["roles"]}, after={"roles": item["roles"]})
    db.commit()
    return {"success": True, "data": item}


@router.delete("/users/{item_id}")
def remove_user(item_id: str, operator: CurrentUser = Depends(require_current_user), db: Session = Depends(get_db)):
    require_permission(operator, "iam:user:write")
    before = get_user_detail(db, item_id)
    db.execute(table("iam_users").update().where(table("iam_users").c.id == item_id).values(deleted_at=datetime.utcnow(), updated_at=datetime.utcnow()))
    item = get_user_detail(db, item_id, include_deleted=True)
    record_audit(db, operator=operator, action="USER_DISABLE", entity_type="iam-user", entity_id=item_id, before=before, after=item)
    db.commit()
    return {"success": True, "data": item}


@router.get("/roles")
def list_roles(page: int = Query(1, ge=1), pageSize: int = Query(20, ge=1, le=100), keyword: Optional[str] = None, user: CurrentUser = Depends(require_current_user), db: Session = Depends(get_db)):
    require_permission(user, "iam:role:read")
    roles = table("iam_roles")
    conditions = [roles.c.deleted_at.is_(None)]
    if keyword:
        conditions.append(or_(roles.c.code.ilike(f"%{keyword}%"), roles.c.name.ilike(f"%{keyword}%")))
    where_clause = and_(*conditions)
    total = db.execute(select(func.count()).select_from(roles).where(where_clause)).scalar_one()
    rows = db.execute(select(roles.c.id, roles.c.code, roles.c.name, roles.c.description, roles.c.status, roles.c.created_at).where(where_clause).order_by(roles.c.code.asc()).offset((page - 1) * pageSize).limit(pageSize)).all()
    items = []
    for row in rows:
        item = row_to_dict(row)
        item["permissions"] = role_permissions(db, item["id"])
        items.append(item)
    return {"success": True, "data": page_result(items, page, pageSize, total)}


@router.post("/roles")
def create_role(body: GenericPayload, operator: CurrentUser = Depends(require_current_user), db: Session = Depends(get_db)):
    require_permission(operator, "iam:role:write")
    data = body.dict(exclude_unset=True)
    item_id = new_id()
    db.execute(table("iam_roles").insert().values(id=item_id, code=data["code"], name=data["name"], description=data.get("description"), status=data.get("status", "ACTIVE"), updated_at=datetime.utcnow()))
    replace_role_permissions(db, item_id, data.get("permissionCodes") or [])
    item = get_role_detail(db, item_id)
    record_audit(db, operator=operator, action="ROLE_CREATE", entity_type="iam-role", entity_id=item_id, after=item)
    db.commit()
    return {"success": True, "data": item}


@router.patch("/roles/{item_id}")
def update_role(item_id: str, body: GenericPayload, operator: CurrentUser = Depends(require_current_user), db: Session = Depends(get_db)):
    require_permission(operator, "iam:role:write")
    before = get_role_detail(db, item_id)
    data = body.dict(exclude_unset=True)
    values = {key: data[key] for key in ("name", "description", "status") if key in data}
    values["updated_at"] = datetime.utcnow()
    db.execute(table("iam_roles").update().where(table("iam_roles").c.id == item_id).values(**values))
    if "permissionCodes" in data:
        replace_role_permissions(db, item_id, data["permissionCodes"] or [])
    item = get_role_detail(db, item_id)
    record_audit(db, operator=operator, action="ROLE_UPDATE", entity_type="iam-role", entity_id=item_id, before=before, after=item)
    if "permissionCodes" in data:
        record_audit(db, operator=operator, action="ROLE_PERMISSION_UPDATE", entity_type="iam-role", entity_id=item_id, before={"permissions": before["permissions"]}, after={"permissions": item["permissions"]})
    db.commit()
    return {"success": True, "data": item}


@router.delete("/roles/{item_id}")
def remove_role(item_id: str, operator: CurrentUser = Depends(require_current_user), db: Session = Depends(get_db)):
    require_permission(operator, "iam:role:write")
    before = get_role_detail(db, item_id)
    db.execute(table("iam_roles").update().where(table("iam_roles").c.id == item_id).values(deleted_at=datetime.utcnow(), status="DISABLED", updated_at=datetime.utcnow()))
    item = get_role_detail(db, item_id, include_deleted=True)
    record_audit(db, operator=operator, action="ROLE_DISABLE", entity_type="iam-role", entity_id=item_id, before=before, after=item)
    db.commit()
    return {"success": True, "data": item}


def user_roles(db: Session, user_id: str) -> list[dict]:
    rows = db.execute(select(table("iam_roles").c.id, table("iam_roles").c.code, table("iam_roles").c.name).select_from(table("iam_user_roles").join(table("iam_roles"), table("iam_user_roles").c.role_id == table("iam_roles").c.id)).where(table("iam_user_roles").c.user_id == user_id)).all()
    return [{"role": row_to_dict(row)} for row in rows]


def role_permissions(db: Session, role_id: str) -> list[dict]:
    rows = db.execute(select(table("iam_permissions").c.code, table("iam_permissions").c.name).select_from(table("iam_role_permissions").join(table("iam_permissions"), table("iam_role_permissions").c.permission_id == table("iam_permissions").c.id)).where(table("iam_role_permissions").c.role_id == role_id)).all()
    return [row_to_dict(row) for row in rows]


def replace_user_roles(db: Session, user_id: str, role_ids: list[str]) -> None:
    db.execute(delete(table("iam_user_roles")).where(table("iam_user_roles").c.user_id == user_id))
    for role_id in role_ids:
        db.execute(table("iam_user_roles").insert().values(user_id=user_id, role_id=role_id))


def replace_role_permissions(db: Session, role_id: str, permission_codes: list[str]) -> None:
    db.execute(delete(table("iam_role_permissions")).where(table("iam_role_permissions").c.role_id == role_id))
    permission_ids = db.execute(select(table("iam_permissions").c.id).where(table("iam_permissions").c.code.in_(permission_codes))).all() if permission_codes else []
    for permission_id, in permission_ids:
        db.execute(table("iam_role_permissions").insert().values(role_id=role_id, permission_id=permission_id))


def get_user_detail(db: Session, item_id: str, include_deleted: bool = False) -> dict:
    users = table("iam_users")
    conditions = [users.c.id == item_id]
    if not include_deleted:
        conditions.append(users.c.deleted_at.is_(None))
    row = db.execute(select(users.c.id, users.c.employee_no, users.c.email, users.c.name, users.c.status, users.c.department_id, users.c.cost_center_id, users.c.created_at, users.c.deleted_at).where(and_(*conditions))).first()
    if not row:
        raise BusinessError(404, "NOT_FOUND", "User does not exist")
    item = row_to_dict(row)
    item["roles"] = user_roles(db, item_id)
    return item


def get_role_detail(db: Session, item_id: str, include_deleted: bool = False) -> dict:
    roles = table("iam_roles")
    conditions = [roles.c.id == item_id]
    if not include_deleted:
        conditions.append(roles.c.deleted_at.is_(None))
    row = db.execute(select(roles.c.id, roles.c.code, roles.c.name, roles.c.description, roles.c.status, roles.c.created_at, roles.c.deleted_at).where(and_(*conditions))).first()
    if not row:
        raise BusinessError(404, "NOT_FOUND", "Role does not exist")
    item = row_to_dict(row)
    item["permissions"] = role_permissions(db, item_id)
    return item
