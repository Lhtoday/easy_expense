Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

npm.cmd run lint
npm.cmd run test
npm.cmd run build

