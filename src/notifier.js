import { execFileSync } from 'node:child_process';

/** Best-effort Windows balloon notification (used when a run needs attention). */
export function notify(title, message) {
  const t = String(title).replace(/["`$]/g, "'");
  const m = String(message).replace(/["`$]/g, "'");
  const ps = `
Add-Type -AssemblyName System.Windows.Forms
$n = New-Object System.Windows.Forms.NotifyIcon
$n.Icon = [System.Drawing.SystemIcons]::Warning
$n.BalloonTipTitle = "${t}"
$n.BalloonTipText = "${m}"
$n.Visible = $true
$n.ShowBalloonTip(10000)
Start-Sleep -Seconds 6
$n.Dispose()
`;
  try {
    execFileSync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { stdio: 'ignore', timeout: 15000 },
    );
  } catch {
    /* notifications are best-effort */
  }
}
