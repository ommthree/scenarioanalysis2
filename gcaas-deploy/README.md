# ScenarioAnalysis2 - GCaaS Deployment Package

**Created:** 2026-02-10
**Status:** ✅ Ready for PwC GCaaS Platform

---

## What's Inside

This directory contains **only** the files needed to deploy ScenarioAnalysis2 to PwC's GCaaS platform. No large database files, no build artifacts, no node_modules.

### Structure

```
gcaas-deploy/
├── README.md                    ← You are here
├── CMakeLists.txt              ← Root CMake config
├── ecosystem.config.cjs         ← PM2 config (if needed)
│
├── src/                        ← Application source code
│   ├── engine/                 ← C++ calculation engine
│   │   ├── CMakeLists.txt
│   │   ├── include/            Public headers
│   │   ├── src/                Implementation files
│   │   └── tests/              Unit tests
│   │
│   ├── dashboard/              ← React/TypeScript frontend + Node.js API
│   │   ├── package.json
│   │   ├── server/             Node.js API server
│   │   ├── src/                React components
│   │   └── public/             Static assets
│   │
│   ├── external/               ← Third-party C++ libraries
│   │   ├── nlohmann_json/
│   │   ├── crow/
│   │   ├── eigen/
│   │   ├── spdlog/
│   │   ├── catch2/
│   │   └── sqlite3-windows/
│   │
│   └── data/                   ← Data files (minimal)
│       ├── README.md           Note about runtime DB creation
│       ├── migrations/         Database migration scripts
│       └── inputs/             CSV input files
│
├── run/
│   └── Dockerfile              ← Docker build configuration
│
├── deployment/
│   └── values.yaml             ← GCaaS deployment config
│
└── docs/
    └── GCAAS_DEPLOYMENT_GUIDE.md  ← Full deployment instructions
```

---

## Quick Deploy to GCaaS

### 1. Push to PwC GitHub Repository

```bash
cd /path/to/this/directory
git init  # (if not already a git repo)
git add .
git commit -m "Add GCaaS deployment package"
git remote add origin https://github.com/pwc/<your-repo-name>.git
git push -u origin main
```

### 2. Configure GCaaS

1. Open GCaaS Management Console
2. Add your GitHub repository
3. GCaaS will auto-detect:
   - Build context: `./src`
   - Dockerfile: `run/Dockerfile`
   - Config: `deployment/values.yaml`

### 3. Deploy

1. Trigger the build pipeline
2. Monitor build logs (~10-15 minutes first time)
3. Access deployed app via ingress URL

---

## What's NOT Included (By Design)

❌ **Large database files** (users' scenario_analysis.db files ~1.2GB each)
   - These will be created at runtime or uploaded by users

❌ **node_modules/** (dashboard dependencies)
   - Will be installed during Docker build via `npm install`

❌ **Build artifacts** (build/, build-windows/)
   - Will be generated during Docker build

❌ **Legacy deployment files**
   - Old deployment methods not needed for GCaaS

---

## Technical Details

**Application Stack:**
- C++20 calculation engine (CMake + GCC/Clang)
- Node.js 18.x API server (Express-like, port 3001)
- React 19 + TypeScript frontend (Vite)
- SQLite database (created at runtime)

**Docker Build:**
- Multi-stage build (builder + production)
- Ubuntu 22.04 base image
- Installs: CMake, GCC, Node.js, SQLite
- Build time: ~10-15 minutes (first time), ~2-3 minutes (cached)

**GCaaS Resources:**
- CPU: 500m-2000m
- RAM: 1-4GB
- Storage: 10GB persistent volume (for user databases)

---

## Environment Variables

Required in GCaaS deployment:

```yaml
# API Configuration
VITE_API_BASE_URL: "http://your-app.gcaas.pwc.com"

# Database paths (optional, has defaults)
VITE_DEFAULT_DB_PATH: "/data/finmodel.db"

# Node environment
NODE_ENV: "production"
```

---

## Local Testing (Optional)

You can test the Docker build locally before deploying:

```bash
# Build the Docker image
docker build -f run/Dockerfile -t scenario-analysis:test ./src

# Run the container
docker run -p 3001:3001 -p 5173:5173 scenario-analysis:test

# Access at http://localhost:5173
```

---

## Need Help?

See the complete deployment guide:
```bash
cat docs/GCAAS_DEPLOYMENT_GUIDE.md
```

Or refer to the main project documentation in the parent directory.

---

## Deployment Checklist

- [ ] Review `run/Dockerfile` - ensure build steps are correct
- [ ] Review `deployment/values.yaml` - adjust resources if needed
- [ ] Push code to PwC GitHub repository
- [ ] Configure GCaaS to point to your repository
- [ ] Trigger initial build and monitor logs
- [ ] Test deployed application via ingress URL
- [ ] Configure persistent storage for user databases
- [ ] Set up SSL/TLS certificates (if not auto-provisioned)
- [ ] Configure authentication (if required)

---

**Ready to deploy!** 🚀
