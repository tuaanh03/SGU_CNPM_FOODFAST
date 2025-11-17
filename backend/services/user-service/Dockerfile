FROM node:20-alpine

WORKDIR /app/user-service

# Install build tools needed for native modules like bcrypt
RUN apk add --no-cache python3 make g++ \
    && npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

RUN apk del python3 make g++

COPY . .

RUN npx prisma generate

RUN pnpm run build

EXPOSE 1000

CMD sh -c "npx prisma migrate deploy && node dist/server.js"
