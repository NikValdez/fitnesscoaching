CREATE TABLE "rossiter_content_pad" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rossiter_content_pad_pkey" PRIMARY KEY ("id")
);

-- Carry existing writing into the shared pad; keep the original idea rows intact.
INSERT INTO "rossiter_content_pad" ("id", "body", "updatedAt")
SELECT 'main', COALESCE(string_agg("body", E'\n\n' ORDER BY "createdAt", "id"), ''), CURRENT_TIMESTAMP
FROM "rossiter_content_scratch";
