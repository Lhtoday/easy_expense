from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
from base64 import urlsafe_b64decode, urlsafe_b64encode
from uuid import uuid4
from typing import Optional

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BusinessError
from app.db import get_db, row_to_dict, table


ADMIN_EMAIL = "admin@expenseflow.local"
ADMIN_PASSWORD = "Admin123!"

DEFAULT_PERMISSIONS = [
    ("iam:user:read", "View users"),
    ("iam:user:write", "Maintain users"),
    ("iam:role:read", "View roles"),
    ("iam:role:write", "Maintain roles"),
    ("md:department:read", "View departments"),
    ("md:department:write", "Maintain departments"),
    ("md:cost-center:read", "View cost centers"),
    ("md:cost-center:write", "Maintain cost centers"),
    ("md:project:read", "View projects"),
    ("md:project:write", "Maintain projects"),
    ("exp:report:read", "View expense reports"),
    ("exp:report:write", "Maintain expense reports"),
    ("exp:report:withdraw", "Withdraw expense reports"),
    ("exp:approval:read", "View approval tasks"),
    ("exp:approval:approve", "Process approvals"),
    ("exp:policy:read", "View expense policies"),
    ("exp:policy:write", "Maintain expense policies"),
    ("exp:budget:read", "View budgets"),
    ("exp:budget:write", "Maintain budgets"),
    ("exp:finance-review:read", "View finance reviews"),
    ("exp:finance-review:review", "Process finance reviews"),
    ("exp:payment:read", "View payments"),
    ("exp:payment:pay", "Register payments"),
    ("sys:audit:read", "View audit logs"),
    ("report:dashboard:read", "View reports dashboard"),
    ("gl:account:read", "View GL accounts"),
    ("gl:account:write", "Maintain GL accounts"),
    ("gl:voucher:read", "View voucher drafts"),
    ("gl:voucher:generate", "Generate voucher drafts"),
    ("gl:voucher:confirm", "Confirm voucher drafts"),
]


@dataclass
class CurrentUser:
    id: str
    employeeNo: str
    email: str
    name: str
    departmentId: Optional[str]
    costCenterId: Optional[str]
    roles: list[dict]
    permissions: list[str]

    def as_dict(self) -> dict:
        return self.__dict__


def hash_password(password: str) -> str:
    return sha256(f"expenseflow:{password}".encode()).hexdigest()


def sign_user_id(user_id: str) -> str:
    return sha256(f"phase1:{user_id}".encode()).hexdigest()


def sign_token(user_id: str) -> str:
    return urlsafe_b64encode(f"{user_id}.{sign_user_id(user_id)}".encode()).decode().rstrip("=")


def verify_token_value(token: str) -> str:
    try:
        padded = token + "=" * (-len(token) % 4)
        decoded = urlsafe_b64decode(padded.encode()).decode()
        user_id, signature = decoded.split(".", 1)
    except Exception as exc:
        raise BusinessError(401, "UNAUTHORIZED", "Invalid access token") from exc
    if not user_id or signature != sign_user_id(user_id):
        raise BusinessError(401, "UNAUTHORIZED", "Invalid access token")
    return user_id


def ensure_bootstrap_admin(db: Session) -> None:
    permissions = table("iam_permissions")
    roles = table("iam_roles")
    role_permissions = table("iam_role_permissions")
    users = table("iam_users")
    user_roles = table("iam_user_roles")
    data_scopes = table("iam_data_scopes")

    for code, name in DEFAULT_PERMISSIONS:
        existing = db.execute(select(permissions.c.id).where(permissions.c.code == code)).first()
        if not existing:
            db.execute(permissions.insert().values(id=f"py_{uuid4().hex}", code=code, name=name, updated_at=datetime.utcnow()))

    existing_users = db.execute(select(users.c.id).limit(1)).first()
    if existing_users:
        db.commit()
        return

    role_id = "admin-role"
    user_id = "admin-user"
    db.execute(roles.insert().values(id=role_id, code="ADMIN", name="System Administrator", description="Bootstrap administrator", updated_at=datetime.utcnow()))
    permission_rows = db.execute(select(permissions.c.id)).all()
    for permission_id, in permission_rows:
        db.execute(role_permissions.insert().values(role_id=role_id, permission_id=permission_id))
    db.execute(data_scopes.insert().values(id="admin-master-data-scope", role_id=role_id, resource="master-data", scope_type="ALL", updated_at=datetime.utcnow()))
    db.execute(
        users.insert().values(
            id=user_id,
            employee_no="ADMIN001",
            email=ADMIN_EMAIL,
            name="System Administrator",
            password_hash=hash_password(ADMIN_PASSWORD),
            status="ACTIVE",
            updated_at=datetime.utcnow(),
        )
    )
    db.execute(user_roles.insert().values(user_id=user_id, role_id=role_id))
    db.commit()


def load_current_user(db: Session, user_id: str) -> CurrentUser:
    users = table("iam_users")
    row = db.execute(
        select(users).where(users.c.id == user_id, users.c.deleted_at.is_(None), users.c.status == "ACTIVE")
    ).first()
    if not row:
        raise BusinessError(401, "UNAUTHORIZED", "User is unavailable")
    user = row_to_dict(row._mapping)
    role_rows = db.execute(
        select(table("iam_roles").c.code, table("iam_roles").c.name)
        .select_from(table("iam_user_roles").join(table("iam_roles"), table("iam_user_roles").c.role_id == table("iam_roles").c.id))
        .where(table("iam_user_roles").c.user_id == user_id, table("iam_roles").c.deleted_at.is_(None))
    ).all()
    permission_rows = db.execute(
        select(table("iam_permissions").c.code)
        .select_from(
            table("iam_user_roles")
            .join(table("iam_role_permissions"), table("iam_user_roles").c.role_id == table("iam_role_permissions").c.role_id)
            .join(table("iam_permissions"), table("iam_role_permissions").c.permission_id == table("iam_permissions").c.id)
        )
        .where(table("iam_user_roles").c.user_id == user_id)
    ).all()
    return CurrentUser(
        id=user["id"],
        employeeNo=user["employeeNo"],
        email=user["email"],
        name=user["name"],
        departmentId=user.get("departmentId"),
        costCenterId=user.get("costCenterId"),
        roles=[{"code": code, "name": name} for code, name in role_rows],
        permissions=sorted({code for code, in permission_rows}),
    )


def require_current_user(authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise BusinessError(401, "UNAUTHORIZED", "Missing access token")
    return load_current_user(db, verify_token_value(authorization[len("Bearer ") :]))


def require_permission(user: CurrentUser, permission: str) -> None:
    if permission not in user.permissions:
        raise BusinessError(403, "FORBIDDEN", "Missing required permission")
