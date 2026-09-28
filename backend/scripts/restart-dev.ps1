# Restart backend on port 4180 (Windows)
$ErrorActionPreference = "Stop"
$port = 4180
$lines = netstat -ano | Select-String ":$port\s"
foreach ($line in $lines) {
  if ($line -match "\s(\d+)\s*$") {
    $processId = [int]$Matches[1]
    if ($processId -gt 0) {
      Write-Host "Stopping PID $processId on port $port"
      taskkill /PID $processId /F | Out-Null
    }
  }
}
Set-Location (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path ".env")) {
  Write-Host "Warning: backend/.env missing. Copy .env.example to .env first."
}
node src/server.js
