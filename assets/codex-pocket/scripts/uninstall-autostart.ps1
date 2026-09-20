$ErrorActionPreference = "Stop"
$shortcutPath = Join-Path ([Environment]::GetFolderPath("Startup")) "Codex Pocket.lnk"

if (Test-Path -LiteralPath $shortcutPath) {
  Remove-Item -LiteralPath $shortcutPath -Force
  Write-Host "Codex Pocket autostart was removed." -ForegroundColor Green
} else {
  Write-Host "Codex Pocket autostart was not installed." -ForegroundColor Yellow
}
