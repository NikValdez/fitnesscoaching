ALTER TABLE "rossiter_schedule_event"
  ADD COLUMN "seriesId" TEXT,
  ADD COLUMN "repeatEvery" TEXT;

CREATE INDEX "rossiter_schedule_event_seriesId_date_idx"
  ON "rossiter_schedule_event"("seriesId", "date");
