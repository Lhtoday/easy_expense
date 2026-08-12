from __future__ import annotations

from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.core.errors import BusinessError
from app.db import get_db, table
from app.security import (
    CurrentUser,
    ensure_bootstrap_admin,
    hash_password,
    load_current_user,
    require_current_user,
    sign_token,
)


router = APIRouter(prefix="/auth", tags=["auth"])


class LoginBody(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    ensure_bootstrap_admin(db)
    users = table("iam_users")
    row = db.execute(select(users.c.id, users.c.email, users.c.password_hash, users.c.status).where(users.c.email == body.email, users.c.deleted_at.is_(None))).first()
    if not row or row.password_hash != hash_password(body.password) or row.status != "ACTIVE":
        record_audit(
            db,
            action="LOGIN_FAILURE",
            entity_type="auth-session",
            entity_id=row.id if row else None,
            actor_email=body.email,
            metadata={"reason": "BAD_CREDENTIALS" if row else "USER_NOT_FOUND"},
            success=False,
        )
        db.commit()
        raise BusinessError(401, "UNAUTHORIZED", "Email or password is incorrect")

    user = load_current_user(db, row.id)
    record_audit(db, action="LOGIN_SUCCESS", entity_type="auth-session", entity_id=user.id, operator=user, metadata={"roleCodes": [role["code"] for role in user.roles]})
    db.commit()
    return {"success": True, "data": {"accessToken": sign_token(user.id), "user": user.as_dict()}}


@router.get("/me")
def me(user: CurrentUser = Depends(require_current_user)):
    return {"success": True, "data": user.as_dict()}
