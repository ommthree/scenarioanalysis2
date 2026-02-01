@echo off
title Stopping Daedalus

echo Stopping Daedalus server...

REM Find and kill node processes running our server
for /f "tokens=2" %%i in ('tasklist ^| findstr "node.exe"') do (
    taskkill /PID %%i /F 2>nul
)

echo Server stopped.
timeout /t 2 >nul
