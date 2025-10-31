import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  // Auto-detect: Nếu DATABASE_URL có 'order-db' (Docker) và đang test, thay bằng localhost:5433
  const dbUrl = process.env.DATABASE_URL || '';
  const isDockerDb = dbUrl.includes('order-db:5432');

  if (isDockerDb && process.env.NODE_ENV === 'test') {
    process.env.DATABASE_URL = dbUrl.replace('order-db:5432', 'localhost:5433');
  }

  return new PrismaClient();
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;