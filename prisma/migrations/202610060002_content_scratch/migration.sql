CREATE TABLE "rossiter_content_scratch" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "cardId" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rossiter_content_scratch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rossiter_content_scratch_cardId_key" ON "rossiter_content_scratch"("cardId");
CREATE INDEX "rossiter_content_scratch_createdAt_idx" ON "rossiter_content_scratch"("createdAt");
ALTER TABLE "rossiter_content_scratch" ADD CONSTRAINT "rossiter_content_scratch_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "rossiter_content_idea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rossiter_content_scratch" ADD CONSTRAINT "rossiter_content_scratch_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "rossiter_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
