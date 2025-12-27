ALTER TABLE "user_settings" RENAME TO "settings";--> statement-breakpoint
ALTER TABLE "settings" DROP CONSTRAINT "user_settings_user_id_unique";--> statement-breakpoint
ALTER TABLE "settings" DROP CONSTRAINT "user_settings_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_unique" UNIQUE("user_id");