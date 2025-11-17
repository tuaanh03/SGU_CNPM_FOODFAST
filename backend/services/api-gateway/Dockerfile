FROM node:20-alpine

WORKDIR /app/api-gateway

RUN npm install -g pnpm

COPY backend/services/api-gateway/package.json backend/services/api-gateway/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY backend/services/api-gateway .

RUN pnpm run build

EXPOSE 3000

CMD [ "node", "dist/server.js" ]