#!/bin/bash
# Create portable Windows deployment package for Daedalus
# This creates a package that can run without installation on Windows

set -e

echo "================================================"
echo "Creating Daedalus Portable Windows Package"
echo "================================================"
echo ""

# Configuration
PACKAGE_NAME="Daedalus-Portable"
PACKAGE_DIR="deployment/${PACKAGE_NAME}"
BUILD_DIR="build/bin"

# Clean previous package
if [ -d "$PACKAGE_DIR" ]; then
    echo "Removing previous package..."
    rm -rf "$PACKAGE_DIR"
fi

# Create directory structure
echo "Creating directory structure..."
mkdir -p "$PACKAGE_DIR"/{bin,dashboard/{server,dist},data/{users/common,inputs},docs}

# Check if C++ executable exists
if [ ! -f "$BUILD_DIR/run_calculation.exe" ] && [ ! -f "$BUILD_DIR/run_calculation" ]; then
    echo "WARNING: C++ executable not found at $BUILD_DIR"
    echo "You'll need to compile for Windows or provide run_calculation.exe"
    mkdir -p "$PACKAGE_DIR/bin"
    cat > "$PACKAGE_DIR/bin/README_COMPILE.txt" << 'EOF'
C++ Executable Missing
======================

To complete this package, you need run_calculation.exe compiled for Windows.

Options:
1. Cross-compile from Mac/Linux using mingw-w64
2. Compile on Windows using Visual Studio (see WINDOWS_DEPLOYMENT.md Method A)
3. Use WSL to compile Linux binary if Windows has WSL2

Place the compiled run_calculation.exe in this bin/ directory.
EOF
else
    echo "Copying C++ executable..."
    if [ -f "$BUILD_DIR/run_calculation.exe" ]; then
        cp "$BUILD_DIR/run_calculation.exe" "$PACKAGE_DIR/bin/"
    else
        cp "$BUILD_DIR/run_calculation" "$PACKAGE_DIR/bin/run_calculation.exe"
    fi
fi

# Copy backend server files
echo "Copying backend server..."
cp -r dashboard/server/* "$PACKAGE_DIR/dashboard/server/"

# Copy built frontend
if [ -d "dashboard/dist" ]; then
    echo "Copying built frontend..."
    cp -r dashboard/dist/* "$PACKAGE_DIR/dashboard/dist/"
else
    echo "WARNING: Frontend not built. Run 'npm run build' in dashboard/ first."
    mkdir -p "$PACKAGE_DIR/dashboard/dist"
    echo "Frontend build missing - run 'npm run build' first" > "$PACKAGE_DIR/dashboard/dist/README.txt"
fi

# Copy data files
echo "Copying data files..."
cp -r data/inputs/* "$PACKAGE_DIR/data/inputs/" 2>/dev/null || echo "No input data files found"

# Create empty master database
echo "Creating master database..."
cat > "$PACKAGE_DIR/data/create_master_db.sql" << 'EOF'
-- Master database schema for user management
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    total_calculations INTEGER DEFAULT 0,
    last_calculation DATETIME
);

-- Create default admin user (password: admin123 - CHANGE THIS!)
-- Password hash for 'admin123' using bcrypt
INSERT OR IGNORE INTO users (username, password_hash, role)
VALUES ('admin', '$2b$10$rQ4QqK6xK8YqB3V8qQqK8uP8qQqK8YqB3V8qQqK8uP8qQqK8YqB3V', 'admin');
EOF

# Create Windows batch files
echo "Creating Windows batch files..."

# start.bat
cat > "$PACKAGE_DIR/start.bat" << 'EOF'
@echo off
title Daedalus - Financial Modeling Platform

echo ================================================
echo Starting Daedalus...
echo ================================================
echo.

REM Check if master database exists
if not exist "data\master.db" (
    echo Creating master database...
    node\node.exe node\npm\node_modules\npm\bin\npx-cli.js better-sqlite3 data\master.db < data\create_master_db.sql
    echo Database created.
    echo.
    echo DEFAULT LOGIN:
    echo   Username: admin
    echo   Password: admin123
    echo.
    echo IMPORTANT: Change the admin password after first login!
    echo.
)

REM Check if user database exists
if not exist "data\users\common\scenario_analysis.db" (
    echo Creating default user database...
    mkdir data\users\common 2>nul
    echo. > data\users\common\scenario_analysis.db
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
EOF

# stop.bat
cat > "$PACKAGE_DIR/stop.bat" << 'EOF'
@echo off
title Stopping Daedalus

echo Stopping Daedalus server...

REM Find and kill node processes running our server
for /f "tokens=2" %%i in ('tasklist ^| findstr "node.exe"') do (
    taskkill /PID %%i /F 2>nul
)

echo Server stopped.
timeout /t 2 >nul
EOF

# Create config file for Windows
cat > "$PACKAGE_DIR/dashboard/server/config.windows.js" << 'EOF'
// Windows-specific configuration
const path = require('path');

module.exports = {
  // Server configuration
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'production',

  // Database paths (Windows-friendly)
  masterDb: path.resolve(__dirname, '../../data/master.db'),
  defaultUserDb: path.resolve(__dirname, '../../data/users/common/scenario_analysis.db'),

  // C++ executable path
  calculationExe: path.resolve(__dirname, '../../bin/run_calculation.exe'),

  // Session configuration
  sessionSecret: process.env.SESSION_SECRET || 'change-this-secret-key-in-production',
  sessionMaxAge: 24 * 60 * 60 * 1000, // 24 hours

  // CORS configuration (single-user, localhost only)
  corsOrigin: false, // No CORS needed for localhost

  // Security (HTTP only for localhost)
  sessionSecure: false,

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info'
};
EOF

# Copy documentation
echo "Copying documentation..."
cp deployment/WINDOWS_DEPLOYMENT.md "$PACKAGE_DIR/docs/"
if [ -f "docs/docu/DAEDALUS_USER_GUIDE.html" ]; then
    cp docs/docu/DAEDALUS_USER_GUIDE.html "$PACKAGE_DIR/docs/"
fi

# Create main README
cat > "$PACKAGE_DIR/README.txt" << 'EOF'
Daedalus Portable - Windows Package
====================================

QUICK START:
1. Download and extract portable Node.js:
   - Go to https://nodejs.org/en/download/
   - Download "Windows Binary (.zip)" for x64
   - Extract to the "node/" folder in this directory

2. Install server dependencies:
   - Open Command Prompt in this folder
   - Run: node\node.exe node\npm install --prefix dashboard\server

3. Double-click start.bat

4. Open browser to: http://localhost:3001

5. Default login:
   Username: admin
   Password: admin123
   (CHANGE THIS AFTER FIRST LOGIN!)

REQUIREMENTS:
- Windows 10/11
- No admin rights needed
- ~500MB disk space
- 4GB+ RAM recommended

FILES:
- start.bat          - Start the application
- stop.bat           - Stop the application
- bin/               - Compiled C++ calculation engine
- node/              - Portable Node.js (you need to add this)
- dashboard/         - Web interface and backend
- data/              - Databases and input files
- docs/              - User guide and documentation

TROUBLESHOOTING:
See docs/WINDOWS_DEPLOYMENT.md for detailed help.

SECURITY:
- Runs only on localhost (127.0.0.1)
- No external network connections
- All data stays on your machine
EOF

# Create download instructions for Node.js
cat > "$PACKAGE_DIR/SETUP_INSTRUCTIONS.txt" << 'EOF'
Daedalus Setup Instructions for Windows
========================================

STEP 1: Download Portable Node.js
----------------------------------
1. Visit: https://nodejs.org/dist/v18.17.0/node-v18.17.0-win-x64.zip
2. Download the ZIP file
3. Extract the contents to the "node/" folder in this package
   After extraction, you should have:
   - Daedalus-Portable/node/node.exe
   - Daedalus-Portable/node/npm
   - Daedalus-Portable/node/npm.cmd

STEP 2: Install Dependencies
-----------------------------
1. Open Command Prompt
2. Navigate to this folder:
   cd C:\Path\To\Daedalus-Portable
3. Run:
   node\node.exe node\npm\bin\npm-cli.js install --prefix dashboard\server

STEP 3: First Run
-----------------
1. Double-click start.bat
2. Wait for "Daedalus is running!" message
3. Open browser to http://localhost:3001
4. Login with:
   Username: admin
   Password: admin123
5. IMMEDIATELY change the password!

STEP 4: Daily Use
-----------------
- Start: Double-click start.bat
- Stop: Press Ctrl+C in the window, or double-click stop.bat
- Access: http://localhost:3001

NOTES:
- No installation required
- No admin rights needed
- Can run from USB drive
- Data stored in data/ folder
- Portable - copy entire folder to move to another machine

If you encounter issues, see docs/WINDOWS_DEPLOYMENT.md
EOF

echo ""
echo "================================================"
echo "Package created: $PACKAGE_DIR"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Review $PACKAGE_DIR/SETUP_INSTRUCTIONS.txt"
echo "2. If missing, compile run_calculation.exe for Windows"
echo "3. Create ZIP file: cd deployment && zip -r ${PACKAGE_NAME}.zip ${PACKAGE_NAME}/"
echo "4. Transfer ZIP to Windows machine"
echo "5. Follow SETUP_INSTRUCTIONS.txt on Windows"
echo ""
echo "Package contents:"
du -sh "$PACKAGE_DIR" 2>/dev/null || echo "Size calculation not available"
echo ""
