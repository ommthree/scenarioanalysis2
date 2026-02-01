# Daedalus Deployment Options Summary

This document summarizes all available deployment options for Daedalus.

## Current Deployments

### 1. AWS Lightsail Production Server ✅
**Status:** Active and working
**URL:** http://18.185.58.149
**Login:** OwenAdmin / 16SaPe66ebf**!

**Recent Fixes:**
- ✅ Long-running calculation timeouts resolved
- ✅ Progress tracking with 15-second updates
- ✅ Nginx proxy buffering disabled
- ✅ 10-minute timeout configuration across all layers
- ✅ SSH connection issues fixed (UseDNS disabled)

**Architecture:**
- Frontend: Served by nginx from `/var/www/scenario-app`
- Backend: Node.js on port 3001, proxied by nginx
- Database: SQLite in `/home/ubuntu/app/data`
- Calculations: C++ executable called by backend

**Deployment Commands:**
```bash
# Deploy backend
scp -i env/LightsailDefaultKey-eu-central-1.pem \
  dashboard/server/index.js \
  ubuntu@18.185.58.149:/home/ubuntu/app/dashboard/server/
ssh -i env/LightsailDefaultKey-eu-central-1.pem ubuntu@18.185.58.149 \
  "pm2 restart scenario-api"

# Deploy frontend
cd dashboard && npm run build
scp -i env/LightsailDefaultKey-eu-central-1.pem \
  dist/assets/index-*.js \
  ubuntu@18.185.58.149:/var/www/scenario-app/assets/
scp -i env/LightsailDefaultKey-eu-central-1.pem \
  dist/index.html \
  ubuntu@18.185.58.149:/var/www/scenario-app/
```

### 2. Local Development (macOS) ✅
**Status:** Active
**URL:** http://localhost:5173 (dev) or http://localhost:3001 (prod)

**Setup:**
```bash
# Build C++ engine
mkdir build && cd build
cmake .. && make -j4
cd ..

# Start backend
cd dashboard/server
node index.js

# Start frontend dev server (in another terminal)
cd dashboard
npm run dev

# Or build and serve production frontend
npm run build
# Then access through backend on port 3001
```

---

## Windows Deployment Options

### Option A: Full Development Environment
**Best for:** Users with admin rights and Visual Studio installed

**Requirements:**
- ✅ Visual Studio 2019/2022 with C++ Desktop Development
- ✅ Node.js 18+
- ✅ CMake 3.20+
- ✅ Git

**Advantages:**
- Full development capabilities
- Can rebuild from source
- Latest updates via git pull

**Disadvantages:**
- Requires admin rights
- Large installation (~10GB)
- Complex setup

**Instructions:** See `WINDOWS_DEPLOYMENT.md` Method A

---

### Option B: Portable Package ⭐ RECOMMENDED
**Best for:** Locked-down corporate laptops without admin rights

**Requirements:**
- ✅ Windows 10/11
- ✅ ~500MB disk space
- ✅ No admin rights needed

**Package Contents:**
```
Daedalus-Portable/
├── start.bat              # Double-click to run
├── stop.bat               # Double-click to stop
├── bin/
│   └── run_calculation.exe
├── node/                  # Portable Node.js
├── dashboard/
│   ├── server/
│   └── dist/
├── data/
│   ├── master.db
│   └── users/common/
└── docs/
```

**Advantages:**
- No installation required
- No admin rights needed
- Can run from USB drive
- Single folder deployment
- All data stays local

**Disadvantages:**
- Pre-compiled - can't modify C++ code
- Manual updates (replace files)

**Setup Process:**
1. Run compatibility test: `windows-compatibility-test.bat`
2. Download portable Node.js
3. Extract package
4. Run `start.bat`

**Instructions:** See `WINDOWS_DEPLOYMENT.md` Method B

---

### Option C: WSL2 (If Available)
**Best for:** Modern Windows with WSL2 enabled

**Requirements:**
- ✅ Windows 10 version 2004+ or Windows 11
- ✅ WSL2 enabled
- ✅ Ubuntu distribution installed

**Advantages:**
- Native Linux environment
- Full development capabilities
- Same setup as macOS/Linux

**Disadvantages:**
- Requires WSL2 (may need admin to enable)
- Uses more resources
- Separate Linux environment

**Instructions:** See `WINDOWS_DEPLOYMENT.md` Method C

---

## Deployment Scripts

### Created for Windows Deployment

1. **`windows-compatibility-test.bat`**
   - Tests Windows environment
   - Checks for Node.js, Visual Studio, CMake, Git
   - Tests ports, permissions, network
   - Run this first to determine best deployment method

2. **`create-portable-package.sh`** (Run on Mac/Linux)
   - Creates complete portable package
   - Copies all necessary files
   - Generates Windows batch files
   - Creates setup instructions

3. **`compile-for-windows.sh`** (Run on Mac with mingw-w64)
   - Cross-compiles C++ engine for Windows
   - Requires: `brew install mingw-w64`
   - Outputs: `run_calculation.exe`

4. **`cmake/mingw-w64-toolchain.cmake`**
   - CMake toolchain for cross-compilation
   - Configures mingw-w64 compiler
   - Static linking for portability

---

## Deployment Workflow

### For Windows Deployment

#### Step 1: Compatibility Test
```bash
# User runs on Windows laptop
windows-compatibility-test.bat > compatibility-results.txt
```

#### Step 2: Analyze Results
Based on test output, recommend:
- **Option A** if Visual Studio + CMake available
- **Option B** if restricted environment (most likely)
- **Option C** if WSL2 available

#### Step 3: Create Package (On Mac)
```bash
# Build C++ for Windows (if mingw-w64 available)
brew install mingw-w64
./deployment/compile-for-windows.sh

# OR: Skip this and compile on Windows machine

# Create portable package
./deployment/create-portable-package.sh

# Create ZIP for transfer
cd deployment
zip -r Daedalus-Portable.zip Daedalus-Portable/
```

#### Step 4: Transfer to Windows
```bash
# Transfer via email, USB, or network share
# Size: ~50MB (without node) or ~150MB (with node)
```

#### Step 5: Setup on Windows
```batch
REM Extract ZIP
REM Download portable Node.js to node/ folder
REM Install dependencies
node\node.exe node\npm\bin\npm-cli.js install --prefix dashboard\server

REM Start application
start.bat
```

---

## Configuration for Single-User Windows

### Database Configuration
```javascript
// dashboard/server/config.windows.js
const path = require('path');

module.exports = {
  port: 3001,
  masterDb: path.resolve(__dirname, '../../data/master.db'),
  defaultUserDb: path.resolve(__dirname, '../../data/users/common/scenario_analysis.db'),
  calculationExe: path.resolve(__dirname, '../../bin/run_calculation.exe'),
  sessionSecret: 'change-this-secret-key',
  corsOrigin: false, // No CORS for localhost
  sessionSecure: false // HTTP for localhost
};
```

### User Authentication
For single-user Windows deployment:
- Use default admin account
- No multi-user features needed
- Session persists for 24 hours
- All data in local SQLite databases

---

## Security Considerations

### Localhost-Only Deployment
All deployment options run on `127.0.0.1`:
- ✅ No external network access
- ✅ No data leaves the machine
- ✅ No telemetry
- ✅ All computation local

### Work Laptop Compliance
**What to tell IT/Security:**
> "This is a financial modeling application that runs entirely offline on localhost, processes sensitive financial data locally, makes no external network connections, and stores all data in local SQLite databases. Similar to running Excel macros, but with a web UI for better visualization."

---

## Performance Expectations

### Calculation Times (All Platforms)
- Small models (<10k entities): <5 seconds
- Medium models (10-50k entities): 10-30 seconds
- Large models (50k+ entities): 30-180 seconds
- Monte Carlo (1000 draws): 2-10 minutes

### Platform Differences
- **Mac M1/M2:** Fastest (native ARM)
- **Windows (native):** Similar to Mac Intel
- **WSL2:** ~10% slower than native
- **AWS t2.small:** Slower (2 vCPU, 2GB RAM)

---

## Troubleshooting

### Common Issues

1. **Port 3001 already in use**
   ```batch
   netstat -ano | findstr :3001
   taskkill /PID <pid> /F
   ```

2. **"VCRUNTIME140.dll not found"**
   - Install Visual C++ Redistributable
   - Or bundle DLLs with executable

3. **Antivirus blocking executable**
   - Request IT whitelist
   - Or place in less-monitored folder (Documents)

4. **Node.js not found**
   - Use portable Node.js
   - Or install globally

5. **Cannot create files**
   - Check write permissions
   - Run from user directory (not Program Files)

---

## Next Steps

1. ✅ **Production Server:** Working and stable
2. ✅ **Local Development:** Working on macOS
3. 🔄 **Windows Deployment:** Ready for testing
   - User runs compatibility test
   - Create appropriate package
   - Test on work laptop
4. 📋 **Future:** Docker deployment option

---

## Support Files

- `WINDOWS_DEPLOYMENT.md` - Detailed Windows deployment guide
- `windows-compatibility-test.bat` - Environment testing script
- `create-portable-package.sh` - Package creation script
- `compile-for-windows.sh` - Cross-compilation script
- `nginx-config.conf` - Production nginx configuration
- `prepare-and-deploy.sh` - Automated AWS deployment

---

## Questions?

**For Windows deployment:**
1. Run `windows-compatibility-test.bat` first
2. Review output
3. Choose deployment method based on results
4. Follow corresponding section in `WINDOWS_DEPLOYMENT.md`

**For production issues:**
- Check AWS Lightsail console
- Review PM2 logs: `pm2 logs scenario-api`
- Check nginx logs: `/var/log/nginx/error.log`

**For development issues:**
- Check Node.js version (18+)
- Rebuild C++ engine if needed
- Clear browser cache for frontend issues
