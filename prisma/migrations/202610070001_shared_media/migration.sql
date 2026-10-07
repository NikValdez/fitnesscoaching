CREATE TABLE "rossiter_media_library" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "revision" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "rossiter_media_library" ("id") VALUES ('main');
CREATE TABLE "rossiter_media_asset" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "objectKey" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "size" BIGINT NOT NULL,
  "lastModified" DOUBLE PRECISION NOT NULL,
  "title" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "category" TEXT NOT NULL DEFAULT 'RAW',
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "cardId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'UPLOADING',
  "uploadId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rossiter_media_asset_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "rossiter_content_idea"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "rossiter_media_asset_status_check" CHECK ("status" IN ('UPLOADING', 'FINALIZING', 'READY', 'DELETING')),
  CONSTRAINT "rossiter_media_asset_size_check" CHECK ("size" > 0 AND "size" <= 10737418240)
);
CREATE UNIQUE INDEX "rossiter_media_asset_objectKey_key" ON "rossiter_media_asset"("objectKey");
CREATE INDEX "rossiter_media_asset_status_createdAt_idx" ON "rossiter_media_asset"("status", "createdAt");
CREATE INDEX "rossiter_media_asset_cardId_idx" ON "rossiter_media_asset"("cardId");
CREATE TABLE "rossiter_media_upload_part" (
  "assetId" TEXT NOT NULL,
  "partNumber" INTEGER NOT NULL,
  "etag" TEXT NOT NULL,
  PRIMARY KEY ("assetId", "partNumber"),
  CONSTRAINT "rossiter_media_upload_part_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "rossiter_media_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
