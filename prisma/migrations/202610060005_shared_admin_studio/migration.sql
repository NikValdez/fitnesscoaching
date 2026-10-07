-- Content belongs to the shared studio, independent of any admin account.
ALTER TABLE "rossiter_content_idea" DROP CONSTRAINT "rossiter_content_idea_authorId_fkey";
ALTER TABLE "rossiter_content_idea" DROP COLUMN "authorId";
ALTER TABLE "rossiter_content_scratch" DROP CONSTRAINT "rossiter_content_scratch_authorId_fkey";
ALTER TABLE "rossiter_content_scratch" DROP COLUMN "authorId";
