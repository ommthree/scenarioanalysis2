# Deployment Guide

This directory contains scripts and configuration for deploying the Daedalus application to AWS Lightsail.

## Architecture

- **Frontend**: React SPA built with Vite, served by nginx from `/var/www/scenario-app`
- **Backend**: Node.js Express API on port 3001, managed by PM2
- **Proxy**: nginx proxies `/api/*` requests to backend (same-origin setup)
- **Database**: SQLite master DB at `/home/ubuntu/app/data/users.db`, user DBs in `/home/ubuntu/app/data/users/{username}/`

## Files

- `prepare-and-deploy.sh` - Main deployment script (builds, packages, deploys)
- `nginx-config.conf` - nginx configuration for production
- `update-db-paths.js` - Updates database paths for production environment
- `package/` - Generated deployment package (gitignored)

## Prerequisites

1. SSH key at `env/LightsailDefaultKey-eu-central-1.pem`
2. Node.js and npm installed locally
3. SSH access to server at `ubuntu@18.185.58.149`

## Configuration

### Environment Variables

**Frontend** (`dashboard/.env.production`):
```bash
# Production environment variables
VITE_API_BASE_URL=
```
Empty string = use relative URLs (same-origin via nginx)

**Backend** (`dashboard/server/config.js`):
- `NODE_ENV=production` - Set by PM2
- `corsOrigin: false` - Disabled in production (same-origin)
- `secure: false` - Session cookies over HTTP

### API URL Configuration

The frontend uses environment-aware API URLs:

```typescript
// dashboard/src/config.ts
apiBaseUrl: import.meta.env.VITE_API_BASE_URL !== undefined
  ? import.meta.env.VITE_API_BASE_URL
  : (import.meta.env.PROD ? '' : 'http://localhost:3001')
```

- **Production**: Empty string → relative URLs → `/api/*` → nginx proxy → backend
- **Development**: `http://localhost:3001` → direct backend connection

All frontend code uses `apiUrl('/api/endpoint')` helper instead of hardcoded URLs.

## Deployment Process

```bash
./deployment/prepare-and-deploy.sh
```

This script:
1. Creates `.env.production` if missing
2. Builds frontend with Vite
3. Creates deployment package with:
   - Built frontend (`dashboard/dist`)
   - Backend server code (`dashboard/server`)
   - C++ engine binary (`build/`)
   - Data files and databases
   - Environment files
4. Updates database paths for production
5. Syncs to server via rsync
6. Deploys frontend to `/var/www/scenario-app`
7. Sets file permissions (644 for files, 755 for directories)
8. Updates nginx configuration
9. Restarts PM2 backend service

## Server Setup

### nginx Configuration

The nginx config (`/etc/nginx/sites-available/default`) serves static files from `/var/www/scenario-app` and proxies API requests:

```nginx
location /api/ {
    proxy_pass http://localhost:3001/api/;
    # Headers for proper proxying
}

location / {
    try_files $uri $uri/ /index.html;  # SPA routing
}
```

### PM2 Process

Backend runs as `scenario-api` process:
```bash
pm2 restart scenario-api
pm2 logs scenario-api
pm2 status
```

### Database Schema

Master database (`data/users.db`) has users table:
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  db_path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  total_calculations INTEGER DEFAULT 0,
  last_calculation DATETIME
);
```

## Credentials

**Default Admin User**:
- Username: `OwenAdmin`
- Password: `16SaPe66ebf**!`
- Role: `admin`

## Troubleshooting

### 401 Unauthorized Errors
- Check users table exists: Backend logs will show `SqliteError: no such table: users`
- Verify users.db has proper schema
- Confirm session cookies are being sent (check browser dev tools)

### CORS Errors
- Should not occur with same-origin setup
- Check `corsOrigin: false` in production backend config
- Verify nginx is proxying `/api/*` correctly

### Static Files 403 Forbidden
- Check file permissions: `sudo chmod 644 /var/www/scenario-app/*.png`
- Check directory permissions: `sudo chmod 755 /var/www/scenario-app`

### Session Not Persisting
- Verify `secure: false` in session config (needed for HTTP)
- Check session store directory exists and is writable

## Production URL

http://18.185.58.149

## Development Mode

Local development uses different configuration:
- Frontend: `npm run dev` on port 5173
- Backend: `node index.js` on port 3001
- Direct connection (no nginx proxy)
- CORS enabled for localhost:5173
