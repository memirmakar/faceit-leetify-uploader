# Installs the tray app:
#  - Startup shortcut  -> start-tray.vbs   (resident tray icon, at login)
#  - Desktop shortcut  -> upload-now.vbs   ("Upload now", shows in the tray)
# then launches the tray now.
#   powershell -NoProfile -ExecutionPolicy Bypass -File setup-tray.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ws = New-Object -ComObject WScript.Shell

function New-VbsShortcut($lnkPath, $vbsName, $desc) {
  $sc = $ws.CreateShortcut($lnkPath)
  $sc.TargetPath = 'wscript.exe'
  $sc.Arguments = '"' + (Join-Path $root $vbsName) + '"'
  $sc.WorkingDirectory = $root
  $sc.Description = $desc
  $sc.Save()
}

$startup = [Environment]::GetFolderPath('Startup')
$desktop = [Environment]::GetFolderPath('Desktop')

# Clean up an older desktop shortcut name if present.
Remove-Item (Join-Path $desktop 'FACEIT Leetify Uploader.lnk') -Force -ErrorAction SilentlyContinue

New-VbsShortcut (Join-Path $startup 'FACEIT Leetify Uploader.lnk') 'start-tray.vbs' 'FACEIT -> Leetify uploader (tray)'
New-VbsShortcut (Join-Path $desktop 'Upload FACEIT demos now.lnk') 'upload-now.vbs' 'Upload your FACEIT demos to Leetify now'
Write-Host "Startup shortcut : $startup\FACEIT Leetify Uploader.lnk"
Write-Host "Desktop shortcut : $desktop\Upload FACEIT demos now.lnk"

# Launch the tray now (single-instance guarded).
Start-Process wscript.exe -ArgumentList ('"' + (Join-Path $root 'start-tray.vbs') + '"')
Write-Host "Tray app started. Find it under 'show hidden icons' in the taskbar."
