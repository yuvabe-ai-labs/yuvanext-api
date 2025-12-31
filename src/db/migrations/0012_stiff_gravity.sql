ALTER TABLE "tasks" RENAME TO "tasks_management";--> statement-breakpoint
ALTER TABLE "tasks_management" DROP CONSTRAINT "tasks_application_id_applications_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks_management" DROP CONSTRAINT "tasks_reviewed_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks_management" ADD CONSTRAINT "tasks_management_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks_management" ADD CONSTRAINT "tasks_management_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;