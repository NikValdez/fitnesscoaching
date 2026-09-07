CREATE TABLE "rossiter_purchase" (
    "id" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL,
    "email" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rossiter_purchase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "rossiter_purchase_stripeSessionId_key" ON "rossiter_purchase"("stripeSessionId");
