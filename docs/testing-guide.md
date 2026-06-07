# Testing Guide

This guide gives AI agents stable validation choices. Prefer the narrowest checks that still cover the risk.

## Common Commands

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

## Frontend

Use when changing React pages, forms, routing, API clients, state, or UI behavior:

```powershell
npm.cmd run lint --workspace frontend
npm.cmd run test --workspace frontend
npm.cmd run build --workspace frontend
```

## Backend

Use when changing NestJS modules, services, controllers, DTOs, permissions, audit behavior, or Prisma access:

```powershell
npm.cmd run lint --workspace backend
npm.cmd run test --workspace backend
npm.cmd run build --workspace backend
```

## Prisma

Use when changing schema or migrations:

```powershell
$env:DATABASE_URL='postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
npm.cmd run db:generate
npm.cmd --workspace backend exec prisma migrate status
```

Use `prisma migrate dev` only when intentionally creating or adjusting a development migration.

