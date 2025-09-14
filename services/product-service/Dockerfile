FROM node:20-alpine

WORKDIR /app/product-service

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN npx prisma generate

RUN pnpm run build

EXPOSE 3004

CMD [ "node", "dist/server.js" ]
