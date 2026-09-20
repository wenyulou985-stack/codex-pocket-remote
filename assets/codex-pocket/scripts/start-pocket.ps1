$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectDir

Write-Host "Starting Codex Pocket..." -ForegroundColor Green
node src/server.mjs --lan
