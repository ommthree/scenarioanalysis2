# Local Development vs Deployment: The Two Worlds

**Critical:** This document explains how to maintain local development code while preparing deployment packages that match the exact structure uploaded to S3.

---

## Overview: Why Two Worlds?

**Local Development** (`/Users/Owen/ScenarioAnalysis2/`)
- Full source code with all files
- Large database files (4.4GB in `data/users/`)
- Build artifacts (`build/`, `node_modules/`)
- Git repository with full history
- Absolute paths: `/Users/Owen/ScenarioAnalysis2/...`

**Deployment Package** (tarball → S3 → GCaaS)
- Minimal source code only
- NO large database files (>100MB)
- NO symbolic links
- NO node_modules (installed during Docker build)
- Container paths: `/app/...`
- Must match EXACT structure from previous successful deployment

**Golden Rule:** NEVER edit deployment files directly. Always edit in local development, then rebuild the deployment package.

---

## CRITICAL: Understanding the Deployment Flow

**There are THREE separate repositories/locations involved:**

1. **Local Development Git** (`git@github.com:ommthree/scenarioanalysis2.git`)
   - Your working repository
   - Push here for version control
   - **NOT used by GCaaS deployment**

2. **S3 Bucket** (`s3://pwcsucks/gcaas-deploy.tar.gz`)
   - Contains deployment tarball
   - **THIS IS WHAT GCAAS USES**
   - Must be manually uploaded after changes
   - **Pushing to GitHub alone does NOT trigger deployment**

3. **GCaaS GitHub** (`pwc-ch-adv-riskreg/daedalus`)
   - Different repository used by GCaaS Kaniko builder
   - Pulls code via git context during build
   - You don't directly push here

### The Deployment Process (What Actually Happens)

```
1. Edit code locally → 2. Push to GitHub (ommthree/scenarioanalysis2) [Version Control]
                    ↓
3. Create tarball with src/ structure [CRITICAL: Must have ./src/Dockerfile]
                    ↓
4. Upload to S3 (gcaas-deploy.tar.gz) [THIS TRIGGERS GCAAS]
                    ↓
5. GCaaS downloads from S3 → 6. Kaniko builds using git context from daedalus repo
                    ↓
7. Docker image created with Node.js 20.x → 8. Deployed to Knative
```

**CRITICAL MISTAKE TO AVOID:**
- ❌ Pushing to GitHub and thinking deployment is complete
- ❌ Forgetting to upload tarball to S3
- ❌ Creating tarball without src/ structure
- ❌ Not verifying Node.js 20.x in Dockerfile

**CORRECT WORKFLOW:**
1. Edit code in `/Users/Owen/ScenarioAnalysis2/`
2. Commit and push to GitHub (`git push origin master`)
3. Create deployment tarball with `src/` structure (see Step 3 below)
4. **Upload tarball to S3** (see Step 5 below)
5. GCaaS will automatically detect new S3 upload and deploy

---

## The Critical Structure (S3 Tarball Upload Standard)

**CRITICAL: GCaaS Kaniko expects `./src/Dockerfile` path in tarball**

**When creating the tarball, your local directory structure needs to be packaged into a `src/` subdirectory:**

```
./gcaas-v16-staging/               ← Staging directory (tarball root)
└── src/                           ← CRITICAL: All code must be in src/
    ├── Dockerfile                 ✅ MUST be at ./src/Dockerfile (NOT root level)
    │                                 MUST have Node.js 20.x (not 18.x)
    ├── CMakeLists.txt             ✅ Source build config
    ├── README.md                  ✅ Deployment readme
    ├── ecosystem.config.cjs       ✅ PM2 configuration
    │
    ├── deployment/                ✅ GCaaS Helm configuration
    │   ├── Chart.yaml
    │   ├── values.yaml            (with volumes, configMap, etc.)
    │   └── templates/
    │
    ├── dashboard/                 ✅ Full dashboard code
    │   ├── package.json
    │   ├── vite.config.ts
    │   ├── src/                   (React/TypeScript source)
    │   ├── server/                (Node.js API server)
    │   │   ├── index.js
    │   │   ├── routes/
    │   │   └── middleware/
    │   └── public/                (Static assets)
    │
    ├── data/                      ✅ Data directory (minimal)
    │   ├── users.db               (Auth DB - 49KB - INCLUDE)
    │   ├── inputs/                (Sample input files)
    │   ├── migrations/            (Database migrations)
    │   └── users/                 (Empty directory - NO large DBs)
    │
    ├── engine/                    ✅ C++ calculation engine
    │   ├── CMakeLists.txt
    │   ├── include/
    │   └── src/
    │
    ├── external/                  ✅ C++ dependencies
    │   ├── catch2/
    │   ├── crow/
    │   ├── eigen/
    │   ├── nlohmann_json/
    │   └── spdlog/
    │
    └── docs/                      ✅ Documentation
        └── docu/                  (User guides)
```

**After creating the tarball:**
```bash
tar -czf gcaas-deploy-v16.tar.gz gcaas-v16-staging/src/
```

**Tarball contents will be:**
```
gcaas-v16-staging/src/Dockerfile      ← GCaaS Kaniko looks for ./src/Dockerfile
gcaas-v16-staging/src/dashboard/
gcaas-v16-staging/src/engine/
...
```

### What to EXCLUDE (Critical)

❌ **NEVER include in deployment tarball:**
- `node_modules/` (installed during Docker build)
- `build/` or `build-*` (compiled during Docker build)
- `.git/` (not needed in container)
- `data/users/*/` (ALL user subdirectories - contains large databases and SQL dumps)
- `*.tar.gz` (don't nest tarballs)
- `.DS_Store` (macOS metadata files)
- `.vite/` (Vite cache directory)
- `sessions.db` (runtime session data)
- `*.db-shm`, `*.db-wal` (SQLite temporary files)
- Symbolic links (not portable to Windows/containers)
- Files >100MB (GitHub limitation)
- Log files (`*.log`)
- Video files (`*.mp4`)
- Images (`*.png`, `*.jpg`, `*.jpeg`) unless required

✅ **DO include:**
- `data/users.db` (authentication database - 49KB)
- All source code
- `deployment/` directory with Helm charts
- Build configurations (CMakeLists.txt, package.json)
- Documentation

---

## Expected Differences: Local vs Deployment

**IMPORTANT:** Local and deployment versions are EXPECTED to differ in specific ways. These differences exist for valid reasons and should be preserved.

### 1. Database Paths (MUST differ)

**Local Development:**
```sql
-- data/users.db paths
db_path = '/Users/Owen/ScenarioAnalysis2/data/users/admin/scenario_analysis.db'
```

**Deployment (GCaaS):**
```sql
-- data/users.db paths
db_path = '/app/data/users/admin/scenario_analysis.db'
```

**Why:** Containers mount code at `/app`, not at local filesystem paths.

### 2. Session Middleware (MAY differ)

**Local Development (dashboard/server/index.js):**
```javascript
import session from 'express-session'

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 }
}))
```

**Previous Deployment (S3):**
```javascript
import session from 'express-session'
import ConnectSqlite3 from 'connect-sqlite3'

const SQLiteStore = ConnectSqlite3(session)

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: config.dataDir }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, ... }
}))
```

**Why:** Local uses in-memory sessions for development simplicity. Deployment versions may use persistent storage for production reliability. **Both are valid** - choose based on deployment needs.

### 3. Built Frontend (MAY differ)

**Local Development:**
- No `dashboard/dist/` directory (excluded from git)
- Vite dev server serves unbundled source (port 5173)

**Deployment:**
- `dashboard/dist/` built during Docker build process
- Dockerfile runs `npm ci && npx vite build` to generate dist/
- Requires Node.js 20+ in Dockerfile (see below)

**Why:** Frontend is built from source during Docker build. **Node.js 20+ is REQUIRED** in Dockerfile because Tailwind CSS v4, Vite 7, and React Router 7 all require Node.js 20+.

### 4. Node Modules (MAY differ)

**Local Development:**
- `dashboard/node_modules/` present (532MB)
- Installed via `npm install`

**Deployment Options:**
- **Option A:** Exclude node_modules, install during Docker build
- **Option B:** Include node_modules for faster deployment (as in v13)

**Why:** Both approaches are valid. Excluding reduces tarball size but increases build time.

---

## Path Translation: Local → Container

**Critical for authentication and database access:**

| Environment | Path Pattern | Example |
|-------------|-------------|---------|
| **Local Dev** | `/Users/Owen/ScenarioAnalysis2/...` | `/Users/Owen/ScenarioAnalysis2/data/users.db` |
| **Container** | `/app/...` | `/app/data/users.db` |

### Where Paths Are Used

1. **`data/users.db`** - User database paths
   - Local: `db_path = '/Users/Owen/ScenarioAnalysis2/data/users/admin/scenario_analysis.db'`
   - Container: `db_path = '/app/data/users/admin/scenario_analysis.db'`

2. **`dashboard/server/config.js`** - Server configuration
   - Uses environment variables with defaults
   - Automatically adapts to container paths

3. **Environment Variables** (set in deployment/templates/configmap.yaml)
   ```yaml
   - key: PROJECT_ROOT
     value: "/app"
   - key: DATA_DIR
     value: "/app/data"
   ```

### Path Translation Script

For user database paths, use this SQL to fix paths before deployment:

```sql
-- Fix container paths in users.db
UPDATE users
SET db_path = REPLACE(db_path, '/Users/Owen/ScenarioAnalysis2', '/app')
WHERE db_path LIKE '/Users/Owen/%';
```

---

## Version Management Strategy

### Version Numbering

Format: `v{major}-{descriptor}`

Examples:
- `v10-final` - Last known working deployment
- `v13-session-fix` - Session authentication fixes
- `v14` - Referenced in docs but doesn't exist yet
- `v15-local` - Current local development (not deployed)

### Version Sources of Truth

1. **Tarball Filename**: `gcaas-deploy-v13-session-fix.tar.gz`
2. **S3 Location**: `s3://pwcsucks/gcaas-deploy.tar.gz` (always latest)
3. **S3 Versioned**: `s3://pwcsucks/gcaas-deploy-v13.tar.gz` (specific version)
4. **UI Label**: Dashboard login page shows current version

### Latest Versions (as of Feb 25, 2026)

- **Latest Tarball**: v13 (session fix)
- **Latest Docs Reference**: v14 (doesn't exist yet)
- **Current Local**: v15-local (login authentication restored)
- **Last Known Working**: v10

---

## Workflow: Local Development → Deployment

### Step 1: Make Changes Locally

**ALWAYS edit in local development directories:**

```bash
cd /Users/Owen/ScenarioAnalysis2

# Edit source files
vim dashboard/server/index.js
vim dashboard/src/pages/auth/Login.tsx
vim engine/src/unified/unified_engine.cpp

# Test locally
cd dashboard && npm run dev        # Frontend
node server/index.js               # Backend
cd ../build && make -j8            # C++ engine
```

### Step 2: Test Thoroughly

```bash
# Start both servers
cd /Users/Owen/ScenarioAnalysis2/dashboard
node server/index.js &             # Background
npm run dev                        # Foreground

# Open http://localhost:5173
# Test login, calculations, all features
```

### Step 2.5: Verify Node.js Version in Dockerfiles (CRITICAL)

**Why this is critical:** Tailwind CSS v4, Vite 7, and React Router 7 require Node.js 20+. The Dockerfiles MUST use Node.js 20.x, not 18.x, otherwise the Docker build will fail with PostCSS native binding errors.

```bash
# Check BOTH Dockerfiles have Node.js 20.x:
grep "setup_20" Dockerfile run/Dockerfile

# You should see (in BOTH files):
# RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
```

**If you see `setup_18.x` instead, the build WILL FAIL.** Update both Dockerfiles to use Node.js 20.x.

**Important:** The Dockerfile will still run `npm ci && npx vite build` during Docker build, but having the pre-built dist/ ensures the container can fall back to it if the build step has issues.

### Step 3: Prepare Deployment Package

**CRITICAL: Create tarball with src/ structure (GCaaS Kaniko expects ./src/Dockerfile)**

```bash
cd /Users/Owen/ScenarioAnalysis2

# 1. Create staging directory with src/ structure
mkdir -p /tmp/gcaas-v16-staging/src

# 2. Copy files to staging directory using rsync (preserves structure, excludes unwanted files)
rsync -av \
  --exclude='node_modules' \
  --exclude='build' \
  --exclude='build-windows' \
  --exclude='.git' \
  --exclude='*.tar.gz' \
  --exclude='*.log' \
  --exclude='*.mp4' \
  --exclude='gcaas-deploy' \
  --exclude='sessions.db' \
  --exclude='data/users/*/scenario_analysis.db' \
  --exclude='.vite' \
  CMakeLists.txt \
  Dockerfile \
  dashboard/ \
  data/users.db \
  data/inputs/ \
  data/migrations/ \
  engine/ \
  external/ \
  deployment/ \
  docs/ \
  ecosystem.config.cjs \
  README.md \
  /tmp/gcaas-v16-staging/src/

# 3. Verify Dockerfile has Node.js 20.x (CRITICAL)
grep "setup_20" /tmp/gcaas-v16-staging/src/Dockerfile

# 4. Create tarball from staging directory
cd /tmp
tar -czf gcaas-deploy-v16.tar.gz gcaas-v16-staging/src/

# 5. Verify size (should be ~200MB)
ls -lh gcaas-deploy-v16.tar.gz

# 6. Verify tarball structure (must have src/Dockerfile path)
tar -tzf gcaas-deploy-v16.tar.gz | grep "^[^/]*/src/Dockerfile$"
tar -tzf gcaas-deploy-v16.tar.gz | head -20
```

### Step 4: Fix Database Paths for Container

**Before uploading, ensure user database paths use `/app` prefix:**

```bash
# Backup first
cp data/users.db data/users.db.backup

# Fix paths
sqlite3 data/users.db "
UPDATE users
SET db_path = REPLACE(db_path, '/Users/Owen/ScenarioAnalysis2', '/app')
WHERE db_path LIKE '/Users/Owen/%';
SELECT username, db_path FROM users;
"

# Recreate tarball with fixed database
tar -czf gcaas-deploy-v15.tar.gz [... same as above ...]

# Restore local paths
mv data/users.db.backup data/users.db
```

### Step 5: Upload to S3 (THIS TRIGGERS DEPLOYMENT)

**CRITICAL: This step is REQUIRED for deployment. Pushing to GitHub alone does NOT deploy.**

```bash
# Upload as latest (THIS IS WHAT GCAAS USES)
aws s3 cp /tmp/gcaas-deploy-v16.tar.gz s3://pwcsucks/gcaas-deploy.tar.gz

# Also upload versioned copy (for rollback)
aws s3 cp /tmp/gcaas-deploy-v16.tar.gz s3://pwcsucks/gcaas-deploy-v16.tar.gz

# Verify upload (check timestamp and size)
aws s3 ls s3://pwcsucks/ | grep gcaas-deploy
```

**Expected output:**
```
2026-02-26 09:01:52  211940710 gcaas-deploy-v16.tar.gz
2026-02-26 09:00:55  211940710 gcaas-deploy.tar.gz
```

**What happens next:**
1. GCaaS detects new `gcaas-deploy.tar.gz` in S3
2. GCaaS downloads tarball and extracts it
3. Kaniko builds Docker image using `./src/Dockerfile` with Node.js 20.x
4. Image is pushed to registry and deployed to Knative
5. Application becomes available at GCaaS URL

### Step 6: Update Documentation

**Update version references in these files:**

1. `V15_DEPLOYMENT_SUMMARY.md` - Create new deployment summary
2. `V15_QUICK_REFERENCE.md` - Update quick reference
3. `dashboard/src/pages/auth/Login.tsx` - Update version label
4. `README.md` - Update status line if needed

### Step 7: Deploy via GCaaS

GCaaS will automatically detect the new package and deploy it. No manual steps needed on GCaaS side if using auto-deployment.

---

## Common Mistakes to Avoid

### ❌ DON'T

1. **Edit files in old tarballs** - Always edit in local dev
2. **Include node_modules** - Bloats package, installed during build
3. **Use Node.js 18.x in Dockerfiles** - Causes PostCSS native binding errors; MUST use Node.js 20+
4. **Include symbolic links** - Break on Windows and in containers
5. **Mix local and container paths** - Use environment-specific paths
6. **Upload without testing locally** - Always test first
7. **Forget to update version label** - Users need to know what version they're using
8. **Include large database files** - Exceeds GitHub 100MB limit
9. **Create tarball from wrong directory** - Must be from project root

### ✅ DO

1. **Pre-build frontend before creating tarball** - Include dist/ to avoid native binding errors
2. **Test locally before deploying** - Catch issues early
3. **Match exact S3 structure** - Consistency is critical
3. **Exclude large files** - Keep under 1GB
4. **Dereference symlinks** - Use `--dereference` flag
5. **Version everything** - Track what's deployed where
6. **Update documentation** - Explain what changed
7. **Backup before path changes** - Easy rollback
8. **Verify tarball contents** - Check structure before upload

---

## Troubleshooting

### "Login fails in deployment but works locally"

**Cause:** Database paths use local paths (`/Users/Owen/...`) instead of container paths (`/app/...`)

**Fix:**
```bash
# In deployment tarball's data/users.db
sqlite3 data/users.db "
UPDATE users SET db_path = REPLACE(db_path, '/Users/Owen/ScenarioAnalysis2', '/app');
"
```

### "Docker build fails: PostCSS cannot find native binding"

**Full Error:**
```
[vite:css] Failed to load PostCSS config (searchPath: /app/dashboard):
[Error] Loading PostCSS Plugin failed: Cannot find native binding.
npm has a bug related to optional dependencies (https://github.com/npm/cli/issues/4828)

You are using Node.js 18.20.8. Vite requires Node.js version 20.19+ or 22.12+.
npm warn EBADENGINE   package: '@tailwindcss/oxide@4.2.1',
npm warn EBADENGINE   required: { node: '>= 20' },
npm warn EBADENGINE   current: { node: 'v18.20.8', npm: '10.8.2' }
```

**Root Cause:** The Dockerfile is using Node.js 18.x, but Tailwind CSS v4, Vite 7, and React Router 7 require Node.js 20+.

**Fix:** Upgrade Node.js version in **BOTH** Dockerfiles (`Dockerfile` and `run/Dockerfile`):
```dockerfile
# Change from:
# Install Node.js 18.x
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# To:
# Install Node.js 20.x (required for Tailwind CSS v4, Vite 7, React Router 7)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs
```

Update **BOTH occurrences** (builder stage AND production stage) in **BOTH Dockerfiles**.

**Prevention:** Keep Node.js version in Dockerfiles aligned with package.json requirements. When you see `npm warn EBADENGINE`, upgrade Node.js version in Dockerfiles.

### "GCaaS build fails: Cannot find module"

**Cause:** Missing dependency or wrong directory structure

**Fix:**
- Verify `deployment/` directory exists in tarball
- Check `CMakeLists.txt` is at root level
- Ensure `dashboard/package.json` exists

### "Pod crashes: ENOENT /app/data/users.db"

**Cause:** Authentication database not included in tarball

**Fix:**
- Verify `data/users.db` is included
- Check file size (should be ~49KB)
- Ensure not excluded by tar command

### "Tarball too large (>1GB)"

**Cause:** Included large user databases or node_modules

**Fix:**
- Exclude `data/users/*/scenario_analysis.db` (1.2GB each)
- Exclude `node_modules/` (1.5GB)
- Exclude `build/` artifacts

---

## File Checklist for Deployment

Before uploading tarball, verify:

### Required Files (MUST be present)

- [ ] `CMakeLists.txt` (root level)
- [ ] `Dockerfile` (root level)
- [ ] `deployment/Chart.yaml`
- [ ] `deployment/values.yaml`
- [ ] `deployment/templates/ksvc.yaml`
- [ ] `dashboard/package.json`
- [ ] `dashboard/server/index.js`
- [ ] `dashboard/src/` (all source files)
- [ ] `dashboard/dist/` (pre-built frontend, ~15MB) **CRITICAL for v15+**
- [ ] `data/users.db` (authentication only)
- [ ] `engine/src/` (C++ source)

### Excluded Files (MUST NOT be present)

- [ ] No `node_modules/`
- [ ] No `build/` or `bin/`
- [ ] No `.git/`
- [ ] No `data/users/*/scenario_analysis.db` (large DBs)
- [ ] No `*.tar.gz` (nested tarballs)
- [ ] No symbolic links
- [ ] No files >100MB

### Path Verification

- [ ] All paths in `data/users.db` use `/app` prefix
- [ ] Config files use environment variables
- [ ] No hardcoded `/Users/Owen/...` paths in source

---

## Quick Reference Commands

### Create Deployment Tarball
```bash
cd /Users/Owen/ScenarioAnalysis2
tar -czf gcaas-deploy-v15.tar.gz \
  --exclude='node_modules' \
  --exclude='build*' \
  --exclude='.git' \
  --exclude='data/users/*/scenario_analysis.db' \
  --exclude='*.tar.gz' \
  --exclude='*.log' \
  --exclude='*.mp4' \
  --exclude='gcaas-deploy' \
  --exclude='legacydeployment' \
  --dereference \
  CMakeLists.txt Dockerfile ecosystem.config.cjs README.md \
  deployment/ dashboard/ engine/ external/ docs/ \
  data/users.db data/inputs/ data/migrations/
```

### Verify Tarball
```bash
# Check size
ls -lh gcaas-deploy-v15.tar.gz

# Check structure
tar -tzf gcaas-deploy-v15.tar.gz | head -50

# Check for large files
tar -tzf gcaas-deploy-v15.tar.gz | xargs -I {} sh -c 'tar -xzf gcaas-deploy-v15.tar.gz {} -O 2>/dev/null | wc -c | xargs echo {}' | sort -k2 -hr | head -20

# Check for symlinks (should return nothing)
tar -tzf gcaas-deploy-v15.tar.gz | xargs -I {} sh -c 'test -L {} && echo {}'
```

### Upload to S3
```bash
# Latest
aws s3 cp gcaas-deploy-v15.tar.gz s3://pwcsucks/gcaas-deploy.tar.gz

# Versioned
aws s3 cp gcaas-deploy-v15.tar.gz s3://pwcsucks/gcaas-deploy-v15.tar.gz
```

### Fix Database Paths
```bash
sqlite3 data/users.db "UPDATE users SET db_path = REPLACE(db_path, '/Users/Owen/ScenarioAnalysis2', '/app');"
```

---

## Summary

**Two Worlds:**
1. **Local Dev** - Full source, large files, local paths
2. **Deployment** - Minimal source, no large files, container paths

**Golden Rules:**
1. ALWAYS edit in local development
2. Deployment structure MUST match last S3 upload
3. EXCLUDE large files and symbolic links
4. Code MUST be aligned with production
5. Test locally BEFORE creating deployment package

**The Workflow:**
1. Edit locally → Test locally
2. Create tarball (matching S3 structure)
3. Fix paths for container
4. Upload to S3
5. Update documentation
6. Deploy via GCaaS

---

**Last Updated:** 2026-02-25
**Current Local Version:** v15-local
**Last Deployed Version:** v13
**Next Deployment:** v15
