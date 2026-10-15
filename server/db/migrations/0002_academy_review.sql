CREATE TYPE "public"."academy_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."requester_role" AS ENUM('owner', 'head_coach', 'manager');--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "affiliation" text;--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "instagram" text;--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "status" "academy_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "requester_role" "requester_role";--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "proof" text;--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "submitted_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "academies" ADD CONSTRAINT "academies_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "academies_status_idx" ON "academies" USING btree ("status","submitted_at");--> statement-breakpoint
-- Academies created before verification existed stay visible.
UPDATE "academies" SET "status" = 'approved';