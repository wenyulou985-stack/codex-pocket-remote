$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $PSScriptRoot
$startupDir = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDir "Codex Pocket.lnk"
$powershellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$startScript = Join-Path $PSScriptRoot "start-pocket-background.ps1"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershellPath
$shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startScript`" -PrivateOnly"
$shortcut.WorkingDirectory = $projectDir
$shortcut.WindowStyle = 7
$shortcut.Description = "Start Codex Pocket through the private Tailscale endpoint"
$shortcut.Save()

Write-Host "Codex Pocket will start privately when you sign in to Windows." -ForegroundColor Green
Write-Host "Shortcut: $shortcutPath"
