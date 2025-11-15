#!/bin/bash
set -e

echo "=== Preparing local environment for deployment ==="

# Build frontend
echo "Building frontend..."
cd dashboard
npm install
npm run build
cd ..

# Create deployment package directory
echo "Creating deployment package..."
mkdir -p deployment/package

# Copy necessary files (excluding node_modules, build artifacts, etc.)
rsync -av --exclude='node_modules' \
          --exclude='build' \
          --exclude='dist' \
          --exclude='.git' \
          --exclude='*.log' \
          --exclude='.DS_Store' \
          --exclude='sessions.db' \
          ./ deployment/package/

# Copy built frontend
mkdir -p deployment/package/dashboard/dist
cp -r dashboard/dist/* deployment/package/dashboard/dist/

echo "Package prepared in deployment/package/"
echo "Ready to transfer to server"
