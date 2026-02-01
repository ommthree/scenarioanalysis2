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

# Sync files to server (preserving existing databases and gtd-api)
echo "Syncing files to server..."
rsync -avz --delete \
      --exclude='gtd-api/' \
      --exclude='*.db' \
      --exclude='*.db-shm' \
      --exclude='*.db-wal' \
      -e "ssh -i $SSH_KEY" \
      deployment/package/ \
      "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"

echo "Deployment complete!"
echo "Next: SSH into server and run setup commands"
