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

## The Critical Structure (S3 Upload Standard)

**VERIFIED FROM v13 - THIS IS THE EXACT STRUCTURE REQUIRED:**

```
./                                 ← Root level (has config files)
├── CMakeLists.txt                ✅ Root build config
├── README.md                     ✅ Deployment readme
├── ecosystem.config.cjs          ✅ PM2 configuration (root level)
├── values.yaml                   ✅ GCaaS values (root level)
│
├── deployment/                   ✅ CRITICAL - GCaaS Helm config (root level)
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── ksvc.yaml
│       ├── configmap.yaml
│       └── secrets.yaml
│
├── docs/                         ✅ Documentation
│   └── docu/                     ✅ User guides
│
├── run/                          ✅ Runtime scripts
│
└── src/                          ✅ ALL SOURCE CODE GOES HERE
    ├── CMakeLists.txt            ✅ Source build config
    ├── Dockerfile                ✅ Container build (in src/)
    ├── ecosystem.config.cjs      ✅ PM2 config (duplicate in src/)
    │
    ├── dashboard/                ✅ Full dashboard code
    │   ├── package.json
    │   ├── vite.config.ts
    │   ├── src/                  ✅ React/TypeScript source
    │   ├── server/               ✅ Node.js API server
    │   └── public/               ✅ Static assets
    │
    ├── data/                     ✅ Data directory (minimal)
    │   ├── users.db              ✅ Auth DB (49KB - INCLUDE)
    │   ├── inputs/               ✅ Sample input files
    │   ├── migrations/           ✅ Database migrations
    │   └── users/                ✅ Empty directory (NO large DBs)
    │
    ├── deployment/               ✅ Helm templates (duplicate in src/)
    │   └── templates/
    │
    ├── engine/                   ✅ C++ calculation engine
    │   ├── CMakeLists.txt
    │   ├── include/
    │   └── src/
    │
    └── external/                 ✅ C++ dependencies
        ├── catch2/
        ├── crow/
        ├── eigen/
        ├── nlohmann_json/
        └── spdlog/
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

### 3. Built Frontend (MUST differ as of v15)

**Local Development:**
- No `dashboard/dist/` directory (excluded from git)
- Vite dev server serves unbundled source (port 5173)

**Deployment (REQUIRED):**
- MUST include `dashboard/dist/` with pre-built frontend (~15MB)
- Pre-built locally before creating tarball
- Dockerfile still runs `npm ci && npx vite build`, but dist/ acts as fallback

**Why:** **CRITICAL for v15+** - Tailwind CSS v4 uses native Rust bindings that are platform-specific. Package-lock.json from Mac (Apple Silicon) fails when Docker builds on Linux. Pre-building locally and including dist/ avoids PostCSS native binding errors: `Cannot find native binding. npm has a bug related to optional dependencies`

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

### Step 2.5: Pre-Build Frontend (CRITICAL)

**Why this is critical:** Tailwind CSS v4 uses native Rust bindings that are platform-specific. Package-lock.json generated on Mac (Apple Silicon) contains optional dependencies that fail when Docker tries to build on Linux. Pre-building the frontend locally and including `dist/` in the tarball avoids PostCSS native binding errors during Docker build.

```bash
# Build frontend locally to generate dist/
cd /Users/Owen/ScenarioAnalysis2/dashboard
npx vite build

# Verify dist was created (should be ~15MB)
du -sh dist/
ls -la dist/

# You should see:
# - dist/index.html
# - dist/assets/index-*.js
# - dist/assets/index-*.css
# - Static assets (logos, PDFs, etc.)
```

**Important:** The Dockerfile will still run `npm ci && npx vite build` during Docker build, but having the pre-built dist/ ensures the container can fall back to it if the build step has issues.

### Step 3: Prepare Deployment Package

**Create a clean deployment tarball matching S3 structure:**

```bash
cd /Users/Owen/ScenarioAnalysis2

# Create tarball with exact structure
tar -czf gcaas-deploy-v15.tar.gz \
  --exclude='node_modules' \
  --exclude='build' \
  --exclude='build-windows' \
  --exclude='.git' \
  --exclude='data/users/*/scenario_analysis.db' \
  --exclude='*.tar.gz' \
  --exclude='*.log' \
  --exclude='*.mp4' \
  --exclude='gcaas-deploy' \
  --exclude='legacydeployment' \
  --dereference \
  CMakeLists.txt \
  Dockerfile \
  ecosystem.config.cjs \
  README.md \
  deployment/ \
  dashboard/ \
  data/users.db \
  data/inputs/ \
  data/migrations/ \
  engine/ \
  external/ \
  docs/

# Verify size (should be ~200-900MB)
ls -lh gcaas-deploy-v15.tar.gz

# Verify contents (check for symbolic links, large files)
tar -tzf gcaas-deploy-v15.tar.gz | head -50
tar -tzf gcaas-deploy-v15.tar.gz | grep -E '\.(db|tar\.gz)$'
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

### Step 5: Upload to S3

```bash
# Upload as latest
aws s3 cp gcaas-deploy-v15.tar.gz s3://pwcsucks/gcaas-deploy.tar.gz

# Also upload versioned copy
aws s3 cp gcaas-deploy-v15.tar.gz s3://pwcsucks/gcaas-deploy-v15.tar.gz

# Verify upload
aws s3 ls s3://pwcsucks/ | grep gcaas-deploy
```

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
3. **Skip pre-building frontend** - Causes PostCSS native binding errors in Docker
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
```

**Cause:** Tailwind CSS v4 uses native Rust bindings. Package-lock.json from Mac (Apple Silicon) contains platform-specific optional dependencies that fail when Docker builds on Linux.

**Fix:**
```bash
# Pre-build frontend locally before creating tarball
cd /Users/Owen/ScenarioAnalysis2/dashboard
npx vite build

# Verify dist/ was created
ls -la dist/

# Recreate tarball WITH dist/ included
cd /Users/Owen/ScenarioAnalysis2
tar -czf gcaas-deploy-v15.tar.gz ... dashboard/ ...
```

**Prevention:** ALWAYS include pre-built `dashboard/dist/` in deployment tarballs (as of v15+).

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
