#!/bin/bash
set -e

# Configuration
SERVER_IP="18.185.58.149"
SSH_KEY="env/LightsailDefaultKey-eu-central-1.pem"
SERVER_USER="ubuntu"
REMOTE_DIR="/home/ubuntu/app"

echo "=== Preparing Deployment Package ==="

# Step 1: Build frontend with production environment
echo "Building frontend..."
cd dashboard
# Ensure .env.production exists for correct production builds
if [ ! -f ".env.production" ]; then
  echo "Creating .env.production..."
  echo "# Production environment variables" > .env.production
  echo "VITE_API_BASE_URL=" >> .env.production
fi
npx vite build
cd ..

# Step 2: Create deployment package directory
echo "Creating deployment package..."
rm -rf deployment/package
mkdir -p deployment/package

# Copy files to package
cp -r build deployment/package/
cp -r dashboard/dist deployment/package/dashboard_dist
cp -r dashboard/server deployment/package/dashboard/
cp -r data deployment/package/
cp -r env deployment/package/

# Step 3: Create a production-specific users.db with correct paths
echo "Creating production users.db..."
cp data/users.db deployment/package/data/users_production.db
node deployment/update-db-paths.js deployment/package/data/users_production.db

# Step 4: Copy user scenario databases if they exist
echo "Copying user databases..."
mkdir -p deployment/package/data/users/{admin,common,OwenUser}
for user_dir in admin common OwenUser; do
  if [ -f "data/users/$user_dir/scenario_analysis.db" ]; then
    cp "data/users/$user_dir/scenario_analysis.db" "deployment/package/data/users/$user_dir/"
    echo "  ✓ Copied $user_dir database"
  fi
done

echo ""
echo "=== Deploying to Lightsail ($SERVER_IP) ==="

# Test SSH connection
echo "Testing SSH connection..."
ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$SERVER_USER@$SERVER_IP" "echo 'SSH connection successful'"

# Create remote directory structure
echo "Creating remote directory structure..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" "mkdir -p $REMOTE_DIR/data/users/{admin,common,OwenUser}"

# Sync files to server
echo "Syncing files to server..."
rsync -avz --delete \
      --exclude='gtd-api/' \
      -e "ssh -i $SSH_KEY" \
      deployment/package/ \
      "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"

# Replace users.db with production version on server
echo "Installing production users.db..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" \
  "mv $REMOTE_DIR/data/users_production.db $REMOTE_DIR/data/users.db"

# Deploy frontend dist to nginx directory
echo "Deploying frontend to nginx..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" "sudo mkdir -p /var/www/scenario-app"
rsync -avz --delete \
      -e "ssh -i $SSH_KEY" \
      deployment/package/dashboard_dist/ \
      "$SERVER_USER@$SERVER_IP:/tmp/dashboard_dist/"
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" \
  "sudo rsync -a --delete /tmp/dashboard_dist/ /var/www/scenario-app/ && rm -rf /tmp/dashboard_dist"

# Set correct permissions for static files
echo "Setting file permissions..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" \
  "sudo chmod -R 644 /var/www/scenario-app/* && sudo chmod 755 /var/www/scenario-app /var/www/scenario-app/assets"

# Update nginx configuration
echo "Updating nginx configuration..."
scp -i "$SSH_KEY" deployment/nginx-config.conf "$SERVER_USER@$SERVER_IP:/tmp/nginx-site.conf"
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" \
  "sudo mv /tmp/nginx-site.conf /etc/nginx/sites-available/default && sudo nginx -t && sudo systemctl reload nginx"

# Restart PM2
echo "Restarting backend service..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" "cd $REMOTE_DIR/dashboard/server && pm2 restart scenario-api"

echo ""
echo "✓ Deployment complete!"
echo ""
echo "Production URL: http://$SERVER_IP"
echo "Credentials: OwenAdmin / 16SaPe66ebf**!"
