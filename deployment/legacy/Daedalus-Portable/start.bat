@echo off
title Daedalus - Financial Modeling Platform

echo ================================================
echo Starting Daedalus...
echo ================================================
echo.

REM Check if dependencies are installed
if not exist "dashboard\server\node_modules" (
    echo ERROR: Dependencies not installed!
    echo.
    echo Please run install.bat first to install dependencies.
    echo.
    pause
    exit /b 1
)

REM Start the backend server
echo Starting backend server...
echo.
echo Daedalus is running!
echo.
echo Open your browser to: http://localhost:3001
echo.
echo Press Ctrl+C to stop the server
echo.

cd dashboard\server
..\..\node\node.exe index.js

pause
