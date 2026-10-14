@echo off
chcp 65001 >nul
cd /d "%~dp0"
"AwardCeremony-V1.24.exe" decrypt
pause
