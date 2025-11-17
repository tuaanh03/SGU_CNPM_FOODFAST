FROM node:20-alpine

WORKDIR /app/order-service

RUN npm install -g pnpm

COPY backend/services/order-service/package.json backend/services/order-service/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY backend/services/order-service .

RUN npx prisma generate

RUN pnpm run build

EXPOSE 2000

CMD [ "node", "dist/server.js" ]