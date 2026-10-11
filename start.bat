@echo off
chcp 65001 >nul
title 表扬大会 · 颁奖公布系统
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js，请先安装 Node.js 18 或更新版本：https://nodejs.org
  pause
  exit /b 1
)
node server.js
pause
