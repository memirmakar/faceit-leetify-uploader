@echo off
REM Launcher for the FACEIT -> Leetify uploader (used by Task Scheduler).
setlocal
cd /d "%~dp0"
if not exist "%~dp0logs" mkdir "%~dp0logs"
set "NODE_EXE=node"
where node >nul 2>nul
if errorlevel 1 set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
"%NODE_EXE%" "%~dp0src\index.js" >> "%~dp0logs\scheduled.out" 2>&1
