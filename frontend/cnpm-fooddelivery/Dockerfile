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

# Copy both nginx configuration templates
COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template.railway
COPY nginx.conf.template.local /etc/nginx/templates/nginx.conf.template.local

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx with environment variable substitution
# USE_HTTPS: set to 'true' for Railway (HTTPS), unset or 'false' for local (HTTP)
# API_GATEWAY_HOST có thể được set từ Railway environment variables hoặc docker-compose
CMD ["/bin/sh", "-c", "\
    if [ \"$USE_HTTPS\" = \"true\" ]; then \
        echo 'Using HTTPS config for Railway...'; \
        export TEMPLATE_FILE=/etc/nginx/templates/nginx.conf.template.railway; \
    else \
        echo 'Using HTTP config for local...'; \
        export TEMPLATE_FILE=/etc/nginx/templates/nginx.conf.template.local; \
    fi && \
    export API_GATEWAY_HOST=${API_GATEWAY_HOST:-api-gateway:3000} && \
    envsubst '${API_GATEWAY_HOST}' < $TEMPLATE_FILE > /etc/nginx/conf.d/default.conf && \
    echo '=== Nginx Config ===' && \
    cat /etc/nginx/conf.d/default.conf && \
    echo '===================' && \
    nginx -g 'daemon off;'"]
