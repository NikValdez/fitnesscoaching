CREATE TYPE "rossiter_coaching_service" AS ENUM ('FITNESS', 'NUTRITION', 'ACCOUNTABILITY', 'LIFESTYLE');
CREATE TYPE "rossiter_coaching_tier" AS ENUM ('ESSENTIAL', 'ONGOING', 'IN_PERSON');
CREATE TYPE "rossiter_contact_channel" AS ENUM ('VOICE_CALL', 'TEXT_MESSAGE', 'EMAIL');

CREATE TABLE "rossiter_client_intake" (
  "userId" TEXT NOT NULL,
  "channels" "rossiter_contact_channel"[] NOT NULL,
  "phone" TEXT,
  "goals" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rossiter_client_intake_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "rossiter_client_intake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "rossiter_user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "rossiter_service_interest" (
  "userId" TEXT NOT NULL,
  "service" "rossiter_coaching_service" NOT NULL,
  "tier" "rossiter_coaching_tier" NOT NULL,
  CONSTRAINT "rossiter_service_interest_pkey" PRIMARY KEY ("userId", "service"),
  CONSTRAINT "rossiter_service_interest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "rossiter_client_intake"("userId") ON DELETE CASCADE ON UPDATE CASCADE
);
