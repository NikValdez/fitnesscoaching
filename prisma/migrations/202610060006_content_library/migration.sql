CREATE TABLE "rossiter_content_library" (
    "id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "rossiter_content_library_pkey" PRIMARY KEY ("id")
);

INSERT INTO "rossiter_content_library" ("id") VALUES ('main');

CREATE TABLE "rossiter_content_library_entry" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL DEFAULT 'main',
    "url" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rossiter_content_library_entry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rossiter_content_library_entry_libraryId_url_key" ON "rossiter_content_library_entry"("libraryId", "url");
CREATE INDEX "rossiter_content_library_entry_libraryId_createdAt_idx" ON "rossiter_content_library_entry"("libraryId", "createdAt");
ALTER TABLE "rossiter_content_library_entry" ADD CONSTRAINT "rossiter_content_library_entry_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "rossiter_content_library"("id") ON DELETE CASCADE ON UPDATE CASCADE;
