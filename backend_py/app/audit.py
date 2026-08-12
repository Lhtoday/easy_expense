from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.db import json_value, table
from app.security import CurrentUser


def record_audit(
    db: Session,
    *,
    action: str,
    entity_type: str,
    operator: Optional[CurrentUser] = None,
    operator_id: Optional[str] = None,
    actor_email: Optional[str] = None,
    entity_id: Optional[str] = None,
    before: Optional[object] = None,
    after: Optional[object] = None,
    metadata: Optional[object] = None,
    comment: Optional[str] = None,
    success: bool = True,
) -> None:
    db.execute(
        table("sys_audit_logs").insert().values(
            id=f"py_{uuid4().hex}",
            operator_id=operator.id if operator else operator_id,
            actor_email=operator.email if operator else actor_email,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            before_data=json_value(before),
            after_data=json_value(after),
            metadata=json_value(metadata),
            comment=comment,
            success=success,
            created_at=datetime.utcnow(),
        )
    )
