@echo off
chcp 65001 >nul
title 编译便携版 AwardCeremony
cd /d "%~dp0"
echo ============================================
echo   表扬大会 · 编译便携版 AwardCeremony
echo ============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js。编译需要 Node.js 22 LTS 或更新版本：https://nodejs.org
  echo （编译好的 exe 在其他电脑上运行时不需要 Node.js）
  pause
  exit /b 1
)
rem Note: after a long command, cmd (chcp 65001) may mis-read non-ASCII lines that follow,
rem so every message after the build is printed by build-exe.js. Keep the lines below ASCII only.
node build\build-exe.js
if errorlevel 1 (
  pause
  exit /b 1
)
ie4uinit.exe -show >nul 2>nul
pause
