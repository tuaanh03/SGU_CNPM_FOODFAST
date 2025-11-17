FROM node:20-alpine

WORKDIR /app/product-service

RUN npm install -g pnpm

COPY backend/services/product-service/package.json backend/services/product-service/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY backend/services/product-service .

RUN npx prisma generate

RUN pnpm run build

EXPOSE 3004

CMD [ "node", "dist/server.js" ]
