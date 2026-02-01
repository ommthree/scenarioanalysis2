# GCaaS Deployment Guide: ScenarioAnalysis2

**Last Updated:** 2026-02-01
**Status:** Ready for deployment preparation

---

## Overview

This guide explains how to prepare the ScenarioAnalysis2 application for deployment to PwC's Global Container as a Service (GCaaS) platform. The process is split into two phases:

1. **Phase 1 (Mac):** Restructure the codebase and create GCaaS configuration files
2. **Phase 2 (Work PC):** Commit and push to PwC GitHub to trigger automatic deployment

---

## Current Application Architecture

**Tech Stack:**
- C++20 calculation engine (CMake-based build)
- Node.js API server (port 3001)
- React 19 + TypeScript frontend (Vite dev server on 5173)
- SQLite database

**Current Folder Structure:**
```
ScenarioAnalysis2/
├── engine/          # C++ calculation engine
├── dashboard/       # React frontend + Node.js backend
├── data/           # SQLite database + CSV files
├── docs/           # Documentation
└── build/          # CMake build output
```

---

## GCaaS Requirements

### Required Folder Structure

GCaaS expects this specific layout:

```
myapp/
├── src/              # All application source code
├── run/              # Contains Dockerfile
└── deployment/       # Contains values.yaml
```

**Why?**
- `src/` contains your application code
- `run/` contains the Dockerfile that GCaaS will build
- `deployment/values.yaml` tells GCaaS where to find build path, image name, and container port

---

## Phase 1: Prepare on Mac

### Step 1: Install Docker (if not already installed)

You need Docker Desktop, Rancher Desktop, or colima to test the container locally.

```bash
# Check if Docker is installed
docker --version

# If not installed, download Docker Desktop for Mac
# https://www.docker.com/products/docker-desktop
```

### Step 2: Add GCaaS Structure (Keep Local Dev Intact)

**Important:** We'll add GCaaS folders WITHOUT breaking your local development workflow. Your current structure stays exactly as-is.

**The Strategy:**
- Keep all current folders (engine/, dashboard/, data/) unchanged
- Add src/ folder with symlinks to existing folders
- Add run/ and deployment/ folders for GCaaS
- Local dev continues to work normally

```bash
cd /Users/Owen/ScenarioAnalysis2

# Create GCaaS-required folders
mkdir -p run
mkdir -p deployment
mkdir -p src

# Create symlinks in src/ pointing to actual code
cd src
ln -s ../engine engine
ln -s ../dashboard dashboard
ln -s ../data data
ln -s ../external external
ln -s ../CMakeLists.txt CMakeLists.txt
cd ..
```

**Verify symlinks worked:**
```bash
ls -la src/
# Should show: engine -> ../engine, dashboard -> ../dashboard, etc.
```

**Your local development workflow remains unchanged:**
- `cd dashboard && npm run dev` ✅ Still works
- `cd build && cmake .. && make` ✅ Still works
- All existing scripts and paths ✅ Still work

**GCaaS sees the required structure:**
- `src/` folder ✅ (via symlinks)
- `run/` folder ✅ (contains Dockerfile)
- `deployment/` folder ✅ (contains values.yaml)

### Step 3: Create the Dockerfile

Create `run/Dockerfile` (at the root level):

```dockerfile
# Multi-stage build for ScenarioAnalysis2
FROM ubuntu:22.04 AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    g++ \
    cmake \
    build-essential \
    git \
    libsqlite3-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18.x
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Set working directory
WORKDIR /app

# Copy source code
COPY ../src /app

# Build C++ engine
WORKDIR /app/engine
RUN mkdir -p build && cd build \
    && cmake .. -DCMAKE_BUILD_TYPE=Release \
    && make -j$(nproc)

# Build dashboard frontend
WORKDIR /app/dashboard
RUN npm ci --production=false \
    && npm run build

# Production stage
FROM ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libsqlite3-0 \
    nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/engine/build/bin /app/bin
COPY --from=builder /app/dashboard/dist /app/dashboard/dist
COPY --from=builder /app/dashboard/server /app/dashboard/server
COPY --from=builder /app/dashboard/node_modules /app/dashboard/node_modules
COPY --from=builder /app/dashboard/package.json /app/dashboard/package.json
COPY --from=builder /app/data /app/data

# Set environment variables for production
ENV NODE_ENV=production
ENV VITE_API_BASE_URL=http://localhost:3001

# Expose the API server port
EXPOSE 3001

# Start the Node.js server
CMD ["node", "/app/dashboard/server/index.js"]
```

**Important notes:**
- Uses multi-stage build to reduce final image size
- Builds both C++ engine and React frontend
- Exposes port 3001 (the Node.js API server)
- The frontend build (Vite) is served as static files by the Node.js server

### Step 4: Update Node.js Server to Serve Frontend

The Node.js server needs to serve the built React app. Check if `dashboard/server/index.js` already does this. If not, add:

```javascript
// Add this to dashboard/server/index.js (near the end, before app.listen)
const path = require('path');

// Serve static files from the React app build
app.use(express.static(path.join(__dirname, '../dist')));

// All other routes serve the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});
```

### Step 5: Create deployment/values.yaml

Create `deployment/values.yaml` (at the root level):

```yaml
apps:
  - name: scenarioanalysis2
    ingress: enabled
    image:
      build: true
      path: default        # corresponds to ./src
      repository: default
      tag: default         # will use commit hash
    port: 3001            # MUST match EXPOSE in Dockerfile
    resources:
      requests:
        cpu: 500m         # 0.5 CPU cores
        memory: 1Gi       # 1 GB RAM
      limits:
        cpu: 2000m        # 2 CPU cores
        memory: 4Gi       # 4 GB RAM (for C++ engine + SQLite)
    env:
      - name: NODE_ENV
        value: production
      - name: VITE_API_BASE_URL
        value: http://localhost:3001
```

**Key settings explained:**
- `port: 3001` - **CRITICAL:** Must match the EXPOSE directive in Dockerfile
- `ingress: enabled` - Creates a public URL for your app
- `build: true` - GCaaS will build the Dockerfile on every commit
- `resources` - Adjust based on your app's needs (C++ engine may need more memory)

### Step 6: Test the Container Locally (STRONGLY RECOMMENDED)

Before pushing to GitHub, test that the Docker build works:

```bash
cd /Users/Owen/ScenarioAnalysis2/run

# Build the Docker image
docker build . -t scenarioanalysis2:test

# Run the container
docker run -p 3001:3001 scenarioanalysis2:test

# Test in another terminal
curl http://localhost:3001/

# Or open in browser: http://localhost:3001
```

**Note:** The symlinks in `src/` will be followed during the Docker build, so the container gets all your actual code.

**If the build fails:**
- Check the error messages
- Common issues: missing dependencies, incorrect COPY paths, build failures
- Fix in the Dockerfile and rebuild

**If the app doesn't respond:**
- Check that port 3001 is exposed correctly
- Verify the CMD directive starts the server
- Check logs: `docker logs <container-id>`

### Step 7: Commit GCaaS Configuration Locally

Once the Docker build succeeds locally, commit the new files:

```bash
cd /Users/Owen/ScenarioAnalysis2

# Check what's new
git status
# Should show: src/, run/, deployment/ as new

# Add GCaaS configuration files
git add src/ run/ deployment/
git add .gitignore  # Update if needed (see note below)

# Commit the GCaaS structure
git commit -m "Add GCaaS deployment configuration"
```

**Important: Update .gitignore**

Make sure `.gitignore` doesn't exclude the new folders:
```bash
# If .gitignore has /src or /run, remove those lines
# The src/ folder contains symlinks (tiny), so it's safe to commit
```

### Step 8: Transfer Repository to Work PC

**Option A: Via Personal GitHub (Recommended)**

```bash
# On Mac: Push to your personal GitHub
git remote add personal https://github.com/yourusername/scenarioanalysis2.git
git push personal main

# On Work PC: Clone from personal GitHub
git clone https://github.com/yourusername/scenarioanalysis2.git
cd scenarioanalysis2
```

**Option B: Via USB/Cloud Storage**

```bash
# On Mac: Create archive of entire repo
cd /Users/Owen/ScenarioAnalysis2
tar -czf ../scenarioanalysis2.tar.gz .

# Transfer scenarioanalysis2.tar.gz to work PC

# On Work PC: Extract
tar -xzf scenarioanalysis2.tar.gz
cd ScenarioAnalysis2
```

**Option C: Direct Git Bundle**

```bash
# On Mac: Create git bundle
git bundle create scenarioanalysis2.bundle --all

# Transfer bundle file to work PC

# On Work PC: Clone from bundle
git clone scenarioanalysis2.bundle scenarioanalysis2
cd scenarioanalysis2
```

---

## Phase 2: Deploy from Work PC (with PwC GitHub Access)

### Step 1: Verify Repository Structure

On your work PC (after transferring):

```bash
cd scenarioanalysis2

# Verify GCaaS structure exists
ls -la
# Should see: src/, run/, deployment/ plus engine/, dashboard/, data/, etc.

# Verify symlinks work (if transferred via git)
ls -la src/
# Should see: engine -> ../engine, dashboard -> ../dashboard, etc.
```

**Note:** If symlinks broke during transfer (e.g., via zip), recreate them:
```bash
cd src
ln -s ../engine engine
ln -s ../dashboard dashboard
ln -s ../data data
ln -s ../external external
ln -s ../CMakeLists.txt CMakeLists.txt
cd ..
```

### Step 2: Push to PwC GitHub

```bash
# Add your PwC GitHub remote
git remote add origin https://github.com/pwc/<your-repo-name>.git

# Push to GitHub
git push -u origin main
```

**Note:** Replace `<your-repo-name>` with your actual PwC GitHub repository name.

### Step 3: Configure in GCaaS Management Console

1. Open the **Global CaaS Management Console** (link from PwC intranet)
2. Click **"Create New Application"** or **"Add Repository"**
3. Select your GitHub repository
4. GCaaS will automatically detect:
   - `deployment/values.yaml` configuration
   - `run/Dockerfile` build instructions
   - Source code in `src/`

### Step 4: Monitor the Pipeline

Watch the **Pipeline** tab in GCaaS console:

1. **Clone Repository** - GCaaS pulls your code from GitHub
2. **Build Docker Image** - Executes your Dockerfile
3. **Push to Registry** - Stores the built image
4. **Deploy Pod** - Launches your container
5. **Health Check** - Verifies the app is responding

**Build time estimate:** 5-15 minutes (first build, then ~3-5 min for subsequent builds)

### Step 5: Access Your Application

Once deployed:

1. Go to GCaaS console → Your App → **Networking** tab
2. Copy the ingress URL (format: `https://<your-app>.gcaas.pwc.com`)
3. Open the URL in your browser
4. You should see the ScenarioAnalysis2 dashboard

---

## Validation Checklist

After deployment, verify:

- [ ] **Pod logs show server started** (GCaaS console → Pod → Logs)
- [ ] **Application responds** (open ingress URL)
- [ ] **Database loads** (test database selection in UI)
- [ ] **C++ engine executes** (run a calculation)
- [ ] **Frontend loads correctly** (check all pages)
- [ ] **API endpoints work** (check browser dev console for errors)

---

## Troubleshooting

### Build Fails

**Check "Build Docker Images" logs in GCaaS Pipeline:**

Common issues:
- Missing dependencies in Dockerfile
- Incorrect COPY paths (check `../src` is correct)
- CMake errors (missing external libraries like Eigen3)
- npm build errors (check package.json scripts)

**Solution:** Fix Dockerfile, commit, and push again.

### Pod Crashes or Won't Start

**Check Pod Logs in GCaaS console:**

Common issues:
- Port mismatch (Dockerfile EXPOSE ≠ values.yaml port)
- Missing environment variables
- Database file not found
- Permissions issues

**Solution:** Update values.yaml or Dockerfile, commit, push.

### Application Loads but Features Don't Work

**Check browser console for errors:**

Common issues:
- API base URL incorrect (frontend can't reach backend)
- CORS issues (frontend domain ≠ backend domain)
- Missing static files (Vite build didn't copy all assets)

**Solution:** Update environment variables or server configuration.

### Cannot Access URL

**Check Networking settings in GCaaS console:**

Common issues:
- `ingress: enabled` not set in values.yaml
- Port not exposed correctly
- Application not responding on health check endpoint

**Solution:** Add ingress configuration, verify port settings.

---

## Ongoing Deployment (Iteration)

After initial setup, deployment is automatic:

1. **Make code changes** (on Mac or work PC)
2. **Commit to Git:** `git commit -am "Fix bug XYZ"`
3. **Push to GitHub:** `git push`
4. **GCaaS auto-builds** (watch Pipeline tab)
5. **New version deployed** (commit hash shown in GCaaS console)

**No manual steps needed** - GCaaS handles everything after the push.

---

## Secrets Management (If Needed)

If your app needs API keys, database passwords, etc.:

1. **Do NOT commit secrets to GitHub**
2. Add them via GCaaS Secret Management UI:
   - GCaaS console → Your App → Secrets
   - Add secret name/value
   - GCaaS fetches from Vault during deployment
3. Reference in `values.yaml`:

```yaml
env:
  - name: ANTHROPIC_API_KEY
    valueFrom:
      secretKeyRef:
        name: anthropic-api-key
        key: api-key
```

---

## Additional Resources

**PwC Internal Documentation:**
- [Global Container as a Service (GCaaS) Overview](sharepoint-link)
- [UK Quickstart with Global CaaS](sharepoint-link)
- [API Standards](sharepoint-link)

**Docker Documentation:**
- [Dockerfile reference](https://docs.docker.com/engine/reference/builder/)
- [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)

**Kubernetes (GCaaS uses K8s under the hood):**
- [Resource requests and limits](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)

---

## Summary: Quick Command Reference

**On Mac:**
```bash
cd /Users/Owen/ScenarioAnalysis2

# Create GCaaS structure with symlinks (keeps local dev working)
mkdir -p run deployment src
cd src
ln -s ../engine engine
ln -s ../dashboard dashboard
ln -s ../data data
ln -s ../external external
ln -s ../CMakeLists.txt CMakeLists.txt
cd ..

# Create Dockerfile and values.yaml (see guide above for content)
# - Create run/Dockerfile
# - Create deployment/values.yaml

# Test locally
cd run
docker build . -t scenarioanalysis2:test
docker run -p 3001:3001 scenarioanalysis2:test

# Commit GCaaS configuration
git add src/ run/ deployment/
git commit -m "Add GCaaS deployment configuration"

# Transfer to work PC (choose one method):
# - Push to personal GitHub
# - Create tar.gz archive
# - Create git bundle
```

**On Work PC:**
```bash
# Get repository (via git clone, extract tar.gz, or git bundle)
cd scenarioanalysis2

# Verify structure
ls -la src/  # Should show symlinks

# If symlinks broke, recreate them:
# cd src && ln -s ../engine engine (etc.) && cd ..

# Push to PwC GitHub
git remote add origin https://github.com/pwc/<your-repo>.git
git push -u origin main

# Configure in GCaaS Management Console and watch deployment
```

**Local development remains unchanged:**
```bash
# Continue working as normal:
cd dashboard && npm run dev        # ✅ Still works
cd build && cmake .. && make       # ✅ Still works
```

---

## Questions or Issues?

Contact your PwC DevOps team or check the internal SharePoint documentation for GCaaS support.

---

**End of Guide**
