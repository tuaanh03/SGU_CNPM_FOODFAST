#!/bin/sh
set -e

echo "========================================="
echo "Starting Nginx Configuration..."
echo "========================================="

# Set default values
export API_GATEWAY_HOST=${API_GATEWAY_HOST:-api-gateway:3000}
export USE_HTTPS=${USE_HTTPS:-false}

echo "Environment Variables:"
echo "  API_GATEWAY_HOST: $API_GATEWAY_HOST"
echo "  USE_HTTPS: $USE_HTTPS"
echo ""

# Generate nginx config from template
echo "Generating nginx configuration..."
envsubst '${API_GATEWAY_HOST}' < /etc/nginx/templates/nginx.conf.template > /etc/nginx/conf.d/default.conf

# Modify config based on environment
if [ "$USE_HTTPS" != "true" ]; then
    echo "Configuring for LOCAL (HTTP)..."
    sed -i 's|https://|http://|g' /etc/nginx/conf.d/default.conf
    sed -i '/proxy_ssl_verify/d' /etc/nginx/conf.d/default.conf
    sed -i '/proxy_ssl_server_name/d' /etc/nginx/conf.d/default.conf
    sed -i "s/Host \${API_GATEWAY_HOST}/Host \$host/g" /etc/nginx/conf.d/default.conf
else
    echo "Configuring for RAILWAY (HTTPS)..."
fi

echo ""
echo "========================================="
echo "Generated Nginx Configuration:"
echo "========================================="
cat /etc/nginx/conf.d/default.conf
echo "========================================="
echo ""

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

echo "Starting nginx..."
exec nginx -g "daemon off;"

