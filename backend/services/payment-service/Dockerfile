FROM node:20-alpine

WORKDIR /app/payment-service

RUN npm install -g pnpm

COPY backend/services/payment-service/package.json backend/services/payment-service/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY backend/services/payment-service .

# Generate Prisma Client
RUN npx prisma generate

RUN pnpm run build

EXPOSE 4000

CMD [ "node", "dist/server.js" ]