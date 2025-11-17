FROM node:20-alpine

WORKDIR /app/notification-service

RUN npm install -g pnpm

COPY backend/services/notification-service/package.json backend/services/notification-service/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY backend/services/notification-service .

RUN pnpm run build

EXPOSE 5000

CMD [ "node", "dist/server.js" ]