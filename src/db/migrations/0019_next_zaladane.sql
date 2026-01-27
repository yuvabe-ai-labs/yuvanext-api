ALTER TABLE "invitations" DROP CONSTRAINT "invitations_invitation_token_unique";--> statement-breakpoint
DROP INDEX "invitations_token_idx";--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "invitation_token";