from __future__ import annotations

from collections.abc import Generator
from datetime import date, datetime
from decimal import Decimal
import json
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import MetaData, create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


def _normalize_database_url(url: str) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    schema = query.pop("schema", None)
    normalized = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
    if schema:
        connector = "&" if "?" in normalized else "?"
        normalized = f"{normalized}{connector}options=-csearch_path%3D{schema}"
    return normalized


engine: Engine = create_engine(_normalize_database_url(settings.database_url), pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
metadata = MetaData()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def table(name: str):
    reflect_tables()
    return metadata.tables[name]


def reflect_tables() -> None:
    if not metadata.tables:
        metadata.reflect(bind=engine)


def to_camel(name: str) -> str:
    parts = name.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


def encode_value(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral() else float(value)
    return value


def row_to_dict(row, camel_case: bool = True) -> dict:
    mapping = row._mapping if hasattr(row, "_mapping") else row
    return {(to_camel(key) if camel_case else key): encode_value(value) for key, value in mapping.items()}


def json_value(value):
    if value is None:
        return None
    return json.loads(json.dumps(value, default=str))
