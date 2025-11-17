# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Build the application
# Frontend sẽ hardcode /api, không cần biến môi trường lúc build
RUN npm run build

# Stage 2: Production stage with Nginx
FROM nginx:alpine

# Copy nginx configuration template
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Nginx alpine tự động render template từ /etc/nginx/templates/
# và thay thế biến môi trường VITE_API_BASE_URL_INTERNAL khi khởi động
CMD ["nginx", "-g", "daemon off;"]
