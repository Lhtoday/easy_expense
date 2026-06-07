Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

npm.cmd run lint --workspace frontend
npm.cmd run test --workspace frontend
npm.cmd run build --workspace frontend

