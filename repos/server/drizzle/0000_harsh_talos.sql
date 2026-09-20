DO $$
BEGIN
	IF current_setting('server_version_num')::integer < 180000 THEN
		RAISE EXCEPTION 'Displace requires PostgreSQL 18 or newer';
	END IF;
END
$$;--> statement-breakpoint
REVOKE ALL ON SCHEMA "public" FROM PUBLIC;--> statement-breakpoint
CREATE TYPE "public"."auth_token_type" AS ENUM('email_verification', 'password_reset');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."place_join_policy" AS ENUM('open', 'approval', 'invite_only');--> statement-breakpoint
CREATE TYPE "public"."place_member_status" AS ENUM('pending', 'active', 'left');--> statement-breakpoint
CREATE TYPE "public"."place_visibility" AS ENUM('public', 'unlisted', 'private');--> statement-breakpoint
CREATE TYPE "public"."idempotency_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."registration_mode" AS ENUM('open', 'invite_only', 'closed');--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "auth_token_type" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_tokens_expiry_check" CHECK ("auth_tokens"."expires_at" > "auth_tokens"."created_at"),
	CONSTRAINT "auth_tokens_consumed_at_check" CHECK ("auth_tokens"."consumed_at" is null or "auth_tokens"."consumed_at" >= "auth_tokens"."created_at")
);
--> statement-breakpoint
CREATE TABLE "external_identities" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"claims" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_identities_provider_check" CHECK (char_length(btrim("external_identities"."provider")) between 1 and 100),
	CONSTRAINT "external_identities_subject_check" CHECK (char_length(btrim("external_identities"."subject")) between 1 and 512)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_family_id" uuid DEFAULT uuidv7() NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_expiry_check" CHECK ("sessions"."expires_at" > "sessions"."created_at"),
	CONSTRAINT "sessions_revoked_at_check" CHECK ("sessions"."revoked_at" is null or "sessions"."revoked_at" >= "sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "user_emails" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_emails_normalized_check" CHECK ("user_emails"."email" = lower(btrim("user_emails"."email")) and char_length("user_emails"."email") between 3 and 320)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"is_instance_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_handle_format_check" CHECK ("users"."handle" = lower("users"."handle") and "users"."handle" ~ '^[a-z0-9_]{3,32}$'),
	CONSTRAINT "users_display_name_length_check" CHECK (char_length(btrim("users"."display_name")) between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "bans" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"revoked_by_user_id" uuid,
	"reason" text NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bans_reason_length_check" CHECK (char_length(btrim("bans"."reason")) between 1 and 2000),
	CONSTRAINT "bans_expiry_check" CHECK ("bans"."expires_at" is null or "bans"."expires_at" > "bans"."created_at"),
	CONSTRAINT "bans_revocation_check" CHECK (("bans"."revoked_at" is null and "bans"."revoked_by_user_id" is null) or ("bans"."revoked_at" is not null and "bans"."revoked_by_user_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"role_id" uuid,
	"invited_by_user_id" uuid NOT NULL,
	"accepted_by_user_id" uuid,
	"email" text,
	"token_hash" text NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_email_normalized_check" CHECK ("invites"."email" is null or ("invites"."email" = lower(btrim("invites"."email")) and char_length("invites"."email") between 3 and 320)),
	CONSTRAINT "invites_max_uses_check" CHECK ("invites"."max_uses" > 0),
	CONSTRAINT "invites_use_count_check" CHECK ("invites"."use_count" >= 0 and "invites"."use_count" <= "invites"."max_uses"),
	CONSTRAINT "invites_expiry_check" CHECK ("invites"."expires_at" > "invites"."created_at")
);
--> statement-breakpoint
CREATE TABLE "member_roles" (
	"place_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_roles_pkey" PRIMARY KEY("place_id","member_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "place_members" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "place_member_status" DEFAULT 'pending' NOT NULL,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_members_place_id_id_unique" UNIQUE("place_id","id"),
	CONSTRAINT "place_members_joined_at_check" CHECK (("place_members"."status" = 'active' and "place_members"."joined_at" is not null) or ("place_members"."status" <> 'active'))
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"visibility" "place_visibility" DEFAULT 'public' NOT NULL,
	"join_policy" "place_join_policy" DEFAULT 'open' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_slug_format_check" CHECK ("places"."slug" = lower("places"."slug") and "places"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length("places"."slug") between 3 and 80),
	CONSTRAINT "places_name_length_check" CHECK (char_length(btrim("places"."name")) between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "role_permissions_pkey" PRIMARY KEY("role_id","permission"),
	CONSTRAINT "role_permissions_permission_format_check" CHECK ("role_permissions"."permission" ~ '^[a-z][a-z0-9_]*(?:[.][a-z][a-z0-9_]*)+$')
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_place_id_id_unique" UNIQUE("place_id","id"),
	CONSTRAINT "roles_name_length_check" CHECK (char_length(btrim("roles"."name")) between 1 and 80),
	CONSTRAINT "roles_position_check" CHECK ("roles"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"place_id" uuid,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"request_id" text,
	"ip_address" "inet",
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_log_action_check" CHECK (char_length(btrim("audit_log"."action")) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"user_id" uuid,
	"place_id" uuid,
	"request_hash" text NOT NULL,
	"status" "idempotency_status" DEFAULT 'processing' NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"response_headers" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_key_length_check" CHECK (char_length("idempotency_keys"."key") between 8 and 128),
	CONSTRAINT "idempotency_keys_scope_check" CHECK (char_length(btrim("idempotency_keys"."scope")) between 1 and 200),
	CONSTRAINT "idempotency_keys_response_check" CHECK (("idempotency_keys"."status" = 'completed' and "idempotency_keys"."response_status" is not null) or ("idempotency_keys"."status" <> 'completed')),
	CONSTRAINT "idempotency_keys_expiry_check" CHECK ("idempotency_keys"."expires_at" > "idempotency_keys"."created_at")
);
--> statement-breakpoint
CREATE TABLE "instance_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"registration_mode" "registration_mode" DEFAULT 'open' NOT NULL,
	"single_place_mode" boolean DEFAULT false NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instance_settings_singleton_check" CHECK ("instance_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_attempts_check" CHECK ("outbox_events"."attempts" >= 0),
	CONSTRAINT "outbox_events_type_check" CHECK (char_length(btrim("outbox_events"."event_type")) between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_emails" ADD CONSTRAINT "user_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_role_place_fkey" FOREIGN KEY ("place_id","role_id") REFERENCES "public"."roles"("place_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_member_place_fkey" FOREIGN KEY ("place_id","member_id") REFERENCES "public"."place_members"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_role_place_fkey" FOREIGN KEY ("place_id","role_id") REFERENCES "public"."roles"("place_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_members" ADD CONSTRAINT "place_members_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_members" ADD CONSTRAINT "place_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_tokens_token_hash_unique" ON "auth_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_tokens_user_id_type_expires_at_idx" ON "auth_tokens" USING btree ("user_id","type","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "external_identities_provider_subject_unique" ON "external_identities" USING btree ("provider","subject");--> statement-breakpoint
CREATE INDEX "external_identities_user_id_idx" ON "external_identities" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_refresh_token_hash_unique" ON "sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_expires_at_id_idx" ON "sessions" USING btree ("user_id","expires_at","id");--> statement-breakpoint
CREATE INDEX "sessions_token_family_id_idx" ON "sessions" USING btree ("token_family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_emails_email_unique" ON "user_emails" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "user_emails_one_primary_per_user_unique" ON "user_emails" USING btree ("user_id") WHERE "user_emails"."is_primary";--> statement-breakpoint
CREATE INDEX "user_emails_user_id_idx" ON "user_emails" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_handle_unique" ON "users" USING btree (lower("handle"));--> statement-breakpoint
CREATE INDEX "users_status_created_at_id_idx" ON "users" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "bans_place_id_user_id_created_at_id_idx" ON "bans" USING btree ("place_id","user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "bans_user_id_idx" ON "bans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bans_created_by_user_id_idx" ON "bans" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "bans_revoked_by_user_id_idx" ON "bans" USING btree ("revoked_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invites_token_hash_unique" ON "invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invites_place_id_expires_at_id_idx" ON "invites" USING btree ("place_id","expires_at","id");--> statement-breakpoint
CREATE INDEX "invites_place_id_role_id_idx" ON "invites" USING btree ("place_id","role_id");--> statement-breakpoint
CREATE INDEX "invites_invited_by_user_id_idx" ON "invites" USING btree ("invited_by_user_id");--> statement-breakpoint
CREATE INDEX "invites_accepted_by_user_id_idx" ON "invites" USING btree ("accepted_by_user_id");--> statement-breakpoint
CREATE INDEX "member_roles_place_id_role_id_idx" ON "member_roles" USING btree ("place_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "place_members_place_id_user_id_unique" ON "place_members" USING btree ("place_id","user_id");--> statement-breakpoint
CREATE INDEX "place_members_user_id_idx" ON "place_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "place_members_place_id_status_created_at_id_idx" ON "place_members" USING btree ("place_id","status","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "places_slug_unique" ON "places" USING btree (lower("slug"));--> statement-breakpoint
CREATE INDEX "places_owner_user_id_idx" ON "places" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "places_visibility_created_at_id_idx" ON "places" USING btree ("visibility","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_place_id_name_unique" ON "roles" USING btree ("place_id",lower("name"));--> statement-breakpoint
CREATE INDEX "roles_place_id_position_id_idx" ON "roles" USING btree ("place_id","position","id");--> statement-breakpoint
CREATE INDEX "audit_log_place_id_created_at_id_idx" ON "audit_log" USING btree ("place_id","created_at","id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_user_id_created_at_id_idx" ON "audit_log" USING btree ("actor_user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_type","target_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_keys_scope_key_unique" ON "idempotency_keys" USING btree ("scope","key");--> statement-breakpoint
CREATE INDEX "idempotency_keys_user_id_idx" ON "idempotency_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idempotency_keys_place_id_idx" ON "idempotency_keys" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "outbox_events_dispatch_idx" ON "outbox_events" USING btree ("available_at","created_at","id") WHERE "outbox_events"."status" in ('pending', 'failed');--> statement-breakpoint
CREATE INDEX "outbox_events_aggregate_idx" ON "outbox_events" USING btree ("aggregate_type","aggregate_id","created_at","id");--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM PUBLIC;