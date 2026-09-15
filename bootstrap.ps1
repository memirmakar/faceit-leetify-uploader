# Bootstrapper for the "just click an .exe" experience.
# Compiled to FaceitLeetifyUploader-Setup.exe (see build-exe.ps1) and attached
# to GitHub Releases. Double-clicking it downloads the latest version and runs
# the interactive installer. No git or manual download needed.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Where is this script/exe running from? (works both as .ps1 and ps2exe .exe)
$exeDir =
  if ($PSScriptRoot) { $PSScriptRoot }
  else {
    try { Split-Path ([System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName) }
    catch { (Get-Location).Path }
  }

Write-Host "FACEIT -> Leetify uploader :: setup" -ForegroundColor Green

if (Test-Path (Join-Path $exeDir 'src\index.js')) {
  # Already sitting inside the project folder — install in place.
  $target = $exeDir
  Write-Host "Using project files in: $target"
}
else {
  # Standalone exe: fetch the latest code into LocalAppData.
  $target = Join-Path $env:LOCALAPPDATA 'FaceitLeetifyUploader'
  Write-Host "Downloading the latest version..."
  $zip = Join-Path $env:TEMP 'flu.zip'
  Invoke-WebRequest `
    'https://codeload.github.com/memirmakar/faceit-leetify-uploader/zip/refs/heads/main' `
    -OutFile $zip
  $extract = Join-Path $env:TEMP 'flu_extract'
  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
  Expand-Archive $zip $extract -Force
  $srcDir = Join-Path $extract 'faceit-leetify-uploader-main'
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  # Copies source over any existing install; your .env / login / state are not
  # in the download, so they're preserved.
  Copy-Item (Join-Path $srcDir '*') $target -Recurse -Force
  Remove-Item $zip -Force -ErrorAction SilentlyContinue
  Remove-Item $extract -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "Installed files to: $target"
}

# Hand off to the full interactive installer.
& (Join-Path $target 'install.ps1')
