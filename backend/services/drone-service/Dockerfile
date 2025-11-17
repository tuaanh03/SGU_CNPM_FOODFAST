FROM node:20-alpine

WORKDIR /app/drone-service

RUN npm install -g pnpm

COPY backend/services/drone-service/package.json backend/services/drone-service/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY backend/services/drone-service .

RUN npx prisma generate

RUN pnpm run build

EXPOSE 3008

CMD [ "node", "dist/server.js" ]

