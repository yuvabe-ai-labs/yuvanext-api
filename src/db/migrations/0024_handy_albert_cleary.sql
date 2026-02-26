CREATE TYPE "public"."mentorship_request_status" AS ENUM('pending', 'accepted', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "mentorship_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"mentor_id" uuid NOT NULL,
	"status" "mentorship_request_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"rejection_reason" text,
	"created_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (0) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mentorship_requests" ADD CONSTRAINT "mentorship_requests_candidate_id_candidates_user_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_requests" ADD CONSTRAINT "mentorship_requests_mentor_id_mentors_user_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("user_id") ON DELETE cascade ON UPDATE no action;