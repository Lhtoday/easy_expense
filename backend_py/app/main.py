from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.errors import http_exception_handler, validation_exception_handler
from app.routers import auth, crud, expense_policy_rules, identity, read_models, unsupported


app = FastAPI(title="ExpenseFlow API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin] if settings.frontend_origin else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

api = FastAPI(title="ExpenseFlow API", version="0.2.0")
api.add_exception_handler(StarletteHTTPException, http_exception_handler)
api.add_exception_handler(RequestValidationError, validation_exception_handler)


@api.get("/health")
def health():
    return {"success": True, "data": {"status": "ok", "service": "expenseflow-fastapi"}}


api.include_router(auth.router)
api.include_router(identity.router)
api.include_router(crud.router)
api.include_router(expense_policy_rules.router)
api.include_router(read_models.router)
api.include_router(unsupported.router)

app.mount("/api", api)
