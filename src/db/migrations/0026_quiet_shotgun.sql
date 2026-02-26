ALTER TABLE "meetings" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "meetings" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."meeting_status";--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('pending', 'completed', 'cancelled');--> statement-breakpoint
ALTER TABLE "meetings" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."meeting_status";--> statement-breakpoint
ALTER TABLE "meetings" ALTER COLUMN "status" SET DATA TYPE "public"."meeting_status" USING "status"::"public"."meeting_status";