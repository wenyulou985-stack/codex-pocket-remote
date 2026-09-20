$ErrorActionPreference = "Stop"
$tailscale = Join-Path $env:ProgramFiles "Tailscale\tailscale.exe"

if (-not (Test-Path -LiteralPath $tailscale)) {
  throw "Tailscale is not installed."
}

& $tailscale serve off
if ($LASTEXITCODE -ne 0) {
  throw "Tailscale Serve could not be disabled."
}

Write-Host "Codex Pocket remote access is disabled." -ForegroundColor Green
