param(
    [Parameter(Mandatory = $false)]
    [string]$Path = '.'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $Path).Path
$excluded = @('.git', '.data', 'node_modules')
$patterns = @(
    @{ Name = 'Windows user path'; Regex = '(?i)[A-Z]:\\Users\\[^\\\s]+' },
    @{ Name = 'Tailscale private hostname'; Regex = '(?i)\b[a-z0-9-]+\.tail[a-z0-9-]+\.ts\.net\b' },
    @{ Name = 'Codex task id'; Regex = '(?i)\b01[a-z0-9]{6,}-[a-z0-9-]{12,}\b' },
    @{ Name = 'Token-bearing URL'; Regex = '(?i)[?&](token|access_token|key|secret)=[A-Za-z0-9_-]{16,}' },
    @{ Name = 'Private key'; Regex = '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----' }
)

$hits = @()
Get-ChildItem -LiteralPath $root -Recurse -File -Force | Where-Object {
    $relative = $_.FullName.Substring($root.Length).TrimStart('\')
    -not ($excluded | Where-Object { $relative -eq $_ -or $relative.StartsWith("$_\") })
} | ForEach-Object {
    $file = $_
    try {
        $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction Stop
    } catch {
        return
    }
    foreach ($pattern in $patterns) {
        if ($content -match $pattern.Regex) {
            $hits += [PSCustomObject]@{ File = $file.FullName; Finding = $pattern.Name }
        }
    }
}

if ($hits.Count -gt 0) {
    $hits | Sort-Object File, Finding | Format-Table -AutoSize
    throw "Privacy scan failed with $($hits.Count) finding(s). Review and remove private data before sharing."
}

Write-Host "Privacy scan passed: $root"
