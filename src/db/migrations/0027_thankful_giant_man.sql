CREATE TYPE "public"."meeting_type" AS ENUM('zoom', 'in_person');--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "meeting_type" "meeting_type" DEFAULT 'zoom' NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "location" text;