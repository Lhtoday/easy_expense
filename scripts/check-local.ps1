Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

docker-compose ps

$processes = Get-CimInstance Win32_Process |
  Where-Object { ($_.Name -match 'node|npm|cmd|powershell') -and ($_.CommandLine -like '*E:\codex\code\expense*') } |
  Select-Object ProcessId,Name,CommandLine

$processes

