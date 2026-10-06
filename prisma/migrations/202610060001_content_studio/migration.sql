CREATE TYPE "rossiter_content_stage" AS ENUM ('CONCEPTS', 'PRE_PRODUCTION', 'FILMING', 'DONE');

CREATE TABLE "rossiter_content_board" (
    "id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "rossiter_content_board_pkey" PRIMARY KEY ("id")
);

INSERT INTO "rossiter_content_board" ("id") VALUES ('main');

CREATE TABLE "rossiter_content_idea" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL DEFAULT 'main',
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "format" TEXT NOT NULL DEFAULT 'VIDEO',
    "stage" "rossiter_content_stage" NOT NULL DEFAULT 'CONCEPTS',
    "position" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rossiter_content_idea_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rossiter_content_idea_boardId_stage_position_idx" ON "rossiter_content_idea"("boardId", "stage", "position");
ALTER TABLE "rossiter_content_idea" ADD CONSTRAINT "rossiter_content_idea_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "rossiter_content_board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rossiter_content_idea" ADD CONSTRAINT "rossiter_content_idea_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "rossiter_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
