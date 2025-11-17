FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY backend/services/location-service/package.json backend/services/location-service/pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY backend/services/location-service .

# Build TypeScript
RUN pnpm run build

# Expose port
EXPOSE 3006

# Start the service
CMD ["pnpm", "start"]

