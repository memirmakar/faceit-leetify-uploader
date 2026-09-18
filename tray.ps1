# Resident system-tray app for the FACEIT -> Leetify uploader.
# Puts an icon in the tray; right-click or double-click -> Upload now.
# Launched hidden by start-tray.vbs (also at login).
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# --- single instance ---
[bool]$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, 'FaceitLeetifyUploaderTray', [ref]$createdNew)
if (-not $createdNew) { return }

# --- paths ---
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = Join-Path $env:ProgramFiles 'nodejs\node.exe' }
$index = Join-Path $root 'src\index.js'
$logFile = Join-Path $root 'logs\uploader.log'
$trigger = Join-Path $root 'state\run.trigger'
New-Item -ItemType Directory -Force -Path (Join-Path $root 'state') | Out-Null
$demoDir = $null
$envFile = Join-Path $root '.env'
if (Test-Path $envFile) {
  foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*DEMO_DIR\s*=\s*(.+?)\s*$') { $demoDir = $matches[1] }
  }
}

# --- tray icon + menu ---
$icon = New-Object System.Windows.Forms.NotifyIcon
$icon.Icon = [System.Drawing.SystemIcons]::Application
$icon.Text = 'FACEIT -> Leetify (idle)'
$icon.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$miRun = New-Object System.Windows.Forms.ToolStripMenuItem('Upload now')
$miDemos = New-Object System.Windows.Forms.ToolStripMenuItem('Open demos folder')
$miLog = New-Object System.Windows.Forms.ToolStripMenuItem('Open log')
$miExit = New-Object System.Windows.Forms.ToolStripMenuItem('Exit')
$menu.Items.AddRange(@($miRun, $miDemos, $miLog, (New-Object System.Windows.Forms.ToolStripSeparator), $miExit))
$icon.ContextMenuStrip = $menu

$script:proc = $null

function Start-Upload {
  if ($script:proc -and -not $script:proc.HasExited) { return }
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $node
  $psi.Arguments = '"' + $index + '"'
  $psi.WorkingDirectory = $root
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $script:proc = [System.Diagnostics.Process]::Start($psi)
  $icon.Text = 'FACEIT -> Leetify (uploading...)'
  $miRun.Enabled = $false
  $icon.ShowBalloonTip(3000, 'FACEIT -> Leetify', 'Checking for new matches...', [System.Windows.Forms.ToolTipIcon]::Info)
}

# poll for completion so we can report the result
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1500
$timer.Add_Tick({
  # external "Upload now" trigger (from the desktop shortcut)
  if (Test-Path $trigger) {
    Remove-Item $trigger -Force -ErrorAction SilentlyContinue
    Start-Upload
  }
  if ($script:proc -and $script:proc.HasExited) {
    $script:proc = $null
    $miRun.Enabled = $true
    $icon.Text = 'FACEIT -> Leetify (idle)'
    $summary = 'Upload run finished.'
    try {
      $last = Get-Content $logFile -Tail 40 | Where-Object { $_ -match 'Run complete|Nothing new' } | Select-Object -Last 1
      if ($last) { $summary = ($last -replace '^\[[^\]]*\]\s*', '') }
    } catch {}
    $icon.ShowBalloonTip(5000, 'FACEIT -> Leetify', $summary, [System.Windows.Forms.ToolTipIcon]::Info)
  }
})
$timer.Start()

# --- handlers ---
$miRun.Add_Click({ Start-Upload })
$icon.Add_DoubleClick({ Start-Upload })
$miDemos.Add_Click({ if ($demoDir -and (Test-Path $demoDir)) { Start-Process explorer.exe $demoDir } else { Start-Process explorer.exe $root } })
$miLog.Add_Click({ if (Test-Path $logFile) { Start-Process notepad.exe $logFile } })
$miExit.Add_Click({
  $timer.Stop()
  $icon.Visible = $false
  $icon.Dispose()
  [System.Windows.Forms.Application]::Exit()
})

[System.Windows.Forms.Application]::Run()
$icon.Dispose()
