# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source files, exclude nginx.conf
COPY . .
RUN rm -f nginx.conf

# Build argument for API base URL (có thể override khi build)
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Build the application
RUN npm run build

# Stage 2: Production stage with Nginx
FROM nginx:alpine

# Copy nginx configuration template (Railway HTTPS version)
COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx with environment variable substitution
# USE_HTTPS: set to 'true' for Railway (HTTPS), unset or 'false' for local (HTTP)
CMD /bin/sh -c '\
    export API_GATEWAY_HOST=${API_GATEWAY_HOST:-api-gateway:3000}; \
    envsubst "\$API_GATEWAY_HOST" < /etc/nginx/templates/nginx.conf.template > /etc/nginx/conf.d/default.conf; \
    if [ "$USE_HTTPS" != "true" ]; then \
        echo "Using HTTP for local environment..."; \
        sed -i "s|https://|http://|g" /etc/nginx/conf.d/default.conf; \
        sed -i "/proxy_ssl_verify/d" /etc/nginx/conf.d/default.conf; \
        sed -i "/proxy_ssl_server_name/d" /etc/nginx/conf.d/default.conf; \
        sed -i "s/Host ${API_GATEWAY_HOST}/Host \$host/g" /etc/nginx/conf.d/default.conf; \
    else \
        echo "Using HTTPS for Railway..."; \
    fi; \
    echo "=== Nginx Config ==="; \
    cat /etc/nginx/conf.d/default.conf; \
    echo "==================="; \
    nginx -g "daemon off;"'
