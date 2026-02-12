CREATE TYPE "public"."capacity" AS ENUM('1-2', '3-5', '6-10', '10+');--> statement-breakpoint
CREATE TYPE "public"."mentor_type" AS ENUM('career_guidance', 'internship_support', 'skills_portfolio', 'wellbeing_confidence', 'general');--> statement-breakpoint
CREATE TABLE "mentors" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"mentor_type" "mentor_type",
	"expertise_areas" jsonb,
	"experience_snapshot" text,
	"availability_days" jsonb,
	"availability_time_windows" jsonb,
	"timezone" text,
	"mentoring_capacity" "capacity",
	"preferred_stages" jsonb,
	"communication_modes" jsonb,
	"confirm_boundaries" boolean DEFAULT false,
	"boundaries_details" jsonb,
	"escalation_procedure" text,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (0) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mentors" ADD CONSTRAINT "mentors_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;