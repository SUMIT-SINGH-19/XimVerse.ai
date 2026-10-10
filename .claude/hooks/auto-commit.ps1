# Checkpoint the working tree to GitHub so any step can be rolled back.
#   Stop hook        -> after every Claude turn, saves whatever changed.
#   PostToolUse hook -> during long turns, with -MinIntervalMinutes 10, saves
#                       at most once per 10 minutes.
param([int]$MinIntervalMinutes = 0)

Set-Location (Join-Path $PSScriptRoot '..\..')

function Save-Checkpoint {
  if ($MinIntervalMinutes -gt 0) {
    $lastCommit = [int64](git log -1 --format=%ct)
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    if ($now - $lastCommit -lt $MinIntervalMinutes * 60) { return }
  }
  if (-not (git status --porcelain)) { return }

  git -c core.safecrlf=false add -A
  $files = (git diff --cached --name-only | Measure-Object).Count
  if ($files -eq 0) { return }
  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  git commit -q -m "Auto-checkpoint: $files file(s) changed ($stamp)" | Out-Null
  if ($LASTEXITCODE -ne 0) { return }

  $branch = git rev-parse --abbrev-ref HEAD
  git push -q origin $branch 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Output '{"systemMessage": "Auto-checkpoint committed locally, but git push failed."}'
    return
  }
  Write-Output "{`"systemMessage`": `"Auto-checkpoint pushed to origin/$branch ($files file(s)).`"}"
}

# Several Claude sessions can share this repo; only one checkpoint runs at a time.
$mutex = New-Object System.Threading.Mutex($false, 'XimverseAutoCheckpoint')
$owned = $false
try { $owned = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $owned = $true }
if ($owned) {
  try { Save-Checkpoint } finally { $mutex.ReleaseMutex() }
}
$mutex.Dispose()
exit 0
