CREATE TABLE "personal_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_prefix" text NOT NULL,
	"token_hash" text NOT NULL,
	"scopes" text[] NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personal_access_tokens_name_length_check" CHECK (char_length(btrim("personal_access_tokens"."name")) between 1 and 100),
	CONSTRAINT "personal_access_tokens_prefix_length_check" CHECK (char_length("personal_access_tokens"."token_prefix") between 8 and 24),
	CONSTRAINT "personal_access_tokens_scopes_check" CHECK (cardinality("personal_access_tokens"."scopes") between 1 and 4 and "personal_access_tokens"."scopes" <@ array['read', 'write', 'moderation', 'administration']::text[]),
	CONSTRAINT "personal_access_tokens_expiry_check" CHECK ("personal_access_tokens"."expires_at" > "personal_access_tokens"."created_at"),
	CONSTRAINT "personal_access_tokens_revoked_at_check" CHECK ("personal_access_tokens"."revoked_at" is null or "personal_access_tokens"."revoked_at" >= "personal_access_tokens"."created_at")
);
--> statement-breakpoint
ALTER TABLE "personal_access_tokens" ADD CONSTRAINT "personal_access_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "personal_access_tokens_token_hash_unique" ON "personal_access_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "personal_access_tokens_user_id_created_at_id_idx" ON "personal_access_tokens" USING btree ("user_id","created_at","id");