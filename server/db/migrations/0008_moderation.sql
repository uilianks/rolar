ALTER TABLE "reports" ADD COLUMN "action" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "resolved_by" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "suspension_reason" text;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");