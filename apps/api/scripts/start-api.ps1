# Starts the VOP API as a detached background process that survives terminal/session limits.
# Loads apps/api/.env, frees port 3000, then launches `node dist/main.js` hidden.
# Usage (from anywhere):  powershell -ExecutionPolicy Bypass -File C:\dev\vop\apps\api\scripts\start-api.ps1
$ErrorActionPreference = 'Stop'
$apiDir = Split-Path -Parent $PSScriptRoot        # ...\apps\api
$envFile = Join-Path $apiDir '.env'

Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([^#=][^=]*)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2], 'Process')
  }
}

Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

$log = Join-Path $apiDir 'api-detached.log'
$p = Start-Process -FilePath 'node' -ArgumentList 'dist\main.js' `
  -WorkingDirectory $apiDir -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $log -RedirectStandardError "$log.err"
Write-Output "VOP API started detached (PID=$($p.Id)). Logs: $log"
