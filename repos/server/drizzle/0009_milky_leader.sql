CREATE TYPE "public"."place_image_kind" AS ENUM('icon', 'banner');--> statement-breakpoint
CREATE TYPE "public"."user_image_kind" AS ENUM('avatar', 'banner');--> statement-breakpoint
CREATE TABLE "place_profile_assets" (
	"place_id" uuid NOT NULL,
	"kind" "place_image_kind" NOT NULL,
	"asset_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_profile_assets_place_id_kind_pk" PRIMARY KEY("place_id","kind")
);
--> statement-breakpoint
CREATE TABLE "post_assets" (
	"place_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	CONSTRAINT "post_assets_post_id_asset_id_pk" PRIMARY KEY("post_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE "user_profile_assets" (
	"user_id" uuid NOT NULL,
	"kind" "user_image_kind" NOT NULL,
	"place_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_assets_user_id_kind_pk" PRIMARY KEY("user_id","kind")
);
--> statement-breakpoint
ALTER TABLE "place_profile_assets" ADD CONSTRAINT "place_profile_assets_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_profile_assets" ADD CONSTRAINT "place_profile_assets_asset_place_fkey" FOREIGN KEY ("place_id","asset_id") REFERENCES "public"."assets"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_assets" ADD CONSTRAINT "post_assets_post_place_fkey" FOREIGN KEY ("place_id","post_id") REFERENCES "public"."posts"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_assets" ADD CONSTRAINT "post_assets_asset_place_fkey" FOREIGN KEY ("place_id","asset_id") REFERENCES "public"."assets"("place_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile_assets" ADD CONSTRAINT "user_profile_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile_assets" ADD CONSTRAINT "user_profile_assets_asset_place_fkey" FOREIGN KEY ("place_id","asset_id") REFERENCES "public"."assets"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "place_profile_assets_place_asset_idx" ON "place_profile_assets" USING btree ("place_id","asset_id");--> statement-breakpoint
CREATE INDEX "post_assets_place_post_idx" ON "post_assets" USING btree ("place_id","post_id");--> statement-breakpoint
CREATE INDEX "post_assets_place_asset_idx" ON "post_assets" USING btree ("place_id","asset_id");--> statement-breakpoint
CREATE INDEX "user_profile_assets_place_asset_idx" ON "user_profile_assets" USING btree ("place_id","asset_id");