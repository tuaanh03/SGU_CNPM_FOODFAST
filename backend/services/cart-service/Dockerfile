FROM node:20-alpine

WORKDIR /app/cart-service

RUN npm install -g pnpm

COPY backend/services/cart-service/package.json backend/services/cart-service/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY backend/services/cart-service .

RUN pnpm run build

EXPOSE 3006

CMD [ "node", "dist/server.js" ]


