DROP INDEX "invitations_status_idx";--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "invitation_url";--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "company_name";--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "company_type";--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "contact_number";--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "industry_type";--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "address";--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "about_company";--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "service_offered";--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "achievements";--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "invited_at";--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "expires_at";--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "accepted_at";--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_email_unique" UNIQUE("email");