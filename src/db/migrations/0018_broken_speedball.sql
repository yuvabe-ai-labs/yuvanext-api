CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"invitation_token" text NOT NULL,
	"invitation_url" text,
	"role" text DEFAULT 'candidate' NOT NULL,
	"company_name" text,
	"company_type" text,
	"contact_number" text,
	"industry_type" text,
	"address" text,
	"about_company" text,
	"service_offered" text,
	"achievements" text,
	"metadata" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_invitation_token_unique" UNIQUE("invitation_token")
);
--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitations_token_idx" ON "invitations" USING btree ("invitation_token");--> statement-breakpoint
CREATE INDEX "invitations_status_idx" ON "invitations" USING btree ("status");