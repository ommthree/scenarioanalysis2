@echo off
REM Windows Compatibility Test for Daedalus Deployment
REM Run this on your work laptop to check what's available

echo ============================================
echo Daedalus Windows Compatibility Test
echo ============================================
echo.

echo [1/10] Checking Windows version...
ver
echo.

echo [2/10] Checking if we can create files...
echo test > %TEMP%\daedalus_test.txt
if exist %TEMP%\daedalus_test.txt (
    echo SUCCESS: Can create files
    del %TEMP%\daedalus_test.txt
) else (
    echo FAILED: Cannot create files
)
echo.

echo [3/10] Checking Node.js...
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: Node.js is installed
    node --version
    npm --version
) else (
    echo NOT FOUND: Node.js not installed
    echo Will need portable Node.js
)
echo.

echo [4/10] Checking C++ compiler...
where cl >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: MSVC compiler found
    cl 2>&1 | findstr /C:"Microsoft"
) else (
    echo NOT FOUND: MSVC not in PATH
    echo Checking for Visual Studio...
    if exist "C:\Program Files\Microsoft Visual Studio" (
        echo Visual Studio appears to be installed
        dir "C:\Program Files\Microsoft Visual Studio" /b
    ) else (
        echo Visual Studio not found in default location
    )
)
echo.

echo [5/10] Checking CMake...
where cmake >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: CMake is installed
    cmake --version
) else (
    echo NOT FOUND: CMake not installed
)
echo.

echo [6/10] Checking Git...
where git >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: Git is installed
    git --version
) else (
    echo NOT FOUND: Git not installed
)
echo.

echo [7/10] Checking available ports...
echo Testing if we can use port 3001...
netstat -an | findstr ":3001" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo WARNING: Port 3001 is already in use
) else (
    echo SUCCESS: Port 3001 is available
)
echo.

echo [8/10] Checking network/firewall...
echo Testing localhost connectivity...
ping -n 1 127.0.0.1 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: Localhost is accessible
) else (
    echo FAILED: Cannot reach localhost
)
echo.

echo [9/10] Checking execution policies...
echo Testing if we can run EXE files...
echo. > %TEMP%\test.exe
if exist %TEMP%\test.exe (
    echo SUCCESS: Can create .exe files
    del %TEMP%\test.exe
) else (
    echo FAILED: Cannot create .exe files
)
echo.

echo [10/10] Checking PowerShell...
where powershell >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: PowerShell is available
    powershell -Command "$PSVersionTable.PSVersion"
) else (
    echo WARNING: PowerShell not found
)
echo.

echo ============================================
echo Test Complete!
echo ============================================
echo.
echo Please save this output and share it.
echo.
echo Recommendations will be provided based on results.
echo.
pause
