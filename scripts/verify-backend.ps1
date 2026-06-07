Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

npm.cmd run lint --workspace backend
npm.cmd run test --workspace backend
npm.cmd run build --workspace backend

