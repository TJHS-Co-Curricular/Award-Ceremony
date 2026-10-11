@echo off
chcp 65001 >nul
cd /d "%~dp0"
"AwardCeremony.exe" encrypt
pause
