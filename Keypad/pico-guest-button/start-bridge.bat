@echo off
chcp 65001 >nul
rem Pico guest button: bridge between the Pico (USB) and the award server
where node >nul 2>nul
if errorlevel 1 goto :nonode
node "%~dp0bridge.js"
pause
exit /b 0
:nonode
echo [ERROR] Node.js not found. Install Node.js 18+ from https://nodejs.org then try again.
pause
exit /b 1
