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
