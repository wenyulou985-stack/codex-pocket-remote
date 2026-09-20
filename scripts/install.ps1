param(
    [Parameter(Mandatory = $false)]
    [string]$Destination = (Join-Path $HOME 'CodexPocket'),
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$skillRoot = Split-Path -Parent $PSScriptRoot
$template = Join-Path $skillRoot 'assets\codex-pocket'
$resolvedDestination = [System.IO.Path]::GetFullPath($Destination)

if (-not (Test-Path -LiteralPath $template)) {
    throw "Template not found: $template"
}

if (Test-Path -LiteralPath $resolvedDestination) {
    if (-not $Force) {
        throw "Destination already exists. Stop the app, back up local changes, then rerun with -Force: $resolvedDestination"
    }
    Remove-Item -LiteralPath $resolvedDestination -Recurse -Force
}

New-Item -ItemType Directory -Path $resolvedDestination -Force | Out-Null
Copy-Item -Path (Join-Path $template '*') -Destination $resolvedDestination -Recurse -Force

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    throw 'Node.js 20 or newer is required.'
}

$major = [int]((node --version).TrimStart('v').Split('.')[0])
if ($major -lt 20) {
    throw "Node.js 20 or newer is required. Found: $(node --version)"
}

Write-Host "Installed Codex Pocket to: $resolvedDestination"
Write-Host "Next: cd '$resolvedDestination'; npm run check; npm test; npm run start:bg"
