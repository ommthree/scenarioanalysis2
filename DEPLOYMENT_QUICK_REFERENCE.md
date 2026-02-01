# Deployment Quick Reference

## Server Information
- **IP**: 18.185.58.149
- **SSH Key**: `env/LightsailDefaultKey-eu-central-1.pem`
- **User**: ubuntu
- **App Directory**: `/home/ubuntu/app`
- **Frontend Directory**: `/var/www/scenario-app`

## Credentials
- **Username**: OwenAdmin
- **Password**: 16SaPe66ebf**!

## Quick Deploy (Recommended)

From project root:
```bash
./deployment/prepare-and-deploy.sh
```

This automated script:
1. Builds frontend with production environment
2. Creates deployment package
3. Updates database paths for production
4. Syncs files to server
5. Deploys frontend to nginx
6. Restarts backend service

## Manual Deploy Steps

### 1. Build Frontend
```bash
cd dashboard
npx vite build
cd ..
```

### 2. Deploy Frontend Only
```bash
rsync -avz --delete dashboard/dist/ \
  -e "ssh -i env/LightsailDefaultKey-eu-central-1.pem" \
  ubuntu@18.185.58.149:/tmp/dashboard_dist/

ssh -i env/LightsailDefaultKey-eu-central-1.pem ubuntu@18.185.58.149 \
  "sudo rsync -a --delete /tmp/dashboard_dist/ /var/www/scenario-app/ && \
   rm -rf /tmp/dashboard_dist"
```

### 3. Restart Backend (if needed)
```bash
ssh -i env/LightsailDefaultKey-eu-central-1.pem ubuntu@18.185.58.149 \
  "cd /home/ubuntu/app/dashboard/server && pm2 restart scenario-api"
```

## Verification

### Check Services
```bash
# SSH into server
ssh -i env/LightsailDefaultKey-eu-central-1.pem ubuntu@18.185.58.149

# Check backend status
pm2 status

# Check nginx status
sudo systemctl status nginx

# View backend logs
pm2 logs scenario-api --lines 50
```

### Test in Browser
1. Open http://18.185.58.149
2. Login with OwenAdmin / 16SaPe66ebf**!
3. Open DevTools → Network tab
4. Perform a calculation
5. Verify all API requests go to `/api/*` (no CORS errors)

## Common Issues

### Issue: CORS Errors
**Symptom**: Browser console shows "Access-Control-Allow-Origin" errors
**Cause**: Frontend built with localhost:3001 URLs
**Fix**: Ensure `.env.production` exists with `VITE_API_BASE_URL=` then rebuild

```bash
cd dashboard
echo "VITE_API_BASE_URL=" > .env.production
npx vite build
# Then redeploy frontend
```

### Issue: 502 Bad Gateway
**Symptom**: nginx returns 502 error
**Cause**: Backend not running
**Fix**: Check and restart backend

```bash
ssh -i env/LightsailDefaultKey-eu-central-1.pem ubuntu@18.185.58.149
pm2 status
pm2 restart scenario-api
pm2 logs scenario-api
```

### Issue: Database Path Errors
**Symptom**: Backend can't find databases
**Cause**: Database paths pointing to local Mac paths
**Fix**: Run database path update script

```bash
ssh -i env/LightsailDefaultKey-eu-central-1.pem ubuntu@18.185.58.149
cd /home/ubuntu/app/dashboard/server
node /home/ubuntu/app/deployment/update-db-paths.js /home/ubuntu/app/data/users.db
pm2 restart scenario-api
```

## File Locations

### Local
- Source code: `/Users/Owen/ScenarioAnalysis2`
- Built frontend: `/Users/Owen/ScenarioAnalysis2/dashboard/dist`
- Deployment scripts: `/Users/Owen/ScenarioAnalysis2/deployment`

### Server
- App root: `/home/ubuntu/app`
- Backend server: `/home/ubuntu/app/dashboard/server`
- Frontend (nginx): `/var/www/scenario-app`
- Master database: `/home/ubuntu/app/data/users.db`
- User databases: `/home/ubuntu/app/data/users/{admin,common,OwenUser}/scenario_analysis.db`

## Key Configuration Files

### Frontend
- **Config**: `dashboard/src/config.ts` - API URL configuration
- **Environment**: `dashboard/.env.production` - Production environment variables
- **Build**: `dashboard/vite.config.ts` - Vite build configuration

### Backend
- **Server**: `dashboard/server/index.js` - Main backend server
- **Routes**: `dashboard/server/routes/` - API endpoints
- **Middleware**: `dashboard/server/middleware/` - Auth, database utilities

### Deployment
- **Main Script**: `deployment/prepare-and-deploy.sh` - Full deployment automation
- **DB Update**: `deployment/update-db-paths.js` - Database path updater
- **Backup**: `deployment/deploy.sh` - Simple file sync only

## Architecture

```
Browser (http://18.185.58.149)
    │
    ├─→ Static Files: nginx → /var/www/scenario-app/
    │   (HTML, CSS, JS, images, etc.)
    │
    └─→ API Calls (/api/*): nginx proxy → localhost:3001
        (Node.js backend with Express)
            │
            └─→ SQLite Databases
                ├─ Master: /home/ubuntu/app/data/users.db
                └─ Users: /home/ubuntu/app/data/users/{user}/scenario_analysis.db
```

## Important Notes

1. **Always test locally first** before deploying to production
2. **Backup databases** before major changes
3. **Check PM2 logs** if something doesn't work after deployment
4. **Local development unaffected** - uses `localhost:3001` automatically
5. **Production builds use relative URLs** - goes through nginx proxy

## Quick Commands Cheat Sheet

```bash
# Deploy everything
./deployment/prepare-and-deploy.sh

# Just redeploy frontend
cd /Users/Owen/ScenarioAnalysis2/dashboard && npx vite build && cd .. && \
rsync -avz --delete dashboard/dist/ -e "ssh -i env/LightsailDefaultKey-eu-central-1.pem" \
ubuntu@18.185.58.149:/tmp/dashboard_dist/ && \
ssh -i env/LightsailDefaultKey-eu-central-1.pem ubuntu@18.185.58.149 \
"sudo rsync -a --delete /tmp/dashboard_dist/ /var/www/scenario-app/ && rm -rf /tmp/dashboard_dist"

# Restart backend
ssh -i env/LightsailDefaultKey-eu-central-1.pem ubuntu@18.185.58.149 \
"cd /home/ubuntu/app/dashboard/server && pm2 restart scenario-api"

# View logs
ssh -i env/LightsailDefaultKey-eu-central-1.pem ubuntu@18.185.58.149 \
"pm2 logs scenario-api --lines 100"

# Check server status
ssh -i env/LightsailDefaultKey-eu-central-1.pem ubuntu@18.185.58.149 \
"pm2 status && sudo systemctl status nginx"
```
