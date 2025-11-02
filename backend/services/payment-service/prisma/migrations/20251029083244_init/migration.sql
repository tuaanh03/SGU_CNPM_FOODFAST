-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('REQUIRES_PAYMENT', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PSPProvider" AS ENUM ('VNPAY', 'MOMO', 'ZALOPAY', 'STRIPE');

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'REQUIRES_PAYMENT',
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
    "pspProvider" "PSPProvider" NOT NULL DEFAULT 'VNPAY',
    "vnpTxnRef" VARCHAR(100) NOT NULL,
    "vnpTransactionNo" VARCHAR(100),
    "vnpResponseCode" VARCHAR(10),
    "vnpBankCode" VARCHAR(20),
    "vnpRawRequestPayload" JSONB,
    "vnpRawResponsePayload" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_orderId_key" ON "PaymentIntent"("orderId");

-- CreateIndex
CREATE INDEX "PaymentIntent_orderId_idx" ON "PaymentIntent"("orderId");

-- CreateIndex
CREATE INDEX "PaymentIntent_status_createdAt_idx" ON "PaymentIntent"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_vnpTxnRef_key" ON "PaymentAttempt"("vnpTxnRef");

-- CreateIndex
CREATE INDEX "PaymentAttempt_paymentIntentId_idx" ON "PaymentAttempt"("paymentIntentId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_vnpTxnRef_idx" ON "PaymentAttempt"("vnpTxnRef");

-- CreateIndex
CREATE INDEX "PaymentAttempt_status_createdAt_idx" ON "PaymentAttempt"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentAttempt_pspProvider_status_idx" ON "PaymentAttempt"("pspProvider", "status");

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
