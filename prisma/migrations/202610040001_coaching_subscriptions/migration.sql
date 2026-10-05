CREATE TABLE "rossiter_coaching_billing_account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "checkoutAttemptId" TEXT,
    "checkoutLockUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rossiter_coaching_billing_account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rossiter_coaching_subscription" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "intervalCount" INTEGER NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "stripeCreatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rossiter_coaching_subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rossiter_coaching_billing_account_userId_livemode_key" ON "rossiter_coaching_billing_account"("userId", "livemode");
CREATE UNIQUE INDEX "rossiter_coaching_billing_account_stripeCustomerId_key" ON "rossiter_coaching_billing_account"("stripeCustomerId");
CREATE UNIQUE INDEX "rossiter_coaching_billing_account_stripeCheckoutSessionId_key" ON "rossiter_coaching_billing_account"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "rossiter_coaching_subscription_stripeSubscriptionId_key" ON "rossiter_coaching_subscription"("stripeSubscriptionId");
CREATE INDEX "rossiter_coaching_subscription_billingAccountId_stripeCreat_idx" ON "rossiter_coaching_subscription"("billingAccountId", "stripeCreatedAt");
ALTER TABLE "rossiter_coaching_billing_account" ADD CONSTRAINT "rossiter_coaching_billing_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "rossiter_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rossiter_coaching_subscription" ADD CONSTRAINT "rossiter_coaching_subscription_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "rossiter_coaching_billing_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
