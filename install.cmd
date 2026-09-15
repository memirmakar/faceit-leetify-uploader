@echo off
REM Double-click this to install. It just runs install.ps1 with the right policy.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
