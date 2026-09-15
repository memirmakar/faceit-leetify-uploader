# Builds FaceitLeetifyUploader-Setup.exe from bootstrap.ps1 using ps2exe.
#   powershell -NoProfile -ExecutionPolicy Bypass -File build-exe.ps1
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (-not (Get-Module -ListAvailable -Name ps2exe)) {
  Write-Host "Installing ps2exe (one-time)..."
  Install-PackageProvider -Name NuGet -Force -Scope CurrentUser | Out-Null
  Install-Module ps2exe -Scope CurrentUser -Force -AllowClobber
}
Import-Module ps2exe

$out = Join-Path $root 'FaceitLeetifyUploader-Setup.exe'
Invoke-ps2exe -InputFile (Join-Path $root 'bootstrap.ps1') -OutputFile $out `
  -title 'FACEIT to Leetify Uploader Setup' `
  -product 'FACEIT to Leetify Uploader' `
  -description 'Sets up automatic daily upload of your FACEIT CS2 demos to Leetify.' `
  -company 'memirmakar' -version '1.0.0'

Write-Host "Built: $out"
