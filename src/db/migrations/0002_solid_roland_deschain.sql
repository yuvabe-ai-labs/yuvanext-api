CREATE TYPE "public"."application_status" AS ENUM('applied', 'shortlisted', 'rejected', 'interviewed', 'hired');--> statement-breakpoint
CREATE TYPE "public"."candidate_offer_decision" AS ENUM('accept', 'reject');--> statement-breakpoint
CREATE TYPE "public"."candidate_type" AS ENUM('student', 'fresher', 'working', 'graduate');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other', 'prefer not to say');--> statement-breakpoint
CREATE TYPE "public"."marital_status" AS ENUM('married', 'single');--> statement-breakpoint
CREATE TYPE "public"."difficulty_level" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."internship_status" AS ENUM('active', 'closed', 'draft');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('part_time', 'full_time', 'both');--> statement-breakpoint
CREATE TYPE "public"."interview_provider" AS ENUM('zoom', 'google_meet', 'teams', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('success', 'info', 'warning', 'error');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"internship_id" uuid,
	"status" "application_status" DEFAULT 'applied',
	"created_at" timestamp (0) with time zone DEFAULT now(),
	"updated_at" timestamp (0) with time zone DEFAULT now(),
	"profile_score" smallint,
	"included_sections" jsonb,
	"candidate_offer_decision" "candidate_offer_decision"
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"type" "candidate_type",
	"experience_level" text,
	"profile_summary" text,
	"location" text,
	"marital_status" "marital_status",
	"is_differently_abled" boolean DEFAULT false,
	"has_career_break" boolean DEFAULT false,
	"created_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (0) with time zone DEFAULT now(),
	"skills" jsonb,
	"interests" jsonb,
	"looking_for" jsonb,
	"avatar_url" text,
	"phone" text,
	"gender" "gender",
	"date_of_birth" timestamp (0) with time zone,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"education" jsonb,
	"language" jsonb,
	"course" jsonb,
	"internship" jsonb,
	"social_links" jsonb
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"duration" text,
	"category" text,
	"difficulty_level" "difficulty_level",
	"created_by" uuid NOT NULL,
	"banner_url" text,
	"redirect_url" text,
	"created_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (0) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"duration" text,
	"payment" text,
	"status" "internship_status" DEFAULT 'draft' NOT NULL,
	"closing_date" date,
	"created_at" timestamp (0) with time zone DEFAULT now(),
	"updated_at" timestamp (0) with time zone DEFAULT now(),
	"is_paid" boolean DEFAULT false,
	"min_age_required" text,
	"job_type" "job_type",
	"benefits" jsonb,
	"skills_required" jsonb,
	"responsibilities" jsonb,
	"language" jsonb
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"scheduled_date" timestamp (0) with time zone NOT NULL,
	"duration_minutes" smallint,
	"link" text,
	"title" text,
	"description" text,
	"provider" "interview_provider",
	"created_at" timestamp (0) with time zone DEFAULT now(),
	"updated_at" timestamp (0) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"message" text,
	"type" "notification_type" DEFAULT 'info',
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (0) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_internship" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"unit_id" uuid,
	"internship_id" uuid NOT NULL,
	"created_at" timestamp (0) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "units" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"name" text,
	"type" text,
	"phone" text,
	"address" text,
	"website_url" text,
	"mission" text,
	"values" text,
	"description" text,
	"industry" text,
	"is_aurovillian" boolean DEFAULT false,
	"banner_url" text,
	"avatar_url" text,
	"gallery_images" jsonb DEFAULT '[]'::jsonb,
	"gallery_videos" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"focus_areas" jsonb,
	"skills_offered" jsonb,
	"opportunities_offered" jsonb,
	"location" text,
	"projects" jsonb,
	"social_links" jsonb
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_internship_id_internships_id_fk" FOREIGN KEY ("internship_id") REFERENCES "public"."internships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_units_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."units"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internships" ADD CONSTRAINT "internships_created_by_units_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."units"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_internship" ADD CONSTRAINT "saved_internship_candidate_id_candidates_user_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_internship" ADD CONSTRAINT "saved_internship_unit_id_units_user_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_internship" ADD CONSTRAINT "saved_internship_internship_id_internships_id_fk" FOREIGN KEY ("internship_id") REFERENCES "public"."internships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_user_id_index" ON "applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "applications_internship_id_index" ON "applications" USING btree ("internship_id");--> statement-breakpoint
CREATE INDEX "applications_status_index" ON "applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "applications_user_id_status_index" ON "applications" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "internships_created_by_index" ON "internships" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "internships_status_index" ON "internships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "internships_status_closing_date_index" ON "internships" USING btree ("status","closing_date");--> statement-breakpoint
CREATE INDEX "interviews_application_id_index" ON "interviews" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_index" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_is_read_index" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "notifications_user_id_is_read_index" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "saved_internship_candidate_id_index" ON "saved_internship" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "saved_internship_internship_id_index" ON "saved_internship" USING btree ("internship_id");