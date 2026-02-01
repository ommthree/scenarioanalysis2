# Legacy Deployment Files

**Date Archived:** 2026-02-01
**Reason:** Transition to GCaaS (Global Container as a Service) deployment

---

## Overview

This folder contains legacy deployment files and scripts that were used for various deployment methods before the application was containerized for GCaaS deployment. These files are no longer needed for the current deployment process but are preserved for historical reference.

---

## What Was Moved and Why

### Windows Portable Deployment
**Files:**
- `Daedalus-Portable/` - Portable Windows package directory
- `Daedalus-Portable.zip` - Packaged portable deployment (418 MB)
- `WINDOWS_DEPLOYMENT.md` - Windows deployment guide
- `compile-for-windows.sh` - Cross-compilation script for Windows
- `create-portable-package.sh` - Script to create portable package
- `windows-compatibility-test.bat` - Windows compatibility test

**Purpose:** These files were used to create a standalone Windows deployment that could run without Docker or cloud infrastructure. This method was designed for local execution on Windows machines with SQLite database and pre-built binaries.

**Why Archived:** GCaaS uses Linux containers (Ubuntu 22.04), making Windows-specific deployment unnecessary. The Docker container now handles all platform concerns.

---

### Manual Server Deployment
**Files:**
- `deploy.sh` - Manual deployment script
- `prepare-and-deploy.sh` - Preparation and deployment automation
- `prepare-local.sh` - Local environment preparation
- `package/` - Manual deployment package directory

**Purpose:** Scripts for manually deploying the application to a server, including file copying, dependency installation, and service configuration.

**Why Archived:** GCaaS automatically handles deployment via CI/CD pipeline. Simply pushing to GitHub triggers automatic build and deployment.

---

### Nginx Configuration
**Files:**
- `nginx-config.conf` - Nginx reverse proxy configuration
- `nginx-scenario-app.conf` - Application-specific nginx config
- `add-nginx-buffering-off.sh` - Script to disable nginx buffering
- `fix-nginx-buffering.sh` - Script to fix buffering issues

**Purpose:** Custom nginx configurations for proxying requests to the Node.js backend, handling timeouts for long-running calculations, and managing static file serving.

**Why Archived:** GCaaS provides ingress configuration through `values.yaml`. The platform handles routing, SSL termination, and load balancing automatically.

---

### Database Path Management
**Files:**
- `update-db-paths.js` - Script to update database file paths

**Purpose:** Utility to update database connection paths in the codebase when deploying to different environments.

**Why Archived:** Docker containers use consistent paths defined in the Dockerfile (`/app/data`). Environment variables in `values.yaml` handle environment-specific configuration.

---

### Documentation
**Files:**
- `DEPLOYMENT_SUMMARY.md` - Summary of manual deployment process
- `README.md` - Deployment folder readme

**Purpose:** Documentation for manual deployment workflows and troubleshooting.

**Why Archived:** New deployment documentation is in `/docs/docu/GCAAS_DEPLOYMENT_GUIDE.md`.

---

## Current Deployment Method (GCaaS)

The application now uses **Global Container as a Service (GCaaS)** for deployment:

1. **Source code** is committed to PwC GitHub repository
2. **GCaaS platform** detects changes and triggers build
3. **Docker image** is built using `/run/Dockerfile`
4. **Deployment configuration** is read from `/deployment/values.yaml`
5. **Container** is deployed to Kubernetes cluster with automatic scaling, health checks, and ingress

**Required files for GCaaS deployment:**
- `/run/Dockerfile` - Multi-stage Docker build definition
- `/deployment/values.yaml` - GCaaS deployment configuration
- `/src/` - Symlinks to source code (GCaaS folder structure requirement)

**Documentation:**
- `/docs/docu/GCAAS_DEPLOYMENT_GUIDE.md` - Complete GCaaS deployment guide

---

## If You Need to Revert to Legacy Deployment

If for any reason you need to use these legacy deployment methods:

1. **Copy files back** from this `legacy/` folder to `/deployment/`
2. **Review documentation** in the legacy files to understand the process
3. **Update configurations** as environment may have changed
4. **Test thoroughly** before deploying

**Note:** Legacy methods may require significant updates as dependencies, platforms, and infrastructure have likely changed since archival.

---

## Files Summary

| Category | File | Size | Purpose |
|----------|------|------|---------|
| Windows | `Daedalus-Portable.zip` | 418 MB | Packaged Windows deployment |
| Windows | `compile-for-windows.sh` | 1.8 KB | Cross-compilation script |
| Windows | `create-portable-package.sh` | 9.2 KB | Package creation script |
| Windows | `windows-compatibility-test.bat` | 2.9 KB | Compatibility test |
| Windows | `WINDOWS_DEPLOYMENT.md` | 5.8 KB | Documentation |
| Nginx | `nginx-config.conf` | 816 B | Reverse proxy config |
| Nginx | `nginx-scenario-app.conf` | 1.3 KB | App-specific config |
| Nginx | `add-nginx-buffering-off.sh` | 840 B | Buffering fix script |
| Nginx | `fix-nginx-buffering.sh` | 1.4 KB | Buffering fix script |
| Deployment | `deploy.sh` | 921 B | Manual deploy script |
| Deployment | `prepare-and-deploy.sh` | 3.7 KB | Deploy automation |
| Deployment | `prepare-local.sh` | 811 B | Local prep script |
| Deployment | `package/` | - | Deployment package dir |
| Utility | `update-db-paths.js` | 1.6 KB | DB path updater |
| Docs | `DEPLOYMENT_SUMMARY.md` | 9.3 KB | Deployment summary |
| Docs | `README.md` | 4.4 KB | Deployment readme |

---

**Total archived:** ~418 MB (mostly the Daedalus-Portable.zip file)

---

## Questions?

For questions about current deployment, see:
- GCaaS Deployment Guide: `/docs/docu/GCAAS_DEPLOYMENT_GUIDE.md`

For questions about legacy deployments:
- Review the documentation files in this folder
- Contact the DevOps team if restoration is needed
