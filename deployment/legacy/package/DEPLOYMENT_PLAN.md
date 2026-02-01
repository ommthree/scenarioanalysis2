# AWS Lightsail Deployment Plan - Scenario Analysis Application

## Overview

This document provides a step-by-step deployment plan for deploying the full-stack Scenario Analysis application to AWS Lightsail. The plan ensures the local development environment remains fully functional while creating a production deployment.

**Target Server:** 18.199.82.2 (eu-central-1)
**SSH Key:** `env/LightsailDefaultKey-eu-central-1.pem`
**Architecture:** nginx (reverse proxy) → Node.js (backend) → SQLite (database) + C++ (calculation engine)

---

## Phase 1: Local Preparation & Configuration

### Step 1.1: Create Environment-Aware Configuration

**Goal:** Make the application location-neutral without breaking local development.

**Actions:**
```bash
# Create server configuration module
touch dashboard/server/config.js
```

**File: `dashboard/server/config.js`**
```javascript
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '../..');

export const config = {
  // Core paths
  projectRoot: PROJECT_ROOT,
  dataDir: process.env.DATA_DIR || path.join(PROJECT_ROOT, 'data'),

  // Application paths
  engineBinary: process.env.ENGINE_BINARY || path.join(PROJECT_ROOT, 'build/bin/run_calculation'),
  masterDbPath: process.env.MASTER_DB_PATH || path.join(PROJECT_ROOT, 'data/users.db'),

  // Server configuration
  port: parseInt(process.env.PORT || '3001'),
  corsOrigin: IS_PRODUCTION ? (process.env.FRONTEND_URL || false) : 'http://localhost:5173',

  // Session configuration
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'), // 24 hours

  // Environment
  isProduction: IS_PRODUCTION,
  nodeEnv: process.env.NODE_ENV || 'development'
};

// Log configuration on startup (without secrets)
console.log('[Config] Application configuration:', {
  nodeEnv: config.nodeEnv,
  isProduction: config.isProduction,
  port: config.port,
  projectRoot: config.projectRoot,
  dataDir: config.dataDir,
  engineBinary: config.engineBinary
});
```

**Tests:**
- [ ] File created successfully
- [ ] No syntax errors when importing

---

### Step 1.2: Create Production Environment Template

**Goal:** Define production environment variables without secrets.

**Actions:**
```bash
# Create production environment template
touch .env.production.template
```

**File: `.env.production.template`**
```bash
# Production Environment Configuration
# Copy this to .env.production on the server and fill in actual values

NODE_ENV=production
PROJECT_ROOT=/home/ubuntu/app
DATA_DIR=/home/ubuntu/app/data
PORT=3000

# Generate a secure random secret for production:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=REPLACE_WITH_SECURE_RANDOM_SECRET

# Frontend URL (optional, leave empty for same-origin)
FRONTEND_URL=

# Engine binary path (usually auto-detected)
ENGINE_BINARY=/home/ubuntu/app/build/bin/run_calculation

# Master database path
MASTER_DB_PATH=/home/ubuntu/app/data/users.db

# Session duration (milliseconds)
SESSION_MAX_AGE=86400000
```

**Tests:**
- [ ] File created successfully
- [ ] Template is readable

---

### Step 1.3: Update Backend to Use Configuration

**Goal:** Modify index.js to use the new config module.

**Actions:**
- Update `dashboard/server/index.js` to import and use config
- Key areas to update:
  - CORS configuration
  - Session configuration
  - Database paths (getMasterDb function in middleware/database.js)
  - Engine binary paths in calculation endpoints

**File Updates: `dashboard/server/index.js`**
```javascript
// Add at the top after other imports
import { config } from './config.js';

// Update CORS (around line 42-45)
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));

// Update session configuration (around line 52)
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: config.dataDir
  }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: config.sessionMaxAge,
    httpOnly: true,
    secure: config.isProduction
  }
}));

// Update port (near the end)
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Dashboard API server running on http://localhost:${PORT}`);
});
```

**File Updates: `dashboard/server/middleware/database.js`**
```javascript
// Add at the top
import { config } from '../config.js';

// Update getMasterDb function
export function getMasterDb() {
  if (!masterDb) {
    const dbPath = config.masterDbPath;
    masterDb = new Database(dbPath);
    console.log('[Database] Master database initialized:', dbPath);
  }
  return masterDb;
}
```

**Tests:**
- [ ] `cd dashboard/server && node index.js` starts successfully
- [ ] Server logs show correct paths
- [ ] Local development still works (http://localhost:5173)
- [ ] Can login as admin
- [ ] Can perform a calculation
- [ ] Session persists after restart

---

### Step 1.4: Update Frontend Build Configuration

**Goal:** Ensure frontend builds correctly for production.

**Actions:**
Check `dashboard/vite.config.ts` - should already be correct, but verify:

```typescript
export default defineConfig({
  // ... other config
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
```

**Tests:**
```bash
cd dashboard
npm run build
ls -lh dist/  # Should see index.html and assets/
```

- [ ] Build completes without errors
- [ ] dist/ directory contains index.html
- [ ] dist/assets/ contains JS and CSS bundles

---

### Step 1.5: Create PM2 Ecosystem File

**Goal:** Define how PM2 should run the backend in production.

**Actions:**
```bash
touch ecosystem.config.cjs
```

**File: `ecosystem.config.cjs`**
```javascript
module.exports = {
  apps: [{
    name: 'scenario-backend',
    script: './dashboard/server/index.js',
    cwd: '/home/ubuntu/app',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PROJECT_ROOT: '/home/ubuntu/app',
      DATA_DIR: '/home/ubuntu/app/data',
      PORT: '3000'
    },
    env_file: '.env.production',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    kill_timeout: 5000
  }]
};
```

**Tests:**
- [ ] File created successfully
- [ ] Syntax is valid (check with `node -c ecosystem.config.cjs`)

---

### Step 1.6: Create Nginx Configuration Template

**Goal:** Define nginx reverse proxy configuration.

**Actions:**
```bash
mkdir -p deployment
touch deployment/nginx-scenario-app.conf
```

**File: `deployment/nginx-scenario-app.conf`**
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name 18.199.82.2;

    # Increase body size for file uploads
    client_max_body_size 50M;

    # Frontend static files
    root /var/www/scenario-app;
    index index.html;

    # Frontend routes (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout for long calculations
        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logs
    access_log /var/log/nginx/scenario-app-access.log;
    error_log /var/log/nginx/scenario-app-error.log;
}
```

**Tests:**
- [ ] File created successfully
- [ ] Nginx syntax looks correct

---

### Step 1.7: Create Deployment Helper Scripts

**Goal:** Create scripts to automate common deployment tasks.

**Actions:**
```bash
touch deployment/prepare-local.sh
touch deployment/deploy.sh
chmod +x deployment/*.sh
```

**File: `deployment/prepare-local.sh`**
```bash
#!/bin/bash
set -e

echo "=== Preparing local environment for deployment ==="

# Build frontend
echo "Building frontend..."
cd dashboard
npm install
npm run build
cd ..

# Create deployment package directory
echo "Creating deployment package..."
mkdir -p deployment/package

# Copy necessary files (excluding node_modules, build artifacts, etc.)
rsync -av --exclude='node_modules' \
          --exclude='build' \
          --exclude='dist' \
          --exclude='.git' \
          --exclude='*.log' \
          --exclude='.DS_Store' \
          --exclude='sessions.db' \
          ./ deployment/package/

# Copy built frontend
mkdir -p deployment/package/dashboard/dist
cp -r dashboard/dist/* deployment/package/dashboard/dist/

echo "Package prepared in deployment/package/"
echo "Ready to transfer to server"
```

**File: `deployment/deploy.sh`**
```bash
#!/bin/bash
set -e

# Configuration
SERVER_IP="18.199.82.2"
SSH_KEY="env/LightsailDefaultKey-eu-central-1.pem"
SERVER_USER="ubuntu"
REMOTE_DIR="/home/ubuntu/app"

echo "=== Deploying to Lightsail ($SERVER_IP) ==="

# Test SSH connection
echo "Testing SSH connection..."
ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$SERVER_USER@$SERVER_IP" "echo 'SSH connection successful'"

# Create remote directory
echo "Creating remote directory..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" "mkdir -p $REMOTE_DIR"

# Sync files to server
echo "Syncing files to server..."
rsync -avz --delete \
      -e "ssh -i $SSH_KEY" \
      deployment/package/ \
      "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"

echo "Deployment complete!"
echo "Next: SSH into server and run setup commands"
```

**Tests:**
```bash
bash -n deployment/prepare-local.sh  # Check syntax
bash -n deployment/deploy.sh         # Check syntax
```

- [ ] Scripts created successfully
- [ ] No syntax errors
- [ ] Scripts are executable

---

### Step 1.8: Test Local Changes

**Goal:** Verify all changes work correctly in local development.

**Test Checklist:**

1. **Start Backend:**
```bash
cd dashboard/server
node index.js
```
- [ ] Server starts on port 3001
- [ ] Config logs show correct paths
- [ ] No errors in console

2. **Start Frontend:**
```bash
cd dashboard
npm run dev
```
- [ ] Frontend starts on port 5173
- [ ] Can access http://localhost:5173

3. **Authentication Test:**
- [ ] Can access login page
- [ ] Can login as admin (admin/admin123)
- [ ] Session persists

4. **Calculation Test:**
- [ ] Navigate to "Perform Calculation"
- [ ] Run a calculation
- [ ] Calculation completes successfully
- [ ] Results are displayed

5. **Admin Panel Test:**
- [ ] Navigate to "User Management"
- [ ] Click "Summary" for OwenUser
- [ ] Total calculations shows >= 1

**If all tests pass:**
- [ ] Commit changes to git
- [ ] Ready for Phase 2

---

## Phase 2: Server Preparation

### Step 2.1: Verify SSH Access

**Goal:** Confirm connectivity to Lightsail instance.

**Commands:**
```bash
# Test SSH connection
ssh -i env/LightsailDefaultKey-eu-central-1.pem ubuntu@18.199.82.2

# Once connected, verify basic info
uname -a
free -h
df -h
```

**Tests:**
- [ ] Can connect via SSH
- [ ] Ubuntu OS confirmed
- [ ] Sufficient disk space (> 10GB free)
- [ ] Sufficient RAM (> 1GB free)

---

### Step 2.2: Configure Lightsail Firewall

**Goal:** Open required ports in Lightsail networking.

**Actions via AWS Console or CLI:**

Required ports:
- Port 22 (SSH) - should already be open
- Port 80 (HTTP) - open to 0.0.0.0/0
- Port 443 (HTTPS) - open to 0.0.0.0/0 (for future HTTPS)

**Via AWS Console:**
1. Go to Lightsail console
2. Select your instance
3. Navigate to "Networking" tab
4. Add firewall rules for ports 80 and 443

**Tests:**
```bash
# From local machine, test port 80
nc -zv 18.199.82.2 80
```
- [ ] Port 22 accessible
- [ ] Port 80 accessible
- [ ] Port 443 accessible

---

### Step 2.3: Update System and Install Core Packages

**Goal:** Prepare Ubuntu with necessary system packages.

**Commands (on server):**
```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Install essential build tools
sudo apt install -y build-essential git curl wget

# Install nginx
sudo apt install -y nginx

# Verify nginx
nginx -v
sudo systemctl status nginx
```

**Tests:**
- [ ] System updated successfully
- [ ] Build tools installed
- [ ] Nginx installed and running
- [ ] Can access http://18.199.82.2 (should show nginx default page)

---

### Step 2.4: Install Node.js via NVM

**Goal:** Install Node.js (version matching local development).

**Commands (on server):**
```bash
# Check local Node version first (on your Mac)
node --version  # Note this version

# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Add to bash profile for persistence
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bashrc
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.bashrc

# Install Node.js (use version from local machine)
nvm install 20  # or whatever version you're using locally
nvm use 20
nvm alias default 20

# Verify
node --version
npm --version
```

**Tests:**
- [ ] nvm installed successfully
- [ ] Node.js installed (same version as local)
- [ ] npm available
- [ ] `which node` points to nvm installation

---

### Step 2.5: Install PM2 Process Manager

**Goal:** Install PM2 for process management.

**Commands (on server):**
```bash
# Install PM2 globally
npm install -g pm2

# Verify
pm2 --version

# Setup PM2 to start on boot (don't run yet, just prepare)
pm2 startup
# Copy and run the command it outputs
```

**Tests:**
- [ ] PM2 installed successfully
- [ ] PM2 startup configured
- [ ] `pm2 list` shows empty list

---

### Step 2.6: Install C++ Build Dependencies

**Goal:** Install dependencies for building the C++ calculation engine.

**Commands (on server):**
```bash
# Install CMake and C++ compiler
sudo apt install -y cmake g++

# Install any additional libraries your engine needs
# Check your CMakeLists.txt for dependencies
sudo apt install -y libsqlite3-dev

# Verify
cmake --version
g++ --version
```

**Tests:**
- [ ] CMake installed (version 3.10+)
- [ ] g++ installed
- [ ] Can compile a simple C++ program

---

## Phase 3: Application Deployment

### Step 3.1: Prepare Local Deployment Package

**Goal:** Build and package the application locally.

**Commands (on local Mac):**
```bash
cd /Users/Owen/ScenarioAnalysis2

# Run preparation script
./deployment/prepare-local.sh
```

**Tests:**
- [ ] Frontend built successfully
- [ ] deployment/package/ directory created
- [ ] package contains all necessary files
- [ ] package/dashboard/dist/ contains built frontend

---

### Step 3.2: Transfer Files to Server

**Goal:** Copy application files to Lightsail.

**Commands (on local Mac):**
```bash
cd /Users/Owen/ScenarioAnalysis2

# Run deployment script
./deployment/deploy.sh
```

**Alternative manual rsync:**
```bash
rsync -avz --exclude='node_modules' \
           --exclude='build' \
           --exclude='.git' \
           -e "ssh -i env/LightsailDefaultKey-eu-central-1.pem" \
           ./ ubuntu@18.199.82.2:/home/ubuntu/app/
```

**Tests:**
- [ ] rsync completes without errors
- [ ] Files transferred successfully

**Verify on server:**
```bash
ssh -i env/LightsailDefaultKey-eu-central-1.pem ubuntu@18.199.82.2
ls -la /home/ubuntu/app/
```
- [ ] Files exist in /home/ubuntu/app/
- [ ] dashboard/ directory present
- [ ] engine/ directory present
- [ ] data/ directory present

---

### Step 3.3: Install Node Dependencies on Server

**Goal:** Install npm packages for backend.

**Commands (on server):**
```bash
cd /home/ubuntu/app/dashboard/server
npm install --production

cd /home/ubuntu/app/dashboard
npm install --production
```

**Tests:**
- [ ] Server dependencies installed
- [ ] node_modules/ directories created
- [ ] No errors during installation

---

### Step 3.4: Build C++ Engine on Server

**Goal:** Compile the calculation engine for Linux.

**Commands (on server):**
```bash
cd /home/ubuntu/app

# Create build directory
mkdir -p build
cd build

# Run CMake
cmake ..

# Build
make -j$(nproc)

# Verify binary exists
ls -lh bin/run_calculation
```

**Tests:**
- [ ] CMake configuration succeeds
- [ ] Compilation succeeds
- [ ] Binary exists at build/bin/run_calculation
- [ ] Binary is executable (`file build/bin/run_calculation` shows ELF executable)

**Quick functionality test:**
```bash
./build/bin/run_calculation --help
# Should show help or error message, not crash
```
- [ ] Engine runs without immediate crash

---

### Step 3.5: Prepare Data Directory and Databases

**Goal:** Set up data directory with proper permissions and initialize databases.

**Commands (on server):**
```bash
cd /home/ubuntu/app

# Create data directories
mkdir -p data/users/common

# Set proper permissions
chmod 755 data
chmod 755 data/users
chmod 755 data/users/common

# Copy master database from local or initialize
# Option 1: If you transferred users.db from local
ls -l data/users.db

# Option 2: If need to create fresh, run initialization script
# (You may need to create this script)
```

**Transfer users.db from local (recommended):**
```bash
# On local Mac
scp -i env/LightsailDefaultKey-eu-central-1.pem \
    data/users.db \
    ubuntu@18.199.82.2:/home/ubuntu/app/data/
```

**Tests:**
- [ ] data/ directory exists with correct permissions
- [ ] data/users.db exists
- [ ] Can read database: `sqlite3 data/users.db ".tables"`
- [ ] Users table exists and has admin user

**Verify admin user:**
```bash
sqlite3 data/users.db "SELECT id, username, role FROM users WHERE role='admin';"
```
- [ ] Admin user exists in database

---

### Step 3.6: Create Production Environment File

**Goal:** Set up production environment variables.

**Commands (on server):**
```bash
cd /home/ubuntu/app

# Generate secure session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy this output

# Create .env.production file
nano .env.production
```

**File content:**
```bash
NODE_ENV=production
PROJECT_ROOT=/home/ubuntu/app
DATA_DIR=/home/ubuntu/app/data
PORT=3000
SESSION_SECRET=<paste-generated-secret-here>
FRONTEND_URL=
ENGINE_BINARY=/home/ubuntu/app/build/bin/run_calculation
MASTER_DB_PATH=/home/ubuntu/app/data/users.db
SESSION_MAX_AGE=86400000
```

**Also copy API keys:**
```bash
# From local Mac
scp -i env/LightsailDefaultKey-eu-central-1.pem \
    env/api-keys.env \
    ubuntu@18.199.82.2:/home/ubuntu/app/env/
```

**Tests:**
- [ ] .env.production created
- [ ] Contains valid session secret
- [ ] env/api-keys.env copied
- [ ] File permissions are restrictive: `chmod 600 .env.production env/api-keys.env`

---

### Step 3.7: Configure and Start Backend with PM2

**Goal:** Start the Node.js backend using PM2.

**Commands (on server):**
```bash
cd /home/ubuntu/app

# Create logs directory
mkdir -p logs

# Start backend with PM2
pm2 start ecosystem.config.cjs

# Check status
pm2 status
pm2 logs scenario-backend --lines 50
```

**Tests:**
- [ ] PM2 starts successfully
- [ ] Process shows as "online" in `pm2 status`
- [ ] Logs show "[Config] Application configuration"
- [ ] Logs show "Dashboard API server running on http://localhost:3000"
- [ ] No errors in logs

**Test backend directly:**
```bash
# On server
curl http://localhost:3000/api/health
# Should return a response (may be 404 if health endpoint doesn't exist, but connection should work)

# Test a real endpoint
curl http://localhost:3000/api/auth/status
# Should return JSON response
```

- [ ] Backend responds to local requests

**Save PM2 configuration:**
```bash
pm2 save
```

---

### Step 3.8: Deploy Frontend Static Files

**Goal:** Copy built frontend to nginx serve directory.

**Commands (on server):**
```bash
# Create nginx directory
sudo mkdir -p /var/www/scenario-app

# Copy built frontend files
sudo cp -r /home/ubuntu/app/dashboard/dist/* /var/www/scenario-app/

# Set proper permissions
sudo chown -R www-data:www-data /var/www/scenario-app
sudo chmod -R 755 /var/www/scenario-app

# Verify files
ls -la /var/www/scenario-app/
```

**Tests:**
- [ ] Files copied successfully
- [ ] index.html exists in /var/www/scenario-app/
- [ ] assets/ directory exists
- [ ] Permissions are correct (www-data owns files)

---

### Step 3.9: Configure Nginx

**Goal:** Set up nginx as reverse proxy.

**Commands (on server):**
```bash
# Copy nginx configuration
sudo cp /home/ubuntu/app/deployment/nginx-scenario-app.conf \
        /etc/nginx/sites-available/scenario-app

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Enable new site
sudo ln -s /etc/nginx/sites-available/scenario-app \
           /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t
```

**Tests:**
- [ ] Nginx config file created
- [ ] Syntax test passes (`nginx -t` shows "syntax is ok")
- [ ] No conflicts or errors

**Reload nginx:**
```bash
sudo systemctl reload nginx
sudo systemctl status nginx
```

**Tests:**
- [ ] Nginx reloads successfully
- [ ] Nginx is running (active)

---

## Phase 4: Testing and Verification

### Step 4.1: Test Frontend Access

**Goal:** Verify the application loads in browser.

**Actions:**
1. Open browser to http://18.199.82.2
2. Check browser console for errors

**Tests:**
- [ ] Page loads (no connection refused)
- [ ] React app renders
- [ ] No 404 errors for static assets
- [ ] No CORS errors in console
- [ ] Login page displays

---

### Step 4.2: Test Authentication Flow

**Goal:** Verify login and session management.

**Test Steps:**
1. Navigate to http://18.199.82.2/login
2. Login with admin credentials
3. Check that you're redirected to home page
4. Verify session cookie is set

**Tests:**
- [ ] Login form submits
- [ ] Credentials are accepted
- [ ] Redirected after successful login
- [ ] Session persists (refresh page, still logged in)
- [ ] Can access protected routes

---

### Step 4.3: Test Calculation Functionality

**Goal:** Verify the C++ engine integration works.

**Test Steps:**
1. Login as admin
2. Navigate to "Perform Calculation"
3. Select database (should show user's database)
4. Click "Run Calculation"
5. Wait for completion

**Expected Results:**
- [ ] Calculation starts
- [ ] Backend logs show engine execution
- [ ] Calculation completes without errors
- [ ] Results are displayed in UI
- [ ] No timeout errors

**Check backend logs:**
```bash
# On server
pm2 logs scenario-backend --lines 100
```

Look for:
- [ ] "[INFO] Calculation started"
- [ ] "[INFO] Launching C++ calculation engine"
- [ ] "[INFO] Calculation completed successfully"

---

### Step 4.4: Test Admin Panel

**Goal:** Verify admin functionality works.

**Test Steps:**
1. Login as admin
2. Navigate to "User Management"
3. View user list
4. Click "Summary" for a user
5. Verify calculation count appears

**Tests:**
- [ ] User list loads
- [ ] Can view user summaries
- [ ] Calculation count is accurate
- [ ] All admin features work

---

### Step 4.5: Test Database Operations

**Goal:** Verify SQLite databases are working correctly.

**Test Steps:**
1. Create a new user via admin panel
2. Login as that user
3. Perform a calculation
4. Check that data persists

**Verify on server:**
```bash
# Check users database
sqlite3 /home/ubuntu/app/data/users.db \
  "SELECT username, total_calculations FROM users;"

# Check user's database exists
ls -la /home/ubuntu/app/data/users/
```

**Tests:**
- [ ] New user created successfully
- [ ] User's database file created
- [ ] User can login
- [ ] Calculations are tracked
- [ ] Data persists across sessions

---

### Step 4.6: Test File Uploads (if applicable)

**Goal:** Verify file upload functionality.

**Test Steps:**
1. Navigate to data upload page
2. Upload a CSV file
3. Verify file is processed

**Check permissions:**
```bash
# On server
ls -la /tmp/uploads/
```

**Tests:**
- [ ] Upload succeeds
- [ ] File appears in /tmp/uploads/
- [ ] File is processed correctly
- [ ] No permission errors

---

### Step 4.7: Load Testing (Optional)

**Goal:** Verify performance under load.

**Test Steps:**
1. Open multiple browser tabs
2. Login with different users
3. Run calculations simultaneously

**Tests:**
- [ ] System handles multiple concurrent users
- [ ] No memory leaks (check with `pm2 monit`)
- [ ] Response times acceptable
- [ ] No crashes or errors

---

## Phase 5: Monitoring and Maintenance

### Step 5.1: Set Up Log Monitoring

**Goal:** Ensure logs are accessible and rotated.

**Commands (on server):**
```bash
# View PM2 logs
pm2 logs

# View nginx access logs
sudo tail -f /var/log/nginx/scenario-app-access.log

# View nginx error logs
sudo tail -f /var/log/nginx/scenario-app-error.log
```

**Set up log rotation:**
```bash
# PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

**Tests:**
- [ ] Can view all logs
- [ ] Log rotation configured
- [ ] Logs don't fill disk space

---

### Step 5.2: Set Up Database Backups

**Goal:** Create automated SQLite backups.

**Commands (on server):**
```bash
# Create backup script
cat > /home/ubuntu/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR

# Backup master database
sqlite3 /home/ubuntu/app/data/users.db ".backup $BACKUP_DIR/users-$DATE.db"

# Backup user databases
for db in /home/ubuntu/app/data/users/*/scenario_analysis.db; do
  username=$(basename $(dirname $db))
  sqlite3 $db ".backup $BACKUP_DIR/${username}-$DATE.db"
done

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.db" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /home/ubuntu/backup-db.sh

# Test backup script
/home/ubuntu/backup-db.sh
ls -lh /home/ubuntu/backups/
```

**Set up daily cron job:**
```bash
# Add to crontab
crontab -e

# Add this line (runs daily at 2 AM):
0 2 * * * /home/ubuntu/backup-db.sh >> /home/ubuntu/backup.log 2>&1
```

**Tests:**
- [ ] Backup script runs successfully
- [ ] Backup files created
- [ ] Cron job scheduled
- [ ] Old backups are deleted

---

### Step 5.3: Set Up Health Monitoring

**Goal:** Monitor application health.

**Create health check script:**
```bash
cat > /home/ubuntu/health-check.sh << 'EOF'
#!/bin/bash

# Check if backend is responding
if ! curl -f http://localhost:3000/api/auth/status > /dev/null 2>&1; then
  echo "Backend not responding, restarting..."
  pm2 restart scenario-backend
fi

# Check if nginx is running
if ! systemctl is-active --quiet nginx; then
  echo "Nginx not running, starting..."
  sudo systemctl start nginx
fi
EOF

chmod +x /home/ubuntu/health-check.sh

# Add to crontab (runs every 5 minutes)
crontab -e
# Add: */5 * * * * /home/ubuntu/health-check.sh >> /home/ubuntu/health.log 2>&1
```

**Tests:**
- [ ] Health check script works
- [ ] Auto-restart configured
- [ ] Monitoring logs are created

---

### Step 5.4: Document Production Environment

**Goal:** Record production configuration for future reference.

**Create documentation:**
```bash
# On server
cat > /home/ubuntu/app/PRODUCTION_INFO.md << 'EOF'
# Production Environment Information

## Server Details
- IP: 18.199.82.2
- Region: eu-central-1
- OS: Ubuntu (check: lsb_release -a)

## Application Paths
- App root: /home/ubuntu/app
- Frontend: /var/www/scenario-app
- Logs: /home/ubuntu/app/logs
- Data: /home/ubuntu/app/data
- Backups: /home/ubuntu/backups

## Services
- Backend: PM2 (scenario-backend)
- Web server: Nginx
- Database: SQLite (multiple files)

## Useful Commands
```bash
# View application status
pm2 status
sudo systemctl status nginx

# View logs
pm2 logs scenario-backend
sudo tail -f /var/log/nginx/scenario-app-error.log

# Restart services
pm2 restart scenario-backend
sudo systemctl restart nginx

# Update application
cd /home/ubuntu/app
git pull
npm install --production
pm2 restart scenario-backend

# Backup databases
/home/ubuntu/backup-db.sh
```

## Environment Variables
- Defined in: .env.production
- API keys in: env/api-keys.env

## Maintenance
- Backups run daily at 2 AM
- Logs rotated by pm2-logrotate
- Health checks every 5 minutes
EOF
```

---

## Phase 6: Post-Deployment

### Step 6.1: Update DNS (Optional)

**Goal:** Point a domain name to the Lightsail IP.

**If you have a domain:**
1. Add an A record pointing to 18.199.82.2
2. Update nginx config to use domain name
3. Set up SSL with Let's Encrypt

**Commands for SSL:**
```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is set up automatically
sudo certbot renew --dry-run
```

---

### Step 6.2: Security Hardening (Recommended)

**Goal:** Improve production security.

**Actions:**

1. **Set up UFW firewall:**
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

2. **Disable root login:**
```bash
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

3. **Set up fail2ban:**
```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

4. **Secure database files:**
```bash
chmod 600 /home/ubuntu/app/data/users.db
chmod 600 /home/ubuntu/app/.env.production
chmod 600 /home/ubuntu/app/env/api-keys.env
```

---

### Step 6.3: Create Update/Rollback Procedure

**Goal:** Document how to update the application.

**Update procedure:**
```bash
# 1. SSH into server
ssh -i env/LightsailDefaultKey-eu-central-1.pem ubuntu@18.199.82.2

# 2. Backup current version
cd /home/ubuntu
tar -czf app-backup-$(date +%Y%m%d).tar.gz app/

# 3. Pull latest changes
cd /home/ubuntu/app
git pull

# 4. Rebuild frontend (if needed)
cd dashboard
npm install
npm run build
sudo cp -r dist/* /var/www/scenario-app/

# 5. Update backend dependencies
cd ../server
npm install --production

# 6. Rebuild C++ engine (if changed)
cd /home/ubuntu/app/build
make -j$(nproc)

# 7. Restart backend
pm2 restart scenario-backend

# 8. Verify
pm2 logs scenario-backend --lines 50
curl http://localhost:3000/api/auth/status

# 9. Test in browser
# Open http://18.199.82.2
```

**Rollback procedure:**
```bash
# 1. Stop current application
pm2 stop scenario-backend

# 2. Restore from backup
cd /home/ubuntu
rm -rf app
tar -xzf app-backup-YYYYMMDD.tar.gz

# 3. Restart
pm2 start app/ecosystem.config.cjs
```

---

## Troubleshooting Guide

### Issue: Cannot connect to server

**Diagnostic steps:**
```bash
# Test SSH
ssh -i env/LightsailDefaultKey-eu-central-1.pem -v ubuntu@18.199.82.2

# Check Lightsail firewall in AWS console
# Verify ports 22, 80, 443 are open

# Test from different network
```

### Issue: Nginx shows 502 Bad Gateway

**Diagnostic steps:**
```bash
# Check if backend is running
pm2 status
pm2 logs scenario-backend

# Check backend port
curl http://localhost:3000/api/auth/status

# Check nginx error logs
sudo tail -50 /var/log/nginx/scenario-app-error.log

# Restart backend
pm2 restart scenario-backend
```

### Issue: Frontend loads but API calls fail

**Diagnostic steps:**
```bash
# Check CORS configuration
# Backend should not require CORS in production (same-origin)

# Check nginx proxy configuration
sudo nano /etc/nginx/sites-available/scenario-app
# Verify proxy_pass is correct

# Test backend directly
curl http://localhost:3000/api/auth/status

# Check nginx access logs
sudo tail -50 /var/log/nginx/scenario-app-access.log
```

### Issue: Calculations fail or timeout

**Diagnostic steps:**
```bash
# Check if C++ engine binary exists
ls -l /home/ubuntu/app/build/bin/run_calculation

# Test engine manually
cd /home/ubuntu/app
./build/bin/run_calculation

# Check engine logs in PM2
pm2 logs scenario-backend | grep -i "calculation"

# Check database permissions
ls -la /home/ubuntu/app/data/

# Increase nginx timeout if needed
sudo nano /etc/nginx/sites-available/scenario-app
# Increase proxy_read_timeout
```

### Issue: Session not persisting

**Diagnostic steps:**
```bash
# Check session database
ls -la /home/ubuntu/app/data/sessions.db

# Check session secret is set
cat /home/ubuntu/app/.env.production | grep SESSION_SECRET

# Check browser cookies
# Open browser DevTools > Application > Cookies

# Verify secure cookie setting
# In production with HTTP, secure should be false
```

### Issue: Permission denied errors

**Diagnostic steps:**
```bash
# Check file ownership
ls -la /home/ubuntu/app/data/

# Fix ownership if needed
sudo chown -R ubuntu:ubuntu /home/ubuntu/app/

# Check directory permissions
chmod 755 /home/ubuntu/app/data
chmod 755 /home/ubuntu/app/data/users
```

---

## Success Criteria

The deployment is considered successful when all of the following are true:

- [ ] Application accessible at http://18.199.82.2
- [ ] Users can login successfully
- [ ] Calculations execute without errors
- [ ] Results are displayed correctly
- [ ] Admin panel functions properly
- [ ] Sessions persist across browser refreshes
- [ ] No errors in nginx logs
- [ ] No errors in PM2 logs
- [ ] Database operations work correctly
- [ ] File uploads work (if applicable)
- [ ] Multiple concurrent users supported
- [ ] Application survives server restart
- [ ] Backups are running automatically
- [ ] Health checks are monitoring services

---

## Rollback Plan

If deployment fails and cannot be fixed quickly:

1. **Stop the new application:**
```bash
pm2 stop scenario-backend
```

2. **Restore from backup (if you backed up):**
```bash
cd /home/ubuntu
tar -xzf app-backup-YYYYMMDD.tar.gz
```

3. **Revert nginx configuration:**
```bash
sudo rm /etc/nginx/sites-enabled/scenario-app
sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

4. **Communicate status**
- Document what went wrong
- Note at what step the failure occurred
- Gather logs for debugging

---

## Maintenance Schedule

**Daily:**
- Automated database backups (2 AM)
- Health checks (every 5 minutes)

**Weekly:**
- Review logs for errors
- Check disk space: `df -h`
- Check memory usage: `free -h`

**Monthly:**
- Update system packages: `sudo apt update && sudo apt upgrade`
- Review and archive old logs
- Test backup restoration procedure
- Review user activity in admin panel

---

## Additional Resources

**Key Files:**
- Production config: `/home/ubuntu/app/.env.production`
- PM2 config: `/home/ubuntu/app/ecosystem.config.cjs`
- Nginx config: `/etc/nginx/sites-available/scenario-app`
- Backup script: `/home/ubuntu/backup-db.sh`
- Health check: `/home/ubuntu/health-check.sh`

**Useful Commands:**
```bash
# SSH to server
ssh -i env/LightsailDefaultKey-eu-central-1.pem ubuntu@18.199.82.2

# View all logs
pm2 logs
sudo tail -f /var/log/nginx/scenario-app-error.log

# Check status
pm2 status
sudo systemctl status nginx

# Restart services
pm2 restart scenario-backend
sudo systemctl restart nginx

# Monitor resources
pm2 monit
htop
```

---

## Notes

- Keep the SSH key (`env/LightsailDefaultKey-eu-central-1.pem`) secure and backed up
- Document any deviations from this plan
- Update this document as the production environment evolves
- Consider setting up staging environment for testing updates
