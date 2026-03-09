CREATE TYPE "public"."meeting_purpose" AS ENUM('weekly_check_in', 'progress_review', 'mid_point_evaluation', 'final_assessment', 'other');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('pending', 'approved', 'cancelled');--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentor_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"purpose" "meeting_purpose" NOT NULL,
	"status" "meeting_status" DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp (0) with time zone NOT NULL,
	"duration_minutes" text DEFAULT '30',
	"description" text,
	"cancellation_reason" text,
	"zoom_meeting_id" text,
	"zoom_join_url" text,
	"zoom_start_url" text,
	"created_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (0) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_mentor_id_mentors_user_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_candidate_id_candidates_user_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meetings_mentor_id_index" ON "meetings" USING btree ("mentor_id");--> statement-breakpoint
CREATE INDEX "meetings_candidate_id_index" ON "meetings" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "meetings_status_index" ON "meetings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "meetings_scheduled_at_index" ON "meetings" USING btree ("scheduled_at");