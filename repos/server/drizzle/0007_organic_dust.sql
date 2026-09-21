CREATE TYPE "public"."asset_scan_status" AS ENUM('pending', 'clean', 'infected', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('quarantined', 'processing', 'ready', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."upload_intent_status" AS ENUM('pending', 'completed', 'expired');--> statement-breakpoint
CREATE TABLE "asset_variants" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_variants_size_check" CHECK ("asset_variants"."size_bytes" > 0),
	CONSTRAINT "asset_variants_dimensions_check" CHECK ("asset_variants"."width" > 0 and "asset_variants"."height" > 0)
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"upload_intent_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"original_file_name" text NOT NULL,
	"declared_mime_type" text NOT NULL,
	"detected_mime_type" text,
	"size_bytes" integer NOT NULL,
	"status" "asset_status" DEFAULT 'quarantined' NOT NULL,
	"scan_status" "asset_scan_status" DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	CONSTRAINT "assets_place_id_id_unique" UNIQUE("place_id","id"),
	CONSTRAINT "assets_size_check" CHECK ("assets"."size_bytes" > 0),
	CONSTRAINT "assets_ready_at_check" CHECK (("assets"."status" = 'ready' and "assets"."ready_at" is not null) or ("assets"."status" <> 'ready'))
);
--> statement-breakpoint
CREATE TABLE "upload_intents" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"original_file_name" text NOT NULL,
	"expected_mime_type" text NOT NULL,
	"expected_size_bytes" integer NOT NULL,
	"status" "upload_intent_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"cleaned_at" timestamp with time zone,
	CONSTRAINT "upload_intents_place_id_id_unique" UNIQUE("place_id","id"),
	CONSTRAINT "upload_intents_file_name_check" CHECK (char_length(btrim("upload_intents"."original_file_name")) between 1 and 255),
	CONSTRAINT "upload_intents_size_check" CHECK ("upload_intents"."expected_size_bytes" > 0),
	CONSTRAINT "upload_intents_expiry_check" CHECK ("upload_intents"."expires_at" > "upload_intents"."created_at")
);
--> statement-breakpoint
ALTER TABLE "asset_variants" ADD CONSTRAINT "asset_variants_asset_place_fkey" FOREIGN KEY ("place_id","asset_id") REFERENCES "public"."assets"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_upload_intent_place_fkey" FOREIGN KEY ("place_id","upload_intent_id") REFERENCES "public"."upload_intents"("place_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_variants_asset_id_kind_unique" ON "asset_variants" USING btree ("asset_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_variants_object_key_unique" ON "asset_variants" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "asset_variants_place_id_idx" ON "asset_variants" USING btree ("place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_upload_intent_id_unique" ON "assets" USING btree ("upload_intent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_object_key_unique" ON "assets" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "assets_place_created_at_id_idx" ON "assets" USING btree ("place_id","created_at","id");--> statement-breakpoint
CREATE INDEX "assets_uploaded_by_user_id_idx" ON "assets" USING btree ("uploaded_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "upload_intents_object_key_unique" ON "upload_intents" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "upload_intents_place_user_status_expires_idx" ON "upload_intents" USING btree ("place_id","user_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "upload_intents_user_id_idx" ON "upload_intents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "upload_intents_expiry_idx" ON "upload_intents" USING btree ("expires_at","id") WHERE "upload_intents"."status" in ('pending', 'expired') and "upload_intents"."cleaned_at" is null;--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT "id", 'upload.read'
FROM "roles"
WHERE "is_system" = true AND "name" IN ('Owner', 'Admin', 'Moderator', 'Member')
ON CONFLICT DO NOTHING;