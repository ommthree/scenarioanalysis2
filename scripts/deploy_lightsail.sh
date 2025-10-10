#!/bin/bash
#
# AWS Lightsail Deployment Script
# Deploys the ScenarioAnalysis2 application to AWS Lightsail
#
# Prerequisites:
#   - AWS CLI configured with credentials
#   - SSH key for Lightsail instance in ~/.ssh/
#   - Environment variables set (see below)
#

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}AWS Lightsail Deployment${NC}"
echo -e "${GREEN}================================${NC}"

# Configuration (can be overridden by environment variables)
LIGHTSAIL_HOST="${LIGHTSAIL_HOST:-}"
LIGHTSAIL_USER="${LIGHTSAIL_USER:-ubuntu}"
LIGHTSAIL_SSH_KEY="${LIGHTSAIL_SSH_KEY:-$HOME/.ssh/lightsail-key.pem}"
DEPLOY_DIR="${DEPLOY_DIR:-/home/ubuntu/scenario-engine}"
APP_PORT="${APP_PORT:-8080}"
DOMAIN="${DOMAIN:-}"

# Check prerequisites
if [[ -z "$LIGHTSAIL_HOST" ]]; then
    echo -e "${RED}Error: LIGHTSAIL_HOST environment variable not set${NC}"
    echo "Example: export LIGHTSAIL_HOST=your-instance.lightsail.aws.amazon.com"
    exit 1
fi

if [[ ! -f "$LIGHTSAIL_SSH_KEY" ]]; then
    echo -e "${RED}Error: SSH key not found at $LIGHTSAIL_SSH_KEY${NC}"
    echo "Download your Lightsail SSH key and place it there."
    exit 1
fi

# Ensure SSH key has correct permissions
chmod 600 "$LIGHTSAIL_SSH_KEY"

echo -e "${YELLOW}Deployment Configuration:${NC}"
echo "  Host: $LIGHTSAIL_HOST"
echo "  User: $LIGHTSAIL_USER"
echo "  Deploy Dir: $DEPLOY_DIR"
echo "  Port: $APP_PORT"
echo ""

# Function: Run command on remote server
remote_exec() {
    ssh -i "$LIGHTSAIL_SSH_KEY" -o StrictHostKeyChecking=no \
        "$LIGHTSAIL_USER@$LIGHTSAIL_HOST" "$@"
}

# Function: Copy files to remote server
remote_copy() {
    scp -i "$LIGHTSAIL_SSH_KEY" -o StrictHostKeyChecking=no -r "$@"
}

echo -e "${GREEN}[1/7] Testing SSH connection...${NC}"
if remote_exec "echo 'Connection successful'"; then
    echo -e "${GREEN}✓ SSH connection established${NC}"
else
    echo -e "${RED}✗ SSH connection failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}[2/7] Installing system dependencies on remote...${NC}"
remote_exec "sudo apt-get update -qq && sudo apt-get install -y \
    build-essential \
    cmake \
    sqlite3 \
    libsqlite3-dev \
    pkg-config \
    libssl-dev \
    nginx \
    git \
    certbot \
    python3-certbot-nginx"

echo ""
echo -e "${GREEN}[3/7] Creating deployment directory...${NC}"
remote_exec "mkdir -p $DEPLOY_DIR"
remote_exec "mkdir -p $DEPLOY_DIR/data/database"
remote_exec "mkdir -p $DEPLOY_DIR/data/config"
remote_exec "mkdir -p $DEPLOY_DIR/logs"

echo ""
echo -e "${GREEN}[4/7] Copying project files...${NC}"
echo "Building locally first..."
if [[ ! -d "build" ]]; then
    mkdir build
fi

cd build
cmake -DCMAKE_BUILD_TYPE=Release ..
make -j$(nproc)
cd ..

echo "Copying files to remote..."
remote_copy \
    build/engine/scenario_engine \
    "$LIGHTSAIL_USER@$LIGHTSAIL_HOST:$DEPLOY_DIR/"

remote_copy \
    web \
    data/config \
    "$LIGHTSAIL_USER@$LIGHTSAIL_HOST:$DEPLOY_DIR/"

echo -e "${GREEN}✓ Files copied${NC}"

echo ""
echo -e "${GREEN}[5/7] Setting up systemd service...${NC}"

# Create systemd service file
cat > /tmp/scenario-engine.service << EOF
[Unit]
Description=Scenario Analysis Engine
After=network.target

[Service]
Type=simple
User=$LIGHTSAIL_USER
WorkingDirectory=$DEPLOY_DIR
ExecStart=$DEPLOY_DIR/scenario_engine --mode server --port $APP_PORT --data-dir $DEPLOY_DIR/data
Restart=always
RestartSec=10

# Logging
StandardOutput=append:$DEPLOY_DIR/logs/app.log
StandardError=append:$DEPLOY_DIR/logs/error.log

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

remote_copy /tmp/scenario-engine.service "$LIGHTSAIL_USER@$LIGHTSAIL_HOST:/tmp/"
remote_exec "sudo mv /tmp/scenario-engine.service /etc/systemd/system/"
remote_exec "sudo systemctl daemon-reload"
remote_exec "sudo systemctl enable scenario-engine"
remote_exec "sudo systemctl restart scenario-engine"

echo -e "${GREEN}✓ Systemd service configured${NC}"

echo ""
echo -e "${GREEN}[6/7] Configuring Nginx reverse proxy...${NC}"

# Create Nginx configuration
cat > /tmp/scenario-engine-nginx << EOF
server {
    listen 80;
    server_name ${DOMAIN:-_};

    # Static files
    location /static/ {
        alias $DEPLOY_DIR/web/;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    # API endpoints
    location /api/ {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 86400;
    }

    # Main application
    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

remote_copy /tmp/scenario-engine-nginx "$LIGHTSAIL_USER@$LIGHTSAIL_HOST:/tmp/"
remote_exec "sudo mv /tmp/scenario-engine-nginx /etc/nginx/sites-available/scenario-engine"
remote_exec "sudo ln -sf /etc/nginx/sites-available/scenario-engine /etc/nginx/sites-enabled/"
remote_exec "sudo rm -f /etc/nginx/sites-enabled/default"
remote_exec "sudo nginx -t"
remote_exec "sudo systemctl restart nginx"

echo -e "${GREEN}✓ Nginx configured${NC}"

echo ""
echo -e "${GREEN}[7/7] Verifying deployment...${NC}"

sleep 5  # Wait for service to start

SERVICE_STATUS=$(remote_exec "sudo systemctl is-active scenario-engine" || echo "failed")
if [[ "$SERVICE_STATUS" == "active" ]]; then
    echo -e "${GREEN}✓ Application service is running${NC}"
else
    echo -e "${RED}✗ Application service failed to start${NC}"
    echo "Check logs: ssh -i $LIGHTSAIL_SSH_KEY $LIGHTSAIL_USER@$LIGHTSAIL_HOST"
    echo "  sudo journalctl -u scenario-engine -n 50"
    exit 1
fi

NGINX_STATUS=$(remote_exec "sudo systemctl is-active nginx" || echo "failed")
if [[ "$NGINX_STATUS" == "active" ]]; then
    echo -e "${GREEN}✓ Nginx is running${NC}"
else
    echo -e "${RED}✗ Nginx failed to start${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Your application is now running at:"
echo "  http://$LIGHTSAIL_HOST"
echo ""

if [[ -n "$DOMAIN" ]]; then
    echo -e "${YELLOW}Setting up SSL (optional):${NC}"
    echo "  ssh -i $LIGHTSAIL_SSH_KEY $LIGHTSAIL_USER@$LIGHTSAIL_HOST"
    echo "  sudo certbot --nginx -d $DOMAIN"
    echo ""
fi

echo "Useful commands:"
echo "  Check logs:"
echo "    ssh -i $LIGHTSAIL_SSH_KEY $LIGHTSAIL_USER@$LIGHTSAIL_HOST"
echo "    sudo journalctl -u scenario-engine -f"
echo ""
echo "  Restart service:"
echo "    ssh -i $LIGHTSAIL_SSH_KEY $LIGHTSAIL_USER@$LIGHTSAIL_HOST"
echo "    sudo systemctl restart scenario-engine"
echo ""
echo "  View application logs:"
echo "    ssh -i $LIGHTSAIL_SSH_KEY $LIGHTSAIL_USER@$LIGHTSAIL_HOST"
echo "    tail -f $DEPLOY_DIR/logs/app.log"
echo ""

echo -e "${GREEN}🚀 Happy deploying!${NC}"
