$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $PSScriptRoot
$pidPath = Join-Path $projectDir ".data\server.pid"

if (-not (Test-Path -LiteralPath $pidPath)) {
  Write-Host "No Codex Pocket background process record was found." -ForegroundColor Yellow
  exit 0
}

$processId = [int](Get-Content -LiteralPath $pidPath -Raw).Trim()
$processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
if (-not $processInfo) {
  Write-Host "Codex Pocket is already stopped." -ForegroundColor Yellow
  exit 0
}

if ($processInfo.CommandLine -notmatch "src[/\\]server\.mjs") {
  throw "PID $processId is not Codex Pocket. Refusing to stop it."
}

Stop-Process -Id $processId
Write-Host "Codex Pocket stopped." -ForegroundColor Green
