FROM node:20-alpine

WORKDIR /app/restaurant-service

RUN npm install -g pnpm

COPY backend/services/restaurant-service/package.json backend/services/restaurant-service/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY backend/services/restaurant-service .

RUN npx prisma generate

RUN pnpm run build

EXPOSE 3005

CMD [ "node", "dist/server.js" ]
