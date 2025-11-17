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
    sed -i '/proxy_ssl_name/d' /etc/nginx/conf.d/default.conf
else
    echo "Configuring for RAILWAY..."

    # Check if using Railway private network (internal URLs)
    if echo "$API_GATEWAY_HOST" | grep -q "railway.internal"; then
        echo "  -> Using Railway PRIVATE networking (HTTP)"
        sed -i 's|https://|http://|g' /etc/nginx/conf.d/default.conf
        sed -i '/proxy_ssl_verify/d' /etc/nginx/conf.d/default.conf
        sed -i '/proxy_ssl_server_name/d' /etc/nginx/conf.d/default.conf
        sed -i '/proxy_ssl_name/d' /etc/nginx/conf.d/default.conf
    else
        echo "  -> Using PUBLIC networking (HTTPS)"
        # Keep HTTPS config as-is
    fi
fi

echo ""
echo "========================================="
echo "Generated Nginx Configuration:"
echo "========================================="
cat /etc/nginx/conf.d/default.conf
echo "========================================="
echo ""
echo "Proxy Location Config:"
grep -A 20 "location /api/" /etc/nginx/conf.d/default.conf || echo "ERROR: /api/ location not found!"
echo "========================================="
echo ""

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

echo ""
echo "========================================="
echo "Testing API Gateway Connection..."
echo "========================================="

# Build the target URL
if [ "$USE_HTTPS" = "true" ]; then
    TARGET_URL="https://${API_GATEWAY_HOST}/api/products"
else
    TARGET_URL="http://${API_GATEWAY_HOST}/api/products"
fi

echo "Target URL: $TARGET_URL"
echo ""

# Try to connect using wget (alpine has wget by default)
echo "Attempting connection..."
if wget --spider --timeout=10 --tries=2 "$TARGET_URL" 2>&1 | head -10; then
    echo "✓ Connection successful!"
else
    echo "✗ WARNING: Cannot connect to API Gateway!"
    echo "  This will cause 502 errors."
    echo "  Check:"
    echo "  1. API_GATEWAY_HOST is correct"
    echo "  2. API Gateway service is running"
    echo "  3. Network routing is OK"
fi

echo "========================================="
echo ""

echo "Starting nginx..."
exec nginx -g "daemon off;"

