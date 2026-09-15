# FACEIT -> Leetify uploader :: installer
# Run via install.cmd (double-click) or:
#   powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Write-Step($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }

Write-Host "FACEIT -> Leetify uploader installer" -ForegroundColor Green
Write-Host "This sets up an automatic daily upload of your FACEIT CS2 demos to Leetify.`n"

# --- 1. Node.js -------------------------------------------------------------
Write-Step "Checking Node.js"
function Get-NodeDir {
  $c = Get-Command node -ErrorAction SilentlyContinue
  if ($c) { return (Split-Path $c.Source) }
  return $null
}
$nodeDir = Get-NodeDir
if (-not $nodeDir) {
  Write-Host "Node.js not found. Installing via winget (may prompt for admin)..."
  winget install --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
  $nodeDir = Get-NodeDir
  if (-not $nodeDir) {
    throw "Node was installed but isn't on PATH yet. Close this window, open a new one, and run install.cmd again."
  }
}
$node = Join-Path $nodeDir 'node.exe'
$npm  = Join-Path $nodeDir 'npm.cmd'
$npx  = Join-Path $nodeDir 'npx.cmd'
Write-Host "Node.js: $node"

# --- 2. Dependencies --------------------------------------------------------
Write-Step "Installing dependencies"
& $npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed." }

# --- 3. Browser -------------------------------------------------------------
Write-Step "Ensuring a browser is available"
# Prefer Microsoft Edge (built into Windows). If that fails, fall back to
# Playwright's bundled Chromium and switch the config to use it.
$browserOk = $false
try {
  & $npx playwright install msedge
  if ($LASTEXITCODE -eq 0) { $browserOk = $true }
} catch { }
if (-not $browserOk) {
  Write-Host "Edge channel unavailable; installing bundled Chromium instead..."
  & $npx playwright install chromium
  $script:useChromium = $true
}

# --- 4. Setup mode + credentials (.env) -------------------------------------
Write-Step "Setup mode"
$envPath = Join-Path $root '.env'
$writeEnv = $true
if (Test-Path $envPath) {
  $ans = Read-Host ".env already exists. Reconfigure it? (y/N)"
  if ($ans -notmatch '^[yY]') { $writeEnv = $false }
}
if ($writeEnv) {
  Write-Host "How should it find your matches?"
  Write-Host "  [1] With a FACEIT API key  - most reliable match detection (free key, ~2 min to get)"
  Write-Host "  [2] No API key             - detects matches through your logged-in browser instead"
  $mode = Read-Host "Choose 1 or 2 [default 1]"

  if ($mode -eq '2') {
    $lines = @("DISCOVERY_MODE=browser")
    Write-Host "No-key mode selected. You'll just log into FACEIT in a moment."
  }
  else {
    Write-Host "(See README.md -> 'Getting a FACEIT Data API key' if you don't have a key yet.)"
    do { $nick = (Read-Host "FACEIT nickname (case-sensitive)").Trim() } while (-not $nick)
    do { $key  = (Read-Host "FACEIT Data API key").Trim() } while (-not $key)
    $lines = @("FACEIT_NICKNAME=$nick", "FACEIT_DATA_API_KEY=$key")
  }
  if ($script:useChromium) { $lines += "BROWSER_CHANNEL=chromium" }
  Set-Content -Path $envPath -Value $lines -Encoding ascii
  Write-Host ".env saved."
}

# --- 5. Schedule ------------------------------------------------------------
Write-Step "Daily schedule"
$timeStr = Read-Host "What time should it run each day? (24h HH:mm) [default 19:00]"
if ([string]::IsNullOrWhiteSpace($timeStr)) { $timeStr = "19:00" }
$runCmd    = Join-Path $root 'run.cmd'
$action    = New-ScheduledTaskAction -Execute $runCmd -WorkingDirectory $root
$trigger   = New-ScheduledTaskTrigger -Daily -At ([datetime]$timeStr)
$settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew -DontStopOnIdleEnd
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName "FaceitLeetifyUploader" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Host "Scheduled: every day at $timeStr (only while you're logged in)."

# --- 6. FACEIT login --------------------------------------------------------
Write-Step "Log into FACEIT"
Write-Host "A browser window will open. Log into FACEIT, then press Enter back here."
& $node "src\login.js"

# --- 7. Optional first run --------------------------------------------------
Write-Step "First run"
$run = Read-Host "Upload your recent demos now? (Y/n)"
if ($run -notmatch '^[nN]') { & $node "src\index.js" }

Write-Host "`nAll set. It will run automatically every day at $timeStr." -ForegroundColor Green
Write-Host "See README.md for how to change the time, re-login, or troubleshoot."
