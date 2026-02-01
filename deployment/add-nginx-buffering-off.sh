#!/bin/bash
# Add proxy_buffering off to nginx config

# Backup
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# Find the line number of "proxy_pass http://localhost:3001/api/;"
LINE=$(grep -n "proxy_pass.*localhost:3001/api/" /etc/nginx/nginx.conf | cut -d: -f1)

if [ -z "$LINE" ]; then
    echo "Error: Could not find proxy_pass line in nginx.conf"
    exit 1
fi

# Add the two lines after that line number
sed -i "${LINE}a\\    proxy_buffering off;\\n    proxy_cache off;" /etc/nginx/nginx.conf

echo "Changes made. Testing nginx config..."
nginx -t

if [ $? -eq 0 ]; then
    echo "Config valid. Reloading nginx..."
    systemctl reload nginx
    echo "✓ Success! Nginx updated and reloaded."
else
    echo "✗ Config test failed. Restoring backup..."
    cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf
    exit 1
fi
