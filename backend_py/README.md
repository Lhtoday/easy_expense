# ExpenseFlow FastAPI Backend

This directory is the Python backend for ExpenseFlow.
The migration keeps the existing PostgreSQL schema and the React API contract:

- API prefix: `/api`
- Success response: `{ "success": true, "data": ... }`
- Error response: `{ "success": false, "error": { "code": "...", "message": "..." } }`
- Default port: `3000`

The `backend/` directory now only retains Prisma schema and migration tooling.

## Local Setup

```powershell
cd E:\codex\code\expense
python -m pip install -r backend_py\requirements.txt
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
python -m uvicorn app.main:app --app-dir backend_py --host 0.0.0.0 --port 3000 --reload
```

Health check:

```text
http://localhost:3000/api/health
```
