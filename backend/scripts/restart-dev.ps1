# Restart backend on port 4180 (Windows)
$ErrorActionPreference = "Stop"
$port = 4180
$lines = netstat -ano | Select-String ":$port\s"
foreach ($line in $lines) {
  if ($line -match "\s(\d+)\s*$") {
    $pid = [int]$Matches[1]
    if ($pid -gt 0) {
      Write-Host "Stopping PID $pid on port $port"
      taskkill /PID $pid /F | Out-Null
    }
  }
}
Set-Location $PSScriptRoot
if (-not (Test-Path ".env")) {
  Write-Host "Warning: backend/.env missing. Copy .env.example to .env first."
}
node src/server.js
