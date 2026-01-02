CREATE TYPE "public"."unit_offer_decision" AS ENUM('selected', 'reject', 'pending');--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "status" SET DEFAULT 'applied'::text;--> statement-breakpoint
DROP TYPE "public"."application_status";--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('applied', 'shortlisted', 'not_shortlisted', 'interviewed', 'hired');--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "status" SET DEFAULT 'applied'::"public"."application_status";--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "status" SET DATA TYPE "public"."application_status" USING "status"::"public"."application_status";--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "unit_offer_decision" "unit_offer_decision" DEFAULT 'pending';