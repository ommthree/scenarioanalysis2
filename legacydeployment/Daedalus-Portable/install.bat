@echo off
echo ================================================
echo Daedalus - Installing Dependencies
echo ================================================
echo.

REM Check if node exists
if not exist "node\node.exe" (
    echo ERROR: Node.js not found!
    echo.
    echo Please extract portable Node.js to the node\ folder first.
    echo Download from: https://nodejs.org/dist/v18.17.0/node-v18.17.0-win-x64.zip
    echo.
    pause
    exit /b 1
)

echo Installing Node.js dependencies...
echo This may take a few minutes...
echo.

cd dashboard\server
..\..\node\node.exe ..\..\node\npm\bin\npm-cli.js install

if %ERRORLEVEL% EQU 0 (
    cd ..\..
    echo.
    echo ================================================
    echo Installation successful!
    echo ================================================
    echo.
    echo You can now run start.bat to launch Daedalus
) else (
    cd ..\..
    echo.
    echo ================================================
    echo Installation failed!
    echo ================================================
    echo.
    echo Please check:
    echo 1. Node.js is properly extracted in node\ folder
    echo 2. You have internet connection
    echo 3. No firewall blocking npm
)

echo.
pause
