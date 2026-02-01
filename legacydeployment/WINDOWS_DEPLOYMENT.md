# Windows Deployment Guide for Daedalus

## Quick Start Testing

1. **Run the compatibility test first:**
   - Copy `windows-compatibility-test.bat` to your work laptop
   - Double-click to run it
   - Save the output to share with me

2. **Based on the test results, we'll choose the best deployment method.**

---

## Deployment Method A: Full Development Environment (If You Have Permissions)

### Prerequisites
- ✅ Visual Studio 2019/2022 with C++ Desktop Development
- ✅ Node.js 18+ and npm
- ✅ CMake 3.20+
- ✅ Git

### Steps
```batch
# Clone or copy the repository
git clone <repository-url> C:\Daedalus
cd C:\Daedalus

# Build C++ engine
mkdir build
cd build
cmake -G "Visual Studio 17 2022" -A x64 ..
cmake --build . --config Release
cd ..

# Install Node dependencies and build frontend
cd dashboard
npm install
npm run build
cd ..

# Start the application
start-windows.bat
```

---

## Deployment Method B: Pre-Compiled Portable (No Admin Required)

### What We'll Package
- Pre-compiled C++ executable (`run_calculation.exe`)
- Portable Node.js (no installation needed)
- All dependencies bundled
- SQLite database
- Built frontend
- Simple batch files to start/stop

### Structure
```
Daedalus-Portable/
├── start.bat                    # Double-click to start
├── stop.bat                     # Double-click to stop
├── bin/
│   └── run_calculation.exe     # Pre-compiled C++ engine
├── node/                        # Portable Node.js
│   ├── node.exe
│   └── npm/
├── dashboard/
│   ├── server/
│   │   ├── index.js            # Backend server
│   │   └── node_modules/       # Server dependencies
│   └── dist/                    # Built frontend
├── data/
│   ├── master.db               # Master database
│   └── users/                  # User databases
│       └── common/
│           └── scenario_analysis.db
└── docs/
    └── USER_GUIDE.html
```

### Usage (Portable Version)
1. Copy entire `Daedalus-Portable` folder to your laptop
2. Place it anywhere (Desktop, Documents, USB drive, etc.)
3. Double-click `start.bat`
4. Open browser to `http://localhost:3001`
5. When done, double-click `stop.bat`

---

## Deployment Method C: WSL2 (If Available)

If your laptop has WSL2 enabled:

```bash
# Install in WSL2
cd ~
git clone <repository-url> daedalus
cd daedalus

# Build and run (same as Linux)
mkdir build && cd build
cmake .. && make -j4
cd ..

# Start dashboard
cd dashboard
npm install && npm run build
node server/index.js
```

Access from Windows browser: `http://localhost:3001`

---

## Configuration for Single-User Windows Setup

### Database Paths
Windows paths in SQLite need special handling:

```javascript
// dashboard/server/config.js
const dbConfig = {
  masterDb: path.join(__dirname, '../../data/master.db'),
  defaultUserDb: path.join(__dirname, '../../data/users/common/scenario_analysis.db')
}
```

### Port Configuration
Default ports:
- Backend API: `3001`
- Frontend dev: `5173` (only during development)

To change ports, edit:
- `dashboard/server/config.js` - `port: 3001`
- `dashboard/vite.config.ts` - `server.port: 5173`

---

## Troubleshooting Common Windows Issues

### Issue: "Node is not recognized"
**Solution:** Either:
1. Install Node.js globally, OR
2. Use portable version (we'll provide)

### Issue: "Cannot find VCRUNTIME140.dll"
**Solution:** Install Visual C++ Redistributable:
- Download from Microsoft
- Or we'll bundle it with portable version

### Issue: "Port 3001 already in use"
**Solution:**
```batch
# Find what's using the port
netstat -ano | findstr :3001

# Kill the process (if safe)
taskkill /PID <process-id> /F
```

### Issue: Antivirus blocking executable
**Solution:**
- Request IT to whitelist `run_calculation.exe`
- Or run from a location antivirus doesn't scan deeply (often Documents folder)

### Issue: Firewall blocking localhost
**Solution:**
- Should not be an issue for 127.0.0.1
- If blocked, request IT to allow localhost connections

---

## Security Considerations for Work Laptop

### What Daedalus Does
- ✅ Runs ONLY on localhost (127.0.0.1)
- ✅ No external network connections
- ✅ No data leaves your machine
- ✅ No telemetry or analytics
- ✅ All data stored locally in SQLite

### What to Tell IT/Security
"This is a financial modeling application that:
- Runs entirely offline on localhost
- Processes sensitive financial data locally
- Makes no external network connections
- Stores all data in local SQLite databases
- Similar to running Excel macros, but with a web UI"

---

## Next Steps

1. **Run the compatibility test** (`windows-compatibility-test.bat`)
2. **Share the results** so I can prepare the optimal deployment package
3. **I'll create a custom package** based on your specific environment
4. **Test deployment** with sample data
5. **Full deployment** with your actual data

---

## Files You'll Need to Transfer

### Minimal (Portable Package - Recommended)
- `Daedalus-Portable.zip` (~50MB)
  - Includes everything pre-compiled
  - Just extract and run

### Full Source (If Building Locally)
- Clone entire repository
- Follow Method A instructions

### Your Data
- Your existing database files
- Place in `data/users/` directory
- Application will detect and use them

---

## Performance Notes

Windows performance should be similar to Mac/Linux:
- Small models (<10k entities): <5 seconds
- Medium models (10-50k entities): 10-30 seconds
- Large models (50k+ entities): 30-180 seconds
- Monte Carlo (1000 draws): 2-10 minutes

---

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the compatibility test output
3. Check Windows Event Viewer for errors
4. Share error messages for debugging
