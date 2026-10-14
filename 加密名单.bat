@echo off
chcp 65001 >nul
cd /d "%~dp0"
"AwardCeremony-V1.25.exe" encrypt
pause
