CREATE TABLE "known_techniques" (
	"user_id" text NOT NULL,
	"technique_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "known_techniques_user_id_technique_id_pk" PRIMARY KEY("user_id","technique_id")
);
--> statement-breakpoint
ALTER TABLE "known_techniques" ADD CONSTRAINT "known_techniques_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "known_techniques" ADD CONSTRAINT "known_techniques_technique_id_techniques_id_fk" FOREIGN KEY ("technique_id") REFERENCES "public"."techniques"("id") ON DELETE cascade ON UPDATE no action;