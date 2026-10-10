# Stop hook: snapshot the working tree to GitHub after every Claude turn,
# so each step can be rolled back with git.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\..')

$changes = git status --porcelain
if (-not $changes) { exit 0 }

git add -A
$files = (git diff --cached --name-only | Measure-Object).Count
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
git commit -q -m "Auto-checkpoint: $files file(s) changed ($stamp)" | Out-Null

$branch = git rev-parse --abbrev-ref HEAD
git push -q origin $branch 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Output '{"systemMessage": "Auto-checkpoint committed locally, but git push failed."}'
  exit 0
}
Write-Output "{`"systemMessage`": `"Auto-checkpoint pushed to origin/$branch ($files file(s)).`"}"
