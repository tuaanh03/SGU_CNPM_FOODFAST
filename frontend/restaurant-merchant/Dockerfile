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
RUN npm run build

# Stage 2: Production stage with Nginx
FROM nginx:alpine

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 8080 (different from customer portal)
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

