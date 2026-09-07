-- Rename application tables and their database objects without recreating data.
-- Keep the original migration intact so fresh and existing databases follow the same history.
BEGIN;

ALTER TABLE "public"."meridian_user" RENAME TO "rossiter_user";
ALTER TABLE "public"."rossiter_user" RENAME CONSTRAINT "meridian_user_pkey" TO "rossiter_user_pkey";

ALTER TABLE "public"."meridian_session" RENAME TO "rossiter_session";
ALTER TABLE "public"."rossiter_session" RENAME CONSTRAINT "meridian_session_pkey" TO "rossiter_session_pkey";

ALTER TABLE "public"."meridian_account" RENAME TO "rossiter_account";
ALTER TABLE "public"."rossiter_account" RENAME CONSTRAINT "meridian_account_pkey" TO "rossiter_account_pkey";

ALTER TABLE "public"."meridian_verification" RENAME TO "rossiter_verification";
ALTER TABLE "public"."rossiter_verification" RENAME CONSTRAINT "meridian_verification_pkey" TO "rossiter_verification_pkey";

ALTER TABLE "public"."meridian_enquiry" RENAME TO "rossiter_enquiry";
ALTER TABLE "public"."rossiter_enquiry" RENAME CONSTRAINT "meridian_enquiry_pkey" TO "rossiter_enquiry_pkey";

ALTER TABLE "public"."meridian_workout" RENAME TO "rossiter_workout";
ALTER TABLE "public"."rossiter_workout" RENAME CONSTRAINT "meridian_workout_pkey" TO "rossiter_workout_pkey";

ALTER TABLE "public"."meridian_check_in" RENAME TO "rossiter_check_in";
ALTER TABLE "public"."rossiter_check_in" RENAME CONSTRAINT "meridian_check_in_pkey" TO "rossiter_check_in_pkey";

ALTER INDEX "public"."meridian_user_email_key" RENAME TO "rossiter_user_email_key";
ALTER INDEX "public"."meridian_session_token_key" RENAME TO "rossiter_session_token_key";
ALTER INDEX "public"."meridian_session_userId_idx" RENAME TO "rossiter_session_userId_idx";
ALTER INDEX "public"."meridian_account_userId_idx" RENAME TO "rossiter_account_userId_idx";
ALTER INDEX "public"."meridian_account_providerId_accountId_key" RENAME TO "rossiter_account_providerId_accountId_key";
ALTER INDEX "public"."meridian_verification_identifier_idx" RENAME TO "rossiter_verification_identifier_idx";
ALTER INDEX "public"."meridian_enquiry_userId_createdAt_idx" RENAME TO "rossiter_enquiry_userId_createdAt_idx";
ALTER INDEX "public"."meridian_workout_userId_date_idx" RENAME TO "rossiter_workout_userId_date_idx";
ALTER INDEX "public"."meridian_check_in_userId_weekOf_key" RENAME TO "rossiter_check_in_userId_weekOf_key";

ALTER TABLE "public"."rossiter_session" RENAME CONSTRAINT "meridian_session_userId_fkey" TO "rossiter_session_userId_fkey";
ALTER TABLE "public"."rossiter_account" RENAME CONSTRAINT "meridian_account_userId_fkey" TO "rossiter_account_userId_fkey";
ALTER TABLE "public"."rossiter_enquiry" RENAME CONSTRAINT "meridian_enquiry_userId_fkey" TO "rossiter_enquiry_userId_fkey";
ALTER TABLE "public"."rossiter_workout" RENAME CONSTRAINT "meridian_workout_userId_fkey" TO "rossiter_workout_userId_fkey";
ALTER TABLE "public"."rossiter_check_in" RENAME CONSTRAINT "meridian_check_in_userId_fkey" TO "rossiter_check_in_userId_fkey";

COMMIT;
