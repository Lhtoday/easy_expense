from __future__ import annotations

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from typing import Optional


class BusinessError(HTTPException):
    def __init__(self, status_code: int, code: str, message: str, details: Optional[object] = None):
        super().__init__(status_code=status_code, detail={"code": code, "message": message, "details": details})


async def http_exception_handler(_request: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "HTTP_ERROR", "message": str(exc.detail)}
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": {"code": detail.get("code", "HTTP_ERROR"), "message": detail.get("message", "Request failed"), "details": detail.get("details")}},
    )


async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"success": False, "error": {"code": "VALIDATION_ERROR", "message": "Request validation failed", "details": exc.errors()}},
    )
