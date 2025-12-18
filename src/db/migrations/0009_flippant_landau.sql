ALTER TYPE "public"."marital_status" ADD VALUE 'Prefer not to say';--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "projects" jsonb;