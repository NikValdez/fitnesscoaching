-- CreateEnum
CREATE TYPE "rossiter_role" AS ENUM ('CLIENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "rossiter_program_kind" AS ENUM ('FITNESS', 'NUTRITION');

-- CreateEnum
CREATE TYPE "rossiter_event_kind" AS ENUM ('WORKOUT', 'CHECK_IN', 'NUTRITION', 'COACH_TASK');

-- AlterTable
ALTER TABLE "rossiter_check_in" ADD COLUMN     "coachNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "rossiter_user" ADD COLUMN     "role" "rossiter_role" NOT NULL DEFAULT 'CLIENT';

-- CreateTable
CREATE TABLE "rossiter_program" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "rossiter_program_kind" NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "calories" INTEGER,
    "proteinGrams" INTEGER,
    "carbsGrams" INTEGER,
    "fatsGrams" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rossiter_program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rossiter_program_exercise" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" TEXT NOT NULL,
    "notes" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "rossiter_program_exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rossiter_schedule_event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "rossiter_event_kind" NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "clientId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "programId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rossiter_schedule_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rossiter_nutrition_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "calories" INTEGER NOT NULL,
    "proteinGrams" INTEGER NOT NULL,
    "carbsGrams" INTEGER NOT NULL,
    "fatsGrams" INTEGER NOT NULL,
    "waterLitres" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rossiter_nutrition_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rossiter_program_clientId_archived_startDate_idx" ON "rossiter_program"("clientId", "archived", "startDate");

-- CreateIndex
CREATE INDEX "rossiter_program_exercise_programId_position_idx" ON "rossiter_program_exercise"("programId", "position");

-- CreateIndex
CREATE INDEX "rossiter_schedule_event_clientId_date_idx" ON "rossiter_schedule_event"("clientId", "date");

-- CreateIndex
CREATE INDEX "rossiter_schedule_event_date_completedAt_idx" ON "rossiter_schedule_event"("date", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "rossiter_nutrition_log_userId_date_key" ON "rossiter_nutrition_log"("userId", "date");

-- AddForeignKey
ALTER TABLE "rossiter_program" ADD CONSTRAINT "rossiter_program_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "rossiter_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rossiter_program" ADD CONSTRAINT "rossiter_program_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "rossiter_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rossiter_program_exercise" ADD CONSTRAINT "rossiter_program_exercise_programId_fkey" FOREIGN KEY ("programId") REFERENCES "rossiter_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rossiter_schedule_event" ADD CONSTRAINT "rossiter_schedule_event_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "rossiter_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rossiter_schedule_event" ADD CONSTRAINT "rossiter_schedule_event_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "rossiter_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rossiter_schedule_event" ADD CONSTRAINT "rossiter_schedule_event_programId_fkey" FOREIGN KEY ("programId") REFERENCES "rossiter_program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rossiter_nutrition_log" ADD CONSTRAINT "rossiter_nutrition_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "rossiter_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
