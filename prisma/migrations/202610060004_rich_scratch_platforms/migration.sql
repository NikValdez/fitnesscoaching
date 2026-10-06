ALTER TABLE "rossiter_content_pad" ADD COLUMN "document" TEXT;
ALTER TABLE "rossiter_content_idea" ADD COLUMN "platforms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
