param([switch]$PrivateOnly)
$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $projectDir ".data"
$pidPath = Join-Path $dataDir "server.pid"
$stdoutPath = Join-Path $dataDir "pocket.log"
$stderrPath = Join-Path $dataDir "pocket-error.log"

New-Item -ItemType Directory -Path $dataDir -Force | Out-Null

$existing = Get-NetTCPConnection -LocalPort 4310 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existing) {
  Write-Host "Codex Pocket is already running (PID $($existing.OwningProcess))." -ForegroundColor Yellow
  exit 0
}

$nodePath = (Get-Command node -ErrorAction Stop).Source
$serverArgs = if ($PrivateOnly) { @("src/server.mjs") } else { @("src/server.mjs", "--lan") }
$process = Start-Process -FilePath $nodePath `
  -ArgumentList $serverArgs `
  -WorkingDirectory $projectDir `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath `
  -PassThru

Set-Content -LiteralPath $pidPath -Value $process.Id -Encoding ascii
Start-Sleep -Seconds 1

if ($process.HasExited) {
  $detail = if (Test-Path $stderrPath) { Get-Content -LiteralPath $stderrPath -Raw } else { "Unknown error" }
  throw "Codex Pocket failed to start: $detail"
}

Write-Host "Codex Pocket started in the background (PID $($process.Id))." -ForegroundColor Green
if ($PrivateOnly) {
  Write-Host "Local backend: http://127.0.0.1:4310/"
} else {
  $addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.AddressState -eq "Preferred" } |
    Select-Object -ExpandProperty IPAddress -Unique
  foreach ($address in $addresses) {
    Write-Host "Phone URL: http://${address}:4310/"
  }
  Write-Host "Use these URLs only on trusted Wi-Fi or a private VPN."
  Write-Host "Read the access token locally with: Get-Content '.data\access-token'"
}
