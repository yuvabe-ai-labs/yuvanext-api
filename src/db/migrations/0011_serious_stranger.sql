CREATE TYPE "public"."task_status" AS ENUM('pending', 'submitted', 'redo', 'accepted');--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_date" date,
	"end_date" date,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp (0) with time zone,
	"reviewed_by" uuid,
	"review_remarks" text,
	"reviewed_at" timestamp (0) with time zone,
	"created_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"start_time" text,
	"end_time" text,
	"color" text DEFAULT '#3B82F6',
	"submission_link" text
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_application_id_index" ON "tasks" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "tasks_status_index" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_reviewed_by_index" ON "tasks" USING btree ("reviewed_by");