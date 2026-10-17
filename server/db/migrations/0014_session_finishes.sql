ALTER TABLE "sessions" ADD COLUMN "submissions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "taps" jsonb DEFAULT '[]'::jsonb NOT NULL;