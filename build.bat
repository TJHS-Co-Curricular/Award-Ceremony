@echo off
chcp 65001 >nul
title 编译便携版 AwardCeremony.exe
cd /d "%~dp0"
echo ============================================
echo   表扬大会 · 编译便携版 AwardCeremony.exe
echo ============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js。编译需要 Node.js 22 LTS 或更新版本：https://nodejs.org
  echo （编译好的 exe 在其他电脑上运行时不需要 Node.js）
  pause
  exit /b 1
)
node build\build-exe.js
if errorlevel 1 (
  echo.
  echo 编译失败，请查看上面的错误信息。
  pause
  exit /b 1
)
rem 刷新 Windows 图标缓存，否则同一路径的 exe 可能继续显示旧图标
ie4uinit.exe -show >nul 2>nul
echo.
echo 已放在项目主目录：%~dp0AwardCeremony.exe
echo 双击 AwardCeremony.exe 即可启动（与 start.bat 共用 config.json 和 data 文件夹）。
pause
