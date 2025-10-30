-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('QUOTED', 'INITIATED', 'CONFIRMED', 'ONRAMP_PENDING', 'ONRAMP_COMPLETED', 'ONRAMP_FAILED', 'OFFRAMP_PENDING', 'OFFRAMP_COMPLETED', 'OFFRAMP_FAILED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "FeeHandling" AS ENUM ('INCLUSIVE', 'ADDITIVE');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'EXHAUSTED');

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sourceCurrency" TEXT NOT NULL DEFAULT 'USD',
    "destCurrency" TEXT NOT NULL,
    "exchangeRate" DECIMAL(12,6) NOT NULL,
    "quoteId" TEXT,
    "quoteExpiresAt" TIMESTAMP(3),
    "onrampFee" DECIMAL(12,2) NOT NULL,
    "corridorFee" DECIMAL(12,2) NOT NULL,
    "platformFee" DECIMAL(12,2) NOT NULL,
    "networkGas" DECIMAL(12,2) NOT NULL DEFAULT 0.05,
    "totalFees" DECIMAL(12,2) NOT NULL,
    "usdcSent" DECIMAL(12,2) NOT NULL,
    "destAmount" DECIMAL(12,2) NOT NULL,
    "onrampTxId" TEXT,
    "offrampTxId" TEXT,
    "feeHandling" "FeeHandling" NOT NULL DEFAULT 'INCLUSIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastAttemptAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "signature" TEXT NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_quoteId_key" ON "Payment"("quoteId");

-- CreateIndex
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Event_paymentId_timestamp_idx" ON "Event"("paymentId", "timestamp");

-- CreateIndex
CREATE INDEX "Event_eventType_idx" ON "Event"("eventType");

-- CreateIndex
CREATE INDEX "WebhookDelivery_paymentId_idx" ON "WebhookDelivery"("paymentId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_nextRetryAt_idx" ON "WebhookDelivery"("status", "nextRetryAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
