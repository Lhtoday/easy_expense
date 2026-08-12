from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Optional


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public",
    )
    frontend_origin: Optional[str] = os.getenv("FRONTEND_ORIGIN")
    api_port: int = int(os.getenv("API_PORT", "3000"))


settings = Settings()
