-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "meridian_user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meridian_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meridian_session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "meridian_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meridian_account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meridian_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meridian_verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meridian_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meridian_enquiry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "interest" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "meridian_enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meridian_workout" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "meridian_workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meridian_check_in" (
    "id" TEXT NOT NULL,
    "weekOf" TEXT NOT NULL,
    "energy" INTEGER NOT NULL,
    "sleepHours" DOUBLE PRECISION NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "meridian_check_in_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meridian_user_email_key" ON "meridian_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "meridian_session_token_key" ON "meridian_session"("token");

-- CreateIndex
CREATE INDEX "meridian_session_userId_idx" ON "meridian_session"("userId");

-- CreateIndex
CREATE INDEX "meridian_account_userId_idx" ON "meridian_account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "meridian_account_providerId_accountId_key" ON "meridian_account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "meridian_verification_identifier_idx" ON "meridian_verification"("identifier");

-- CreateIndex
CREATE INDEX "meridian_enquiry_userId_createdAt_idx" ON "meridian_enquiry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "meridian_workout_userId_date_idx" ON "meridian_workout"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "meridian_check_in_userId_weekOf_key" ON "meridian_check_in"("userId", "weekOf");

-- AddForeignKey
ALTER TABLE "meridian_session" ADD CONSTRAINT "meridian_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "meridian_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meridian_account" ADD CONSTRAINT "meridian_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "meridian_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meridian_enquiry" ADD CONSTRAINT "meridian_enquiry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "meridian_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meridian_workout" ADD CONSTRAINT "meridian_workout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "meridian_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meridian_check_in" ADD CONSTRAINT "meridian_check_in_userId_fkey" FOREIGN KEY ("userId") REFERENCES "meridian_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
