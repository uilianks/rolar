ALTER TABLE "sessions" ALTER COLUMN "rpe" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "review_pending" boolean DEFAULT false NOT NULL;