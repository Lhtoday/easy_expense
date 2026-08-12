Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host 'Read docs/startup-guide.md before changing startup behavior.'
docker-compose up -d postgres redis minio

$env:DATABASE_URL = 'postgresql://expenseflow:expenseflow@localhost:5432/expenseflow?schema=public'
npm.cmd run db:generate

Write-Host 'Start backend with: npm.cmd run dev:backend'
Write-Host 'Start frontend with: npm.cmd run dev:frontend'
