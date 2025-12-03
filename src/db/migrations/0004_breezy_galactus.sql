ALTER TABLE "applications" DROP CONSTRAINT "applications_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "courses" DROP CONSTRAINT "courses_created_by_units_user_id_fk";
--> statement-breakpoint
ALTER TABLE "internships" DROP CONSTRAINT "internships_created_by_units_user_id_fk";
--> statement-breakpoint
ALTER TABLE "interviews" DROP CONSTRAINT "interviews_application_id_applications_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "saved_internship" DROP CONSTRAINT "saved_internship_candidate_id_candidates_user_id_fk";
--> statement-breakpoint
ALTER TABLE "saved_internship" DROP CONSTRAINT "saved_internship_unit_id_units_user_id_fk";
--> statement-breakpoint
ALTER TABLE "saved_internship" DROP CONSTRAINT "saved_internship_internship_id_internships_id_fk";
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_units_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."units"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internships" ADD CONSTRAINT "internships_created_by_units_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."units"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_internship" ADD CONSTRAINT "saved_internship_candidate_id_candidates_user_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_internship" ADD CONSTRAINT "saved_internship_unit_id_units_user_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_internship" ADD CONSTRAINT "saved_internship_internship_id_internships_id_fk" FOREIGN KEY ("internship_id") REFERENCES "public"."internships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;