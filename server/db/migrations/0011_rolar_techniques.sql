ALTER TABLE "techniques" ALTER COLUMN "academy_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "techniques" ADD COLUMN "name_en" text;--> statement-breakpoint
ALTER TABLE "techniques" ADD COLUMN "description_en" text;--> statement-breakpoint
CREATE UNIQUE INDEX "techniques_rolar_name_idx" ON "techniques" USING btree (lower("name")) WHERE "techniques"."academy_id" is null;