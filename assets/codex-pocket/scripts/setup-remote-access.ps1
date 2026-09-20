$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $PSScriptRoot
$tailscale = Join-Path $env:ProgramFiles "Tailscale\tailscale.exe"

if (-not (Test-Path -LiteralPath $tailscale)) {
  throw "Tailscale is not installed. Install it and sign in on both the PC and phone first."
}

$status = & $tailscale status --json | ConvertFrom-Json
if ($status.BackendState -ne "Running" -or -not $status.Self.Online) {
  throw "Tailscale is not connected. Open Tailscale, sign in, and run this command again."
}

& (Join-Path $PSScriptRoot "stop-pocket.ps1")
& (Join-Path $PSScriptRoot "start-pocket-background.ps1") -PrivateOnly

& $tailscale serve --bg --yes http://127.0.0.1:4310
if ($LASTEXITCODE -ne 0) {
  throw "Tailscale Serve could not be configured. Run this script from an Administrator terminal."
}

$status = & $tailscale status --json | ConvertFrom-Json
$dnsName = [string]$status.Self.DNSName
$dnsName = $dnsName.TrimEnd('.')
if (-not $dnsName) {
  throw "Tailscale did not provide a MagicDNS name. Enable MagicDNS in the Tailscale admin console."
}

$remoteUrl = "https://${dnsName}/"
Set-Content -LiteralPath (Join-Path $projectDir ".data\remote-url.txt") -Value $remoteUrl -Encoding ascii

Write-Host "Remote access is ready." -ForegroundColor Green
Write-Host "Phone URL: $remoteUrl"
Write-Host "Read the access token locally with: Get-Content '.data\access-token'"
Write-Host "This address works only for devices signed in to your Tailscale network."
