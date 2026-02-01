#!/bin/bash
# Fix nginx proxy buffering for long-running calculations

echo "Backing up nginx config..."
sudo cp /etc/nginx/sites-available/scenario-app /etc/nginx/sites-available/scenario-app.backup-$(date +%Y%m%d-%H%M%S)

echo "Checking current nginx config..."
if sudo grep -q "proxy_buffering off" /etc/nginx/sites-available/scenario-app; then
    echo "proxy_buffering off already exists in config"
else
    echo "Adding proxy_buffering off to nginx config..."

    # Add buffering directives after proxy_pass line in /api/ location block
    sudo sed -i '/location \/api\//,/}/ {
        /proxy_pass http:\/\/localhost:3001;/a\
\
        # Disable buffering for streaming responses (heartbeat support)\
        proxy_buffering off;\
        proxy_cache off;
    }' /etc/nginx/sites-available/scenario-app

    echo "Configuration updated"
fi

echo "Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "Configuration valid, reloading nginx..."
    sudo systemctl reload nginx
    echo "Nginx reloaded successfully!"
    echo ""
    echo "Changes applied:"
    echo "- proxy_buffering off (allows heartbeat to flow through)"
    echo "- proxy_cache off (prevents response caching)"
else
    echo "Configuration test failed! Restoring backup..."
    BACKUP=$(ls -t /etc/nginx/sites-available/scenario-app.backup-* | head -1)
    sudo cp "$BACKUP" /etc/nginx/sites-available/scenario-app
    exit 1
fi
