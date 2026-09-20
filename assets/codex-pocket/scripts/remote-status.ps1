$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $PSScriptRoot
$tailscale = Join-Path $env:ProgramFiles "Tailscale\tailscale.exe"

if (-not (Test-Path -LiteralPath $tailscale)) {
  throw "Tailscale is not installed."
}

& $tailscale status
Write-Host ""
& $tailscale serve status

$urlPath = Join-Path $projectDir ".data\remote-url.txt"
if (Test-Path -LiteralPath $urlPath) {
  Write-Host ""
  Write-Host "Codex Pocket URL: $((Get-Content -LiteralPath $urlPath -Raw).Trim())"
}
