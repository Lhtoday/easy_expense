from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.core.errors import BusinessError
from app.db import get_db, row_to_dict, table
from app.security import CurrentUser, require_current_user, require_permission


router = APIRouter(prefix="/expense-policies/{policy_id}/rules", tags=["expense-policy-rules"])


class GenericPayload(BaseModel):
    class Config:
        extra = "allow"


def snake(name: str) -> str:
    out = []
    for char in name:
        if char.isupper():
            out.extend(["_", char.lower()])
        else:
            out.append(char)
    return "".join(out)


RULE_COLUMNS = [
    "id",
    "policy_id",
    "code",
    "name",
    "description",
    "expense_type_code",
    "city",
    "job_level",
    "max_amount_cents",
    "requires_invoice",
    "requires_pre_approval",
    "action",
    "status",
    "created_at",
]


def columns(model):
    return [model.c[name] for name in RULE_COLUMNS]


@router.post("")
def create_rule(policy_id: str, body: GenericPayload, user: CurrentUser = Depends(require_current_user), db: Session = Depends(get_db)):
    require_permission(user, "exp:policy:write")
    model = table("exp_policy_rules")
    data = {snake(key): (None if value == "" else value) for key, value in body.dict(exclude_unset=True).items()}
    allowed = set(RULE_COLUMNS) - {"id", "policy_id", "created_at", "status"}
    values = {key: value for key, value in data.items() if key in allowed}
    values.update(id=f"py_{uuid4().hex}", policy_id=policy_id, status=data.get("status", "ACTIVE"), updated_at=datetime.utcnow())
    row = db.execute(model.insert().values(**values).returning(*columns(model))).first()
    item = row_to_dict(row)
    record_audit(db, operator=user, action="POLICY_RULE_CREATE", entity_type="expense-policy-rule", entity_id=item["id"], after=item)
    db.commit()
    return {"success": True, "data": item}


@router.patch("/{rule_id}")
def update_rule(policy_id: str, rule_id: str, body: GenericPayload, user: CurrentUser = Depends(require_current_user), db: Session = Depends(get_db)):
    require_permission(user, "exp:policy:write")
    model = table("exp_policy_rules")
    before_row = db.execute(select(*columns(model)).where(model.c.id == rule_id, model.c.policy_id == policy_id)).first()
    if not before_row:
        raise BusinessError(404, "NOT_FOUND", "Policy rule does not exist")
    before = row_to_dict(before_row)
    data = {snake(key): (None if value == "" else value) for key, value in body.dict(exclude_unset=True).items()}
    allowed = set(RULE_COLUMNS) - {"id", "policy_id", "created_at"}
    values = {key: value for key, value in data.items() if key in allowed}
    values["updated_at"] = datetime.utcnow()
    row = db.execute(model.update().where(model.c.id == rule_id, model.c.policy_id == policy_id).values(**values).returning(*columns(model))).first()
    item = row_to_dict(row)
    record_audit(db, operator=user, action="POLICY_RULE_UPDATE", entity_type="expense-policy-rule", entity_id=rule_id, before=before, after=item)
    db.commit()
    return {"success": True, "data": item}


@router.delete("/{rule_id}")
def disable_rule(policy_id: str, rule_id: str, user: CurrentUser = Depends(require_current_user), db: Session = Depends(get_db)):
    require_permission(user, "exp:policy:write")
    model = table("exp_policy_rules")
    before_row = db.execute(select(*columns(model)).where(model.c.id == rule_id, model.c.policy_id == policy_id)).first()
    if not before_row:
        raise BusinessError(404, "NOT_FOUND", "Policy rule does not exist")
    before = row_to_dict(before_row)
    row = db.execute(model.update().where(model.c.id == rule_id, model.c.policy_id == policy_id).values(status="DISABLED", updated_at=datetime.utcnow()).returning(*columns(model))).first()
    item = row_to_dict(row)
    record_audit(db, operator=user, action="POLICY_RULE_DISABLE", entity_type="expense-policy-rule", entity_id=rule_id, before=before, after=item)
    db.commit()
    return {"success": True, "data": item}
